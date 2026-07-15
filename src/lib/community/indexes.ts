export type CommunityIndexSpec = {
  collection: string;
  name: string;
  key: Record<string, 1 | -1>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
};

export const COMMUNITY_INDEX_SPECS: readonly CommunityIndexSpec[] = [
  {
    collection: 'fan_profiles',
    name: 'fan_profiles_visitorId_key',
    key: { visitorId: 1 },
    unique: true,
  },
  {
    collection: 'vote_campaigns',
    name: 'vote_campaigns_slug_key',
    key: { slug: 1 },
    unique: true,
  },
  {
    collection: 'vote_campaigns',
    name: 'vote_campaigns_one_active_key',
    key: { status: 1 },
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  },
  {
    collection: 'vote_options',
    name: 'vote_options_campaignId_label_key',
    key: { campaignId: 1, label: 1 },
    unique: true,
  },
  {
    collection: 'votes',
    name: 'votes_campaignId_visitorId_key',
    key: { campaignId: 1, visitorId: 1 },
    unique: true,
  },
  {
    collection: 'votes',
    name: 'votes_optionId_idx',
    key: { optionId: 1 },
  },
  {
    collection: 'votes',
    name: 'votes_visitorId_idx',
    key: { visitorId: 1 },
  },
  {
    collection: 'credit_ledger',
    name: 'credit_ledger_sourceKey_key',
    key: { sourceKey: 1 },
    unique: true,
  },
  {
    collection: 'credit_ledger',
    name: 'credit_ledger_visitorId_idx',
    key: { visitorId: 1 },
  },
  {
    collection: 'credit_ledger',
    name: 'credit_ledger_campaignId_idx',
    key: { campaignId: 1 },
  },
  {
    collection: 'rate_limits',
    name: 'rate_limits_resetAt_ttl',
    key: { resetAt: 1 },
    expireAfterSeconds: 0,
  },
] as const;
