import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { VideoCreateSchema } from '@/lib/schemas';

// GET /api/videos — list videos
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wantsAll = searchParams.get('all') === 'true';
  const all = wantsAll && await isAdminRequest(req);
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  if (wantsAll && !all) {
    return NextResponse.json({ error: 'Sign in to load the admin library.' }, { status: 401, headers });
  }

  try {
    const videos = await prisma.video.findMany({
      where: all ? {} : { published: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(videos, { headers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500, headers });
  }
}

// POST /api/videos — create video (admin only)
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = VideoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  try {
    const video = await prisma.video.create({ data: parsed.data });
    return NextResponse.json(video, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 });
  }
}
