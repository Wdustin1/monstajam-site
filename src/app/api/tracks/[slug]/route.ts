import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackUpdateSchema } from '@/lib/schemas';

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
    if (!track) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

  try {
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
