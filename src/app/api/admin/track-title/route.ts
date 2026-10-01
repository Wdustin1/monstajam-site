import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TrackCreateSchema } from '@/lib/schemas';
import { slugifyTrackTitle, TRACK_TITLE_CONFLICT, trackTitleError } from '@/lib/track-title';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Keep this endpoint outside /api/tracks/[slug] so every track slug stays usable.
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET(request: NextRequest) {
  try {
    // Check identity before validating or looking up a title, so this endpoint
    // cannot reveal which URLs belong to unpublished tracks.
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Sign in to check the track title.' }, { status: 401, headers });
    }
    const parsed = TrackCreateSchema.shape.title.safeParse(request.nextUrl.searchParams.get('title') ?? '');
    if (!parsed.success) {
      return NextResponse.json(trackTitleError(parsed.error.issues[0]?.message ?? 'Enter a valid track title.'), { status: 422, headers });
    }
    const slug = slugifyTrackTitle(parsed.data);
    if (!slug) {
      return NextResponse.json(trackTitleError('Include at least one letter (A–Z) or number in a new track title.'), { status: 422, headers });
    }
    const existing = await prisma.track.findUnique({ where: { slug }, select: { id: true } });
    if (existing) return NextResponse.json(trackTitleError(TRACK_TITLE_CONFLICT), { status: 409, headers });
    return NextResponse.json({ slug, available: true }, { headers });
  } catch {
    return NextResponse.json({ error: 'The track title could not be checked. Please try again before uploading.' }, { status: 503, headers });
  }
}
