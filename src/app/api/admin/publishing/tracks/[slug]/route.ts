import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { contentHeaders, isContentTrashed } from '@/lib/content-trash';
import { getTrackPublishingReview } from '@/lib/publishing-review';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await isAdminRequest(request))) return NextResponse.json({ error: 'Sign in to review this track.' }, { status: 401, headers: contentHeaders });
    const { slug } = await params;
    const track = await prisma.track.findUnique({ where: { slug }, include: { credits: true } });
    if (!track || isContentTrashed(track)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: contentHeaders });
    return NextResponse.json(await getTrackPublishingReview(track), { headers: contentHeaders });
  } catch {
    return NextResponse.json({ error: 'Could not check publishing readiness. Please try again.' }, { status: 503, headers: contentHeaders });
  }
}
