import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contentHeaders, getContentMutationAdmin, isContentTrashed, isMissingContentError, trashedContentWhere } from '@/lib/content-trash';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getContentMutationAdmin(request))) {
      return NextResponse.json({ error: 'Sign in to restore this video.' }, { status: 401, headers: contentHeaders });
    }
    const { id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: contentHeaders });
    try {
      const video = await prisma.video.update({
        where: { id, AND: [trashedContentWhere()] },
        data: { published: false, deletedAt: null, deletedBy: null },
      });
      return NextResponse.json(video, { headers: contentHeaders });
    } catch (error) {
      if (!isMissingContentError(error)) throw error;
      const current = await prisma.video.findUnique({ where: { id } });
      if (current && !isContentTrashed(current)) return NextResponse.json(current, { headers: contentHeaders });
      return NextResponse.json({ error: current ? 'This video changed. Refresh Trash before trying again.' : 'Not found' }, { status: current ? 409 : 404, headers: contentHeaders });
    }
  } catch {
    return NextResponse.json({ error: 'Could not restore this video. Refresh Trash before trying again.' }, { status: 503, headers: contentHeaders });
  }
}
