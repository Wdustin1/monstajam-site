import { NextRequest, NextResponse } from 'next/server';
import { getFanRewards } from '@/lib/community/rewards';
import { attachVisitorSession, getOrCreateVisitorSession } from '@/lib/community/visitorSession';

export async function GET(request: NextRequest) {
  let session: ReturnType<typeof getOrCreateVisitorSession>;
  try {
    session = getOrCreateVisitorSession(request);
    const rewards = await getFanRewards(session.visitorId);
    const response = NextResponse.json(rewards);
    response.headers.set('Cache-Control', 'no-store');
    return attachVisitorSession(response, session.newToken);
  } catch (error) {
    console.error('Failed to load community rewards', error);
    return NextResponse.json({ error: 'Unable to load community rewards' }, { status: 500 });
  }
}
