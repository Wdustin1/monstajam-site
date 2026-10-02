import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { contentHeaders, trashedContentWhere } from '@/lib/content-trash';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Sign in to view Trash.' }, { status: 401, headers: contentHeaders });
    }
    const [tracks, videos] = await Promise.all([
      prisma.track.findMany({ where: trashedContentWhere(), include: { credits: true }, orderBy: { deletedAt: 'desc' } }),
      prisma.video.findMany({ where: trashedContentWhere(), orderBy: { deletedAt: 'desc' } }),
    ]);
    return NextResponse.json({ tracks, videos }, { headers: contentHeaders });
  } catch {
    return NextResponse.json({ error: 'Could not load Trash. Please try again.' }, { status: 503, headers: contentHeaders });
  }
}
