import { NextRequest, NextResponse } from 'next/server';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { credits, ...trackData } = parsed.data as any;

  try {
    const track = await prisma.track.update({
      where: { slug },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...trackData,
        ...(Array.isArray(credits) && {
          credits: { deleteMany: {}, create: credits },
        }),
      } as any,
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
