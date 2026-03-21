import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';

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

  try {
    const body = await req.json();
    const { credits, ...trackData } = body;

    const track = await prisma.track.create({
      data: {
        ...trackData,
        credits: credits?.length ? { create: credits } : undefined,
      },
      include: { credits: true },
    });
    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create track' }, { status: 500 });
  }
}
