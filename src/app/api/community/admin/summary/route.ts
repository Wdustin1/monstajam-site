import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { buildCommunityAdminSummary } from '@/lib/community/adminSummary';

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await buildCommunityAdminSummary();
    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load community admin summary' }, { status: 500 });
  }
}
