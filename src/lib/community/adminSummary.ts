import { prisma } from '@/lib/prisma';

export async function buildCommunityAdminSummary() {
  const [campaigns, fanProfiles, totalVotes, creditLedgerRows] = await Promise.all([
    prisma.voteCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        votes: { select: { id: true, optionId: true, visitorId: true, createdAt: true } },
      },
    }),
    prisma.fanProfile.count(),
    prisma.vote.count(),
    prisma.creditLedger.count(),
  ]);

  const campaignSummaries = campaigns.map((campaign) => {
    const totalCampaignVotes = campaign.votes.length;
    const votesByOption = campaign.votes.reduce<Record<string, number>>((counts, vote) => {
      counts[vote.optionId] = (counts[vote.optionId] ?? 0) + 1;
      return counts;
    }, {});

    return {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      question: campaign.question,
      status: campaign.status,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      voteCount: totalCampaignVotes,
      uniqueVisitors: new Set(campaign.votes.map((vote) => vote.visitorId)).size,
      options: campaign.options.map((option) => {
        const voteCount = votesByOption[option.id] ?? 0;
        return {
          id: option.id,
          label: option.label,
          description: option.description ?? '',
          sortOrder: option.sortOrder,
          voteCount,
          votePercent: totalCampaignVotes === 0 ? 0 : Math.round((voteCount / totalCampaignVotes) * 100),
        };
      }),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      campaigns: campaigns.length,
      fanProfiles,
      votes: totalVotes,
      creditLedgerRows,
    },
    campaigns: campaignSummaries,
  };
}

export type CommunityAdminSummary = Awaited<ReturnType<typeof buildCommunityAdminSummary>>;
