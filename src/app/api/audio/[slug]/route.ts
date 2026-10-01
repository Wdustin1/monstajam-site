import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { getPrivateAudio, audioToken } from '@/lib/audio-storage';
import { getPlaybackMode } from '@/lib/track-playback';
import { head } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const baseHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };

async function serve(req: NextRequest, slug: string, metadataOnly = false) {
  try {
    const admin = isAdminRequest(req);
    const track = await prisma.track.findUnique({ where: { slug } });
    if (!track || (!track.published && !admin) || !track.audioAssetId) return new Response(null, { status: 404, headers: baseHeaders });
    // Explicit full audition is admin-only, even for a published preview track.
    if (req.nextUrl.searchParams.get('full') === 'true' && !admin) return new Response(null, { status: 403, headers: baseHeaders });
    const asset = await prisma.audioAsset.findUnique({ where: { id: track.audioAssetId } });
    if (!asset || asset.status !== 'ready' || !asset.previewPath) return new Response(null, { status: 404, headers: baseHeaders });
    const full = req.nextUrl.searchParams.get('preview') !== 'true' && (getPlaybackMode(track) === 'full' || (admin && req.nextUrl.searchParams.get('full') === 'true'));
    const pathname = full ? asset.originalPath : asset.previewPath;
    const metadata = await head(pathname, { token: audioToken(), abortSignal: AbortSignal.timeout(15_000) });
    const headers = new Headers({ ...baseHeaders, 'Content-Type': full ? metadata.contentType : 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Content-Length': String(metadata.size) });
    if (metadataOnly) return new Response(null, { headers });
    const requestedRange = req.headers.get('range');
    let range: string | undefined;
    if (requestedRange) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(requestedRange);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${metadata.size}` } });
      const start = match[1] ? Number(match[1]) : Math.max(0, metadata.size - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(metadata.size - 1, Number(match[2])) : metadata.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= metadata.size || end < start) return new Response(null, { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${metadata.size}` } });
      range = `bytes=${start}-${end}`;
    }
    const result = await getPrivateAudio(pathname, { range, signal: req.signal });
    if (!result || result.statusCode !== 200) return new Response(null, { status: 404, headers: baseHeaders });
    const contentRange = result.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    headers.set('Content-Length', String(result.blob.size));
    return new Response(result.stream, { status: contentRange ? 206 : 200, headers });
  } catch {
    return new Response(null, { status: 503, headers: baseHeaders });
  }
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) { return serve(req, (await params).slug); }
export async function HEAD(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) { return serve(req, (await params).slug, true); }
