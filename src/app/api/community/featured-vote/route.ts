import { NextRequest, NextResponse } from 'next/server';
import {
  CommunityVisitorIdSchema,
  FeaturedVoteRequestSchema,
  buildFeaturedVotePayload,
} from '@/lib/community/featuredVote';
import { getFanRewards, saveVoteAndAwardCredits } from '@/lib/community/rewards';
import { getActiveVoteCampaignForPublic } from '@/lib/community/voteCampaigns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const visitorId = searchParams.get('visitorId');
  const parsedVisitorId = visitorId ? CommunityVisitorIdSchema.safeParse(visitorId) : null;

  if (parsedVisitorId && !parsedVisitorId.success) {
    return NextResponse.json({ error: 'Invalid visitorId' }, { status: 422 });
  }

  try {
    const campaign = await getActiveVoteCampaignForPublic();
    const rewardsPayload = parsedVisitorId?.success
      ? await getFanRewards(parsedVisitorId.data)
      : { creditsBalance: 0, voteReward: 5, recentRewards: [] };

    return NextResponse.json({
      ...buildFeaturedVotePayload(campaign, visitorId),
      rewards: rewardsPayload,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to load featured vote' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = FeaturedVoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { optionId, visitorId } = parsed.data;

  try {
    const campaign = await getActiveVoteCampaignForPublic();
    const option = campaign.options.find((item) => item.id === optionId);

    if (!option) {
      return NextResponse.json({ error: 'Vote option not found' }, { status: 404 });
    }

    const rewardsPayload = await saveVoteAndAwardCredits({
      visitorId,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      optionId: option.id,
    });

    const updatedCampaign = await getActiveVoteCampaignForPublic();

    return NextResponse.json({
      ...buildFeaturedVotePayload(updatedCampaign, visitorId),
      rewards: rewardsPayload,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save featured vote' }, { status: 500 });
  }
}
