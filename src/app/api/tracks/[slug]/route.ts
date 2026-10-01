import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackUpdateSchema } from '@/lib/schemas';
import { getPlaybackMode, toPublicTrack } from '@/lib/track-playback';

// GET /api/tracks/[slug] — drafts require an explicit authenticated preview
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const canPreview = req.nextUrl.searchParams.get('preview') === 'true' && isAdminRequest(req);
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  try {
    const track = await prisma.track.findUnique({
      where: { slug },
      include: { credits: true },
    });
    if (!track || (!track.published && !canPreview)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
    }
    return NextResponse.json(canPreview ? track : toPublicTrack(track), { headers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch track' }, { status: 500, headers });
  }
}

// PUT /api/tracks/[slug] — update metadata (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TrackUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { slug } = await params;
  const { accentCyan, ...trackInput } = parsed.data;

  try {
    const current = await prisma.track.findUnique({
      where: { slug },
      select: { genre: true, playbackMode: true, audioUrl: true, audioAssetId: true },
    });
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (trackInput.audioUrl !== undefined && trackInput.audioUrl !== (current.audioUrl ?? '')) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { audioUrl: ['Use a processed audio upload to replace this track\'s audio.'] },
      }, { status: 422 });
    }

    const trackData: Prisma.TrackUpdateInput = {
      ...trackInput,
      ...(trackInput.playbackMode === undefined && current.playbackMode == null && { playbackMode: getPlaybackMode(current) }),
      ...(accentCyan != null && { accentCyan }),
    };

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

    const track = await prisma.track.update({
      where: { slug },
      data: trackData,
      include: { credits: true },
    });
    return NextResponse.json(track);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
  }
}

// DELETE /api/tracks/[slug] (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  try {
    await prisma.track.delete({ where: { slug } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete track' }, { status: 500 });
  }
}
