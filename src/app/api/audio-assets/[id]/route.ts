import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/auth';
import { audioAssetStatus } from '@/lib/audio-assets';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const { id } = await params;
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  try {
    const asset = await prisma.audioAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
    return NextResponse.json(audioAssetStatus(asset), { headers });
  } catch {
    return NextResponse.json({ error: 'Could not check preview status. Try saving again.' }, { status: 503, headers });
  }
}
