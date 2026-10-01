import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackCreateSchema } from '@/lib/schemas';
import { toPublicTrack } from '@/lib/track-playback';

// GET /api/tracks — list tracks (published only; admin cookie required for drafts)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genre = searchParams.get('genre');
  const all = searchParams.get('all') === 'true';
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

  // ?all=true requires admin session
  const showAll = all && isAdminRequest(req);

  try {
    const tracks = await prisma.track.findMany({
      where: {
        ...(!showAll && { published: true }),
        ...(genre && genre !== 'All' && { genre }),
      },
      include: { credits: true },
      orderBy: { number: 'asc' },
    });
    return NextResponse.json(showAll ? tracks : tracks.map(toPublicTrack), { headers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500, headers });
  }
}

// POST /api/tracks — create a new track (admin only)
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TrackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { accentCyan, ...trackInput } = parsed.data;
  const trackData: Prisma.TrackCreateInput = {
    ...trackInput,
    playbackMode: trackInput.playbackMode ?? 'preview',
    genre: trackInput.genre ?? 'Hip-Hop',
    color: trackInput.color ?? 'bg-gradient-to-br from-purple-600 to-blue-500',
    ...(accentCyan != null && { accentCyan }),
  };

  try {
    if (trackInput.audioUrl) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { audioUrl: ['Upload and process the audio before attaching it to this track.'] },
      }, { status: 422 });
    }
    if (trackInput.audioAssetId) {
      const asset = await prisma.audioAsset.findUnique({
        where: { id: trackInput.audioAssetId },
        select: { status: true, originalPath: true, previewPath: true },
      });
      if (!asset || asset.status !== 'ready' || !asset.originalPath || !asset.previewPath) {
        return NextResponse.json({
          error: 'Validation failed',
          details: { audioAssetId: ['Wait for audio processing to finish successfully before saving.'] },
        }, { status: 422 });
      }
      trackData.audioUrl = null;
    }
    const track = await prisma.track.create({
      data: trackData,
      include: { credits: true },
    });
    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create track' }, { status: 500 });
  }
}
