import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contentHeaders, getContentMutationAdmin, isContentTrashed, isMissingContentError, trashedContentWhere } from '@/lib/content-trash';

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await getContentMutationAdmin(request))) {
      return NextResponse.json({ error: 'Sign in to restore this track.' }, { status: 401, headers: contentHeaders });
    }
    const { slug } = await params;
    try {
      const track = await prisma.track.update({
        where: { slug, AND: [trashedContentWhere()] },
        data: { published: false, deletedAt: null, deletedBy: null },
        include: { credits: true },
      });
      return NextResponse.json(track, { headers: contentHeaders });
    } catch (error) {
      if (!isMissingContentError(error)) throw error;
      const current = await prisma.track.findUnique({ where: { slug }, include: { credits: true } });
      // A repeat request must not unpublish content already restored and live.
      if (current && !isContentTrashed(current)) return NextResponse.json(current, { headers: contentHeaders });
      return NextResponse.json({ error: current ? 'This track changed. Refresh Trash before trying again.' : 'Not found' }, { status: current ? 409 : 404, headers: contentHeaders });
    }
  } catch {
    return NextResponse.json({ error: 'Could not restore this track. Refresh Trash before trying again.' }, { status: 503, headers: contentHeaders });
  }
}
