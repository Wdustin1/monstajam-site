import { NextRequest, NextResponse } from 'next/server';
import { CommunityVisitorIdSchema } from '@/lib/community/featuredVote';
import { getFanRewards } from '@/lib/community/rewards';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = CommunityVisitorIdSchema.safeParse(searchParams.get('visitorId'));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const rewards = await getFanRewards(parsed.data);
    return NextResponse.json(rewards, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to load community rewards' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
