import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FeaturedVoteRequestSchema, buildFeaturedVotePayload } from '@/lib/community/featuredVote';
import { getActiveVoteCampaignForPublic } from '@/lib/community/voteCampaigns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const visitorId = searchParams.get('visitorId');

  try {
    const campaign = await getActiveVoteCampaignForPublic();
    return NextResponse.json(buildFeaturedVotePayload(campaign, visitorId));
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

    const fanProfile = await prisma.fanProfile.upsert({
      where: { visitorId },
      update: {},
      create: { visitorId },
    });

    await prisma.vote.upsert({
      where: {
        campaignId_visitorId: {
          campaignId: campaign.id,
          visitorId,
        },
      },
      update: {
        optionId: option.id,
        fanProfileId: fanProfile.id,
        creditsSpent: 0,
      },
      create: {
        campaignId: campaign.id,
        optionId: option.id,
        fanProfileId: fanProfile.id,
        visitorId,
        creditsSpent: 0,
      },
    });

    const updatedCampaign = await prisma.voteCampaign.findUniqueOrThrow({
      where: { id: campaign.id },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        votes: { select: { optionId: true, visitorId: true } },
      },
    });

    return NextResponse.json(buildFeaturedVotePayload(updatedCampaign, visitorId));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save featured vote' }, { status: 500 });
  }
}
