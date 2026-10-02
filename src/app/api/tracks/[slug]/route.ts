import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackUpdateSchema } from '@/lib/schemas';
import { getPlaybackMode, toPublicTrack } from '@/lib/track-playback';
import { activeContentWhere, CONTENT_CHANGED, contentHeaders, getContentMutationAdmin, isContentTrashed, isMissingContentError } from '@/lib/content-trash';
import { audioReviewSelect, getTrackPublishingReview, publishingError, publishingFailure, REVIEW_AGAIN, SAVE_DRAFT_FIRST } from '@/lib/publishing-review';

// GET /api/tracks/[slug] — drafts require an explicit authenticated preview
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const canPreview = req.nextUrl.searchParams.get('preview') === 'true' && await isAdminRequest(req);
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  try {
    const track = await prisma.track.findUnique({
      where: { slug },
      include: { credits: true },
    });
    if (!track || isContentTrashed(track) || (!track.published && !canPreview)) {
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
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: contentHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: contentHeaders });
  }

  const parsed = TrackUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422, headers: contentHeaders }
    );
  }

  const { slug } = await params;
  const { accentCyan, expectedUpdatedAt, reviewedPlaybackMode, ...trackInput } = parsed.data;

  try {
    const current = await prisma.track.findUnique({
      where: { slug },
      include: { credits: true },
    });
    if (!current || isContentTrashed(current)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: contentHeaders });
    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      return NextResponse.json({ error: CONTENT_CHANGED }, { status: 409, headers: contentHeaders });
    }
    const publishing = !current.published && trackInput.published === true;
    if (publishing) {
      if (!expectedUpdatedAt || reviewedPlaybackMode !== getPlaybackMode(current)) {
        return NextResponse.json(publishingError(REVIEW_AGAIN), { status: 422, headers: contentHeaders });
      }
      if (accentCyan !== undefined || Object.keys(trackInput).some(key => key !== 'published')) {
        return NextResponse.json(publishingError(SAVE_DRAFT_FIRST), { status: 422, headers: contentHeaders });
      }
    }

    if (trackInput.audioUrl !== undefined && trackInput.audioUrl !== (current.audioUrl ?? '')) {
      return NextResponse.json({
        error: 'Validation failed',
        details: { audioUrl: ['Use a processed audio upload to replace this track\'s audio.'] },
      }, { status: 422, headers: contentHeaders });
    }

    const trackData: Prisma.TrackUpdateInput = {
      ...trackInput,
      ...(trackInput.playbackMode === undefined && current.playbackMode == null && { playbackMode: getPlaybackMode(current) }),
      ...(accentCyan != null && { accentCyan }),
    };

    let attachedAsset;
    if (trackInput.audioAssetId) {
      const asset = await prisma.audioAsset.findUnique({
        where: { id: trackInput.audioAssetId },
        select: audioReviewSelect,
      });
      if (!asset || asset.status !== 'ready' || !asset.originalPath || !asset.previewPath) {
        return NextResponse.json({
          error: 'Validation failed',
          details: { audioAssetId: ['Wait for audio processing to finish successfully before saving.'] },
        }, { status: 422, headers: contentHeaders });
      }
      attachedAsset = asset;
      trackData.audioUrl = null;
    }

    if (trackInput.published ?? current.published) {
      const effective = {
        ...current, ...trackInput,
        playbackMode: trackInput.playbackMode ?? getPlaybackMode(current),
        ...(trackInput.audioAssetId && { audioUrl: null }),
      };
      const review = await getTrackPublishingReview(effective, { allowLegacyLive: current.published && !current.audioAssetId, asset: attachedAsset });
      if (!review.canPublish) return NextResponse.json(publishingFailure(review.checks), { status: 422, headers: contentHeaders });
    }

    const track = await prisma.track.update({
      where: { slug, updatedAt: current.updatedAt, AND: [activeContentWhere()] },
      data: trackData,
      include: { credits: true },
    });
    return NextResponse.json(track, { headers: contentHeaders });
  } catch (err) {
    if (isMissingContentError(err)) {
      try {
        const current = await prisma.track.findUnique({ where: { slug }, select: { deletedAt: true } });
        const active = current && !isContentTrashed(current);
        return NextResponse.json({ error: active ? CONTENT_CHANGED : 'Not found' }, { status: active ? 409 : 404, headers: contentHeaders });
      } catch {
        return NextResponse.json({ error: 'Could not check the track. Reload the library before trying again.' }, { status: 503, headers: contentHeaders });
      }
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to update track' }, { status: 500, headers: contentHeaders });
  }
}

// DELETE /api/tracks/[slug] — move to Trash without removing media or credits
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const admin = await getContentMutationAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: contentHeaders });
  }

  const { slug } = await params;
  try {
    await prisma.track.update({
      where: { slug, AND: [activeContentWhere()] },
      data: { published: false, deletedAt: new Date(), deletedBy: admin.username },
    });
    return NextResponse.json({ ok: true }, { headers: contentHeaders });
  } catch (err) {
    if (isMissingContentError(err)) {
      try {
        const current = await prisma.track.findUnique({ where: { slug }, select: { deletedAt: true } });
        if (current && isContentTrashed(current)) return NextResponse.json({ ok: true }, { headers: contentHeaders });
        return NextResponse.json({ error: current ? 'This track changed. Refresh the library before trying again.' : 'Not found' }, { status: current ? 409 : 404, headers: contentHeaders });
      } catch {
        return NextResponse.json({ error: 'Could not check Trash. Refresh before trying again.' }, { status: 503, headers: contentHeaders });
      }
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to move track to Trash' }, { status: 500, headers: contentHeaders });
  }
}
