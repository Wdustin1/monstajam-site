import { z } from 'zod';

export const FEATURED_VOTE_SLUG = 'what-should-monstajam-push-next';

export const FEATURED_VOTE_CAMPAIGN = {
  slug: FEATURED_VOTE_SLUG,
  title: 'Community Kickoff Vote',
  question: 'What should fans vote on first?',
  description:
    'Choose the first music decision MonstaJam opens to the community. Future campaigns can feature real songs, cover art, remixes, artist spotlights, and upcoming releases.',
} as const;

export const FEATURED_VOTE_OPTIONS = [
  {
    label: 'Song',
    description: 'Open the first fan vote around a real MonstaJam track.',
    sortOrder: 1,
  },
  {
    label: 'Cover art',
    description: 'Let fans choose the visual for an upcoming release.',
    sortOrder: 2,
  },
  {
    label: 'Remix',
    description: 'Let fans choose which remix concept moves forward.',
    sortOrder: 3,
  },
  {
    label: 'Artist spotlight',
    description: 'Let fans choose who the community spotlights.',
    sortOrder: 4,
  },
  {
    label: 'Future release',
    description: 'Let fans choose which unreleased song comes next.',
    sortOrder: 5,
  },
] as const;

export const FeaturedVoteRequestSchema = z.object({
  optionId: z.string().min(1, 'optionId is required').max(120),
});

export type FeaturedVoteRequestInput = z.infer<typeof FeaturedVoteRequestSchema>;

type FeaturedVoteCampaignRecord = {
  id: string;
  slug: string;
  title: string;
  question: string;
  description: string | null;
  status: string;
  options: Array<{
    id: string;
    label: string;
    description: string | null;
    sortOrder: number;
    _count?: { votes: number };
  }>;
  votes: Array<{
    optionId: string;
    visitorId?: string;
  }>;
};

export function buildFeaturedVotePayload(
  campaign: FeaturedVoteCampaignRecord,
  visitorId?: string | null
) {
  const voteCounts = campaign.options.reduce<Record<string, number>>((counts, option) => {
    counts[option.id] = option._count?.votes ?? 0;
    return counts;
  }, {});
  if (campaign.options.every((option) => option._count === undefined)) {
    for (const vote of campaign.votes) {
      voteCounts[vote.optionId] = (voteCounts[vote.optionId] ?? 0) + 1;
    }
  }

  const selectedVote = visitorId
    ? campaign.votes.find((vote) => vote.visitorId === undefined || vote.visitorId === visitorId)
    : undefined;

  const options = [...campaign.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description ?? '',
      sortOrder: option.sortOrder,
      voteCount: voteCounts[option.id] ?? 0,
    }));

  return {
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      question: campaign.question,
      description: campaign.description ?? '',
      status: campaign.status,
    },
    options,
    selectedOptionId: selectedVote?.optionId ?? null,
    totals: {
      votes: options.reduce((total, option) => total + option.voteCount, 0),
    },
  };
}
