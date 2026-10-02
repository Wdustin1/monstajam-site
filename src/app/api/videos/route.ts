import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { VideoCreateSchema } from '@/lib/schemas';
import { activeContentWhere, contentHeaders } from '@/lib/content-trash';
import { publishingError, SAVE_DRAFT_FIRST } from '@/lib/publishing-review';

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
      where: { AND: [activeContentWhere()], ...(!all && { published: true }) },
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: contentHeaders });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: contentHeaders });
  }

  const parsed = VideoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422, headers: contentHeaders }
    );
  }

  if (parsed.data.published === true) return NextResponse.json(publishingError(SAVE_DRAFT_FIRST), { status: 422, headers: contentHeaders });

  try {
    const video = await prisma.video.create({ data: { ...parsed.data, published: false } });
    return NextResponse.json(video, { status: 201, headers: contentHeaders });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500, headers: contentHeaders });
  }
}
