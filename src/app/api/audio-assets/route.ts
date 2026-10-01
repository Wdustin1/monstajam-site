import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { checkOriginal, originalPathFromUrl } from '@/lib/audio-storage';
import { AUDIO_JOB_TIMEOUT_MS, audioAssetKey, audioAssetStatus, processAudioAsset } from '@/lib/audio-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store' };
const inputSchema = z.object({
  originalUrl: z.string().url().max(1000).optional(),
  originalName: z.string().min(1).max(255).optional(),
  audioAssetId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  previewStart: z.number().min(0).max(7200).default(0),
}).refine(input => Boolean(input.originalUrl) !== Boolean(input.audioAssetId), 'Choose one uploaded original.');

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid audio or preview start.', details: parsed.error.flatten().fieldErrors }, { status: 422, headers });
  try {
    const { originalUrl, audioAssetId, previewStart } = parsed.data;
    const previous = audioAssetId ? await prisma.audioAsset.findUnique({ where: { id: audioAssetId } }) : null;
    if (audioAssetId && !previous) return NextResponse.json({ error: 'Original audio not found.' }, { status: 404, headers });
    const originalPath = previous?.originalPath ?? originalPathFromUrl(originalUrl!);
    await checkOriginal(originalPath);
    const key = audioAssetKey(originalPath, previewStart);
    let asset = await prisma.audioAsset.findUnique({ where: { key } });
    let startJob = false;
    if (!asset) {
      try {
        asset = await prisma.audioAsset.create({ data: { key, originalPath, originalName: previous?.originalName ?? parsed.data.originalName ?? 'Original audio', previewStart } });
        startJob = true;
      } catch (error) {
        // A concurrent retry may have created the same source/start job.
        asset = await prisma.audioAsset.findUnique({ where: { key } });
        if (!asset) throw error;
      }
    } else if (asset.status === 'failed' || (asset.status === 'processing' && Date.now() - asset.updatedAt.getTime() > AUDIO_JOB_TIMEOUT_MS)) {
      const lease = new Date();
      const claimed = await prisma.audioAsset.updateMany({ where: { id: asset.id, updatedAt: asset.updatedAt }, data: { status: 'processing', error: null, updatedAt: lease } });
      startJob = claimed.count === 1;
      asset = await prisma.audioAsset.findUniqueOrThrow({ where: { id: asset.id } });
    }
    if (startJob) {
      const job = asset;
      after(() => processAudioAsset(job));
    }
    return NextResponse.json(audioAssetStatus(asset), { status: asset.status === 'ready' ? 200 : 202, headers });
  } catch {
    return NextResponse.json({ error: 'Could not prepare this upload. Check that private audio storage is configured and the original finished uploading, then retry. Your saved track is unchanged.' }, { status: 422, headers });
  }
}
