import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackCreateSchema } from '@/lib/schemas';
import { toPublicTrack } from '@/lib/track-playback';
import { TRACK_TITLE_CONFLICT, trackTitleError } from '@/lib/track-title';

const adminHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

function isSlugUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('slug');
  return typeof target === 'string' && ['slug', 'slug_1', 'tracks_slug_key', 'track_slug_key', 'tracks_slug_1'].includes(target.toLowerCase());
}

// GET /api/tracks — list tracks (published only; admin cookie required for drafts)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genre = searchParams.get('genre');
  const all = searchParams.get('all') === 'true';
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

  // ?all=true requires admin session
  const showAll = all && await isAdminRequest(req);
  if (all && !showAll) {
    return NextResponse.json({ error: 'Sign in to load the admin library.' }, { status: 401, headers });
  }

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
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: adminHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: adminHeaders });
  }

  const parsed = TrackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422, headers: adminHeaders }
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
      }, { status: 422, headers: adminHeaders });
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
        }, { status: 422, headers: adminHeaders });
      }
      trackData.audioUrl = null;
    }
    const track = await prisma.track.create({
      data: trackData,
      include: { credits: true },
    });
    return NextResponse.json(track, { status: 201, headers: adminHeaders });
  } catch (err) {
    if (isSlugUniqueConflict(err)) {
      return NextResponse.json(trackTitleError(TRACK_TITLE_CONFLICT), { status: 409, headers: adminHeaders });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to create track' }, { status: 500, headers: adminHeaders });
  }
}
