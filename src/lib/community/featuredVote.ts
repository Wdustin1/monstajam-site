import { z } from 'zod';

export const FEATURED_VOTE_SLUG = 'what-should-monstajam-push-next';

export const FEATURED_VOTE_CAMPAIGN = {
  slug: FEATURED_VOTE_SLUG,
  title: 'Featured Vote',
  question: 'What should MonstaJam push next?',
  description:
    'The first community campaign for shaping what MonstaJam should push next.',
} as const;

export const FEATURED_VOTE_OPTIONS = [
  {
    label: 'Song',
    description: 'Which track should get the next push?',
    sortOrder: 1,
  },
  {
    label: 'Cover art',
    description: 'Which visual should represent the drop?',
    sortOrder: 2,
  },
  {
    label: 'Remix',
    description: 'Which remix idea deserves a lane?',
    sortOrder: 3,
  },
  {
    label: 'Artist',
    description: 'Which artist should MonstaJam spotlight?',
    sortOrder: 4,
  },
  {
    label: 'Future release',
    description: 'What should the community help shape next?',
    sortOrder: 5,
  },
] as const;

export const FeaturedVoteRequestSchema = z.object({
  visitorId: z
    .string()
    .min(8, 'visitorId is required')
    .max(120)
    .regex(/^[a-zA-Z0-9:_-]+$/, 'visitorId contains unsupported characters'),
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
  }>;
  votes: Array<{
    optionId: string;
    visitorId: string;
  }>;
};

export function buildFeaturedVotePayload(
  campaign: FeaturedVoteCampaignRecord,
  visitorId?: string | null
) {
  const voteCounts = campaign.votes.reduce<Record<string, number>>((counts, vote) => {
    counts[vote.optionId] = (counts[vote.optionId] ?? 0) + 1;
    return counts;
  }, {});

  const selectedVote = visitorId
    ? campaign.votes.find((vote) => vote.visitorId === visitorId)
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
      votes: campaign.votes.length,
    },
  };
}
