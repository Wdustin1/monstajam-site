import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { contentHeaders, isContentTrashed } from '@/lib/content-trash';
import { getVideoPublishingReview } from '@/lib/publishing-review';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminRequest(request))) return NextResponse.json({ error: 'Sign in to review this video.' }, { status: 401, headers: contentHeaders });
    const { id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: contentHeaders });
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video || isContentTrashed(video)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: contentHeaders });
    return NextResponse.json(getVideoPublishingReview(video), { headers: contentHeaders });
  } catch {
    return NextResponse.json({ error: 'Could not check publishing readiness. Please try again.' }, { status: 503, headers: contentHeaders });
  }
}
