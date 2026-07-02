import { prisma } from '@/lib/prisma';

const APPLICATION_STATUSES = ['NEW', 'REVIEWED', 'APPROVED', 'REJECTED'] as const;

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

function emptyApplicationStatusCounts() {
  return APPLICATION_STATUSES.reduce<Record<ApplicationStatus, number>>((counts, status) => {
    counts[status] = 0;
    return counts;
  }, {} as Record<ApplicationStatus, number>);
}

export async function buildCommunityAdminSummary() {
  const [campaigns, recentApplications, applicationGroups, fanProfiles, totalVotes, creditLedgerRows] =
    await Promise.all([
      prisma.voteCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          options: { orderBy: { sortOrder: 'asc' } },
          votes: { select: { id: true, optionId: true, visitorId: true, createdAt: true } },
        },
      }),
      prisma.artistApplication.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          artistName: true,
          email: true,
          socialUrl: true,
          songUrl: true,
          genre: true,
          message: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.artistApplication.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.fanProfile.count(),
      prisma.vote.count(),
      prisma.creditLedger.count(),
    ]);

  const applicationStatusCounts = emptyApplicationStatusCounts();
  for (const group of applicationGroups) {
    applicationStatusCounts[group.status as ApplicationStatus] = group._count._all;
  }

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
      artistApplications: recentApplications.length,
      applicationStatusCounts,
    },
    campaigns: campaignSummaries,
    recentApplications: recentApplications.map((application) => ({
      id: application.id,
      artistName: application.artistName,
      email: application.email,
      socialUrl: application.socialUrl,
      songUrl: application.songUrl,
      genre: application.genre,
      message: application.message,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
    })),
  };
}

export type CommunityAdminSummary = Awaited<ReturnType<typeof buildCommunityAdminSummary>>;
