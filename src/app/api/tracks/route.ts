import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { TrackCreateSchema } from '@/lib/schemas';

// GET /api/tracks — list tracks (published only; admin cookie required for drafts)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const genre = searchParams.get('genre');
  const all = searchParams.get('all') === 'true';

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
    return NextResponse.json(tracks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
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
    genre: trackInput.genre ?? 'Hip-Hop',
    color: trackInput.color ?? 'bg-gradient-to-br from-purple-600 to-blue-500',
    ...(accentCyan != null && { accentCyan }),
  };

  try {
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
