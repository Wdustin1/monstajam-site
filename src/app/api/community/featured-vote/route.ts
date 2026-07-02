import { NextRequest, NextResponse } from 'next/server';
import { VoteCampaignStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  FEATURED_VOTE_CAMPAIGN,
  FEATURED_VOTE_OPTIONS,
  FEATURED_VOTE_SLUG,
  FeaturedVoteRequestSchema,
  buildFeaturedVotePayload,
} from '@/lib/community/featuredVote';

async function ensureFeaturedVoteCampaign() {
  const campaign = await prisma.voteCampaign.upsert({
    where: { slug: FEATURED_VOTE_SLUG },
    update: {
      title: FEATURED_VOTE_CAMPAIGN.title,
      question: FEATURED_VOTE_CAMPAIGN.question,
      description: FEATURED_VOTE_CAMPAIGN.description,
      status: VoteCampaignStatus.ACTIVE,
    },
    create: {
      slug: FEATURED_VOTE_CAMPAIGN.slug,
      title: FEATURED_VOTE_CAMPAIGN.title,
      question: FEATURED_VOTE_CAMPAIGN.question,
      description: FEATURED_VOTE_CAMPAIGN.description,
      status: VoteCampaignStatus.ACTIVE,
    },
  });

  for (const option of FEATURED_VOTE_OPTIONS) {
    await prisma.voteOption.upsert({
      where: {
        campaignId_label: {
          campaignId: campaign.id,
          label: option.label,
        },
      },
      update: {
        description: option.description,
        sortOrder: option.sortOrder,
      },
      create: {
        campaignId: campaign.id,
        label: option.label,
        description: option.description,
        sortOrder: option.sortOrder,
      },
    });
  }

  return prisma.voteCampaign.findUniqueOrThrow({
    where: { id: campaign.id },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
      votes: { select: { optionId: true, visitorId: true } },
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const visitorId = searchParams.get('visitorId');

  try {
    const campaign = await ensureFeaturedVoteCampaign();
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
    const campaign = await ensureFeaturedVoteCampaign();
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
