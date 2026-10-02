import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { VideoUpdateSchema } from '@/lib/schemas';
import { activeContentWhere, CONTENT_CHANGED, contentHeaders, getContentMutationAdmin, isContentTrashed, isMissingContentError } from '@/lib/content-trash';

// PUT /api/videos/[id] — update (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: contentHeaders });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: contentHeaders });
  }

  const parsed = VideoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422, headers: contentHeaders }
    );
  }

  const { id } = await params;
  const { expectedUpdatedAt, ...videoInput } = parsed.data;
  try {
    const current = await prisma.video.findUnique({ where: { id }, select: { deletedAt: true, updatedAt: true } });
    if (!current || isContentTrashed(current)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: contentHeaders });
    if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      return NextResponse.json({ error: CONTENT_CHANGED }, { status: 409, headers: contentHeaders });
    }
    const video = await prisma.video.update({ where: { id, updatedAt: current.updatedAt, AND: [activeContentWhere()] }, data: videoInput });
    return NextResponse.json(video, { headers: contentHeaders });
  } catch (err) {
    if (isMissingContentError(err)) {
      try {
        const current = await prisma.video.findUnique({ where: { id }, select: { deletedAt: true } });
        const active = current && !isContentTrashed(current);
        return NextResponse.json({ error: active ? CONTENT_CHANGED : 'Not found' }, { status: active ? 409 : 404, headers: contentHeaders });
      } catch {
        return NextResponse.json({ error: 'Could not check the video. Reload the library before trying again.' }, { status: 503, headers: contentHeaders });
      }
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500, headers: contentHeaders });
  }
}

// DELETE /api/videos/[id] — move to Trash without removing the video metadata
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getContentMutationAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: contentHeaders });
  }

  const { id } = await params;
  try {
    await prisma.video.update({
      where: { id, AND: [activeContentWhere()] },
      data: { published: false, deletedAt: new Date(), deletedBy: admin.username },
    });
    return NextResponse.json({ ok: true }, { headers: contentHeaders });
  } catch (err) {
    if (isMissingContentError(err)) {
      try {
        const current = await prisma.video.findUnique({ where: { id }, select: { deletedAt: true } });
        if (current && isContentTrashed(current)) return NextResponse.json({ ok: true }, { headers: contentHeaders });
        return NextResponse.json({ error: current ? 'This video changed. Refresh the library before trying again.' : 'Not found' }, { status: current ? 409 : 404, headers: contentHeaders });
      } catch {
        return NextResponse.json({ error: 'Could not check Trash. Refresh before trying again.' }, { status: 503, headers: contentHeaders });
      }
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to move video to Trash' }, { status: 500, headers: contentHeaders });
  }
}
