import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackUpdateSchema } from '@/lib/schemas';

const MAX_TRACK_UPDATE_ATTEMPTS = 5;

function isRetryableTrackConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

// GET /api/tracks/[slug]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const track = await prisma.track.findUnique({
      where: { slug },
      include: { credits: true },
    });
    if (!track || !track.published) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(track);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch track' }, { status: 500 });
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
  const trackData: Prisma.TrackUpdateInput = {
    ...trackInput,
    ...(accentCyan != null && { accentCyan }),
  };

  for (let attempt = 1; attempt <= MAX_TRACK_UPDATE_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.track.findUnique({
          where: { slug },
          select: { published: true, audioUrl: true },
        });
        if (!existing) return { status: 'not-found' as const };

        const nextPublished = parsed.data.published ?? existing.published;
        const nextAudioUrl = parsed.data.audioUrl !== undefined ? parsed.data.audioUrl : existing.audioUrl;
        if (nextPublished && !nextAudioUrl) return { status: 'invalid-audio' as const };

        const track = await tx.track.update({
          where: { slug },
          data: trackData,
          include: { credits: true },
        });
        return { status: 'updated' as const, track };
      });

      if (result.status === 'not-found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (result.status === 'invalid-audio') {
        return NextResponse.json(
          { error: 'Validation failed', details: { audioUrl: ['Published tracks require an audio URL'] } },
          { status: 422 },
        );
      }
      return NextResponse.json(result.track);
    } catch (error) {
      if (isRetryableTrackConflict(error) && attempt < MAX_TRACK_UPDATE_ATTEMPTS) continue;
      console.error(error);
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
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
