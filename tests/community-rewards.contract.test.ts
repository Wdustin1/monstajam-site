import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const schemaPath = join(root, 'prisma/schema.prisma');
const rewardsHelperPath = join(root, 'src/lib/community/rewards.ts');
const rewardsRoutePath = join(root, 'src/app/api/community/rewards/route.ts');
const featuredVoteRoutePath = join(root, 'src/app/api/community/featured-vote/route.ts');
const featuredVoteComponentPath = join(root, 'src/components/FeaturedVote.tsx');
const communityRewardsComponentPath = join(root, 'src/components/CommunityRewards.tsx');
const communityHubPath = join(root, 'src/components/CommunityHub.tsx');
const adminSummaryPath = join(root, 'src/lib/community/adminSummary.ts');
const adminDashboardPath = join(root, 'src/components/CommunityAdminDashboard.tsx');
const rolloutScriptPath = join(root, 'scripts/community-rewards-rollout.ts');
const rewardsSmokeScriptPath = join(root, 'scripts/community-rewards-smoke.ts');
const packagePath = join(root, 'package.json');

test('credit ledger supports one idempotent reward per campaign and visitor', () => {
  const source = readFileSync(schemaPath, 'utf8');

  assert.ok(source.includes('sourceKey    String       @unique'), 'CreditLedger should have a unique source key');
  assert.match(source, /campaignId\s+String\?\s+@db\.ObjectId/, 'CreditLedger should retain its campaign reference');
});

test('rewards helper atomically saves the vote and idempotent reward while deriving balance from the ledger', () => {
  assert.ok(existsSync(rewardsHelperPath), 'src/lib/community/rewards.ts should exist');
  const source = readFileSync(rewardsHelperPath, 'utf8');

  const requiredAnchors = [
    'VOTE_CREDIT_REWARD = 5',
    'buildVoteRewardSourceKey',
    'saveVoteAndAwardCredits',
    'prisma.$transaction',
    'tx.vote.upsert',
    'tx.creditLedger.upsert',
    'action: CreditAction.VOTE',
    'tx.creditLedger.aggregate',
    'creditsBalance',
    'getFanRewards',
  ];

  for (const anchor of requiredAnchors) {
    assert.ok(source.includes(anchor), `rewards helper should include ${anchor}`);
  }

  assert.equal(source.includes('prisma.fanProfile.update'), false, 'ledger-derived balances should not maintain a stale profile mirror');
});

test('Mongo rollout refuses malformed unique-key data and establishes every community index', () => {
  assert.ok(existsSync(rolloutScriptPath), 'community rewards rollout script should exist');
  const source = readFileSync(rolloutScriptPath, 'utf8');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };

  for (const anchor of ['COMMUNITY_INDEX_SPECS', 'missingKeyQuery', 'assertUniqueDataIsReady', 'countDocuments', 'createIndex', 'unique: spec.unique']) {
    assert.ok(source.includes(anchor), `rollout script should include ${anchor}`);
  }

  assert.equal(pkg.scripts?.['db:community-rewards'], 'tsx scripts/community-rewards-rollout.ts');
});

test('public rewards API uses the signed visitor session and returns a no-store balance payload', () => {
  assert.ok(existsSync(rewardsRoutePath), 'public rewards route should exist');
  const source = readFileSync(rewardsRoutePath, 'utf8');

  for (const anchor of [
    'export async function GET',
    'getOrCreateVisitorSession',
    'attachVisitorSession',
    'getFanRewards',
    "'Cache-Control', 'no-store'",
  ]) {
    assert.ok(source.includes(anchor), `rewards API should include ${anchor}`);
  }
});

test('community rewards smoke follows the signed visitor cookie and cleans the server-issued UUID', () => {
  const source = readFileSync(rewardsSmokeScriptPath, 'utf8');
  for (const anchor of [
    'monstajam_visitor',
    'getSetCookie',
    "headers.set('Cookie'",
    'verifyVisitorSessionToken',
    'ownsVisitorData',
    'smoke visitor must not match pre-existing data',
    "JSON.stringify({ optionId: option.id })",
    "JSON.stringify({ optionId: initial.options[1].id })",
  ]) {
    assert.ok(source.includes(anchor), `rewards smoke should include ${anchor}`);
  }
  assert.equal(source.includes('?visitorId='), false, 'smoke must not send a caller-controlled visitor query');
  assert.equal(source.includes('JSON.stringify({ visitorId'), false, 'smoke must not send a caller-controlled visitor body');
});

test('featured voting grants the campaign reward and returns the current credit balance', () => {
  const routeSource = readFileSync(featuredVoteRoutePath, 'utf8');
  const componentSource = readFileSync(featuredVoteComponentPath, 'utf8');

  for (const anchor of [
    'saveVoteAndAwardCredits',
    'getFanRewards',
    'publicVotePayload',
    'VoteUnavailableError',
    'getVoteCampaignForPublicById',
  ]) {
    assert.ok(routeSource.includes(anchor), `featured vote route should include ${anchor}`);
  }

  assert.equal(routeSource.includes('prisma.vote.upsert'), false, 'route should not save the vote outside the reward transaction');
  assert.doesNotMatch(routeSource, /\/option\|active campaign\//, 'route must not classify arbitrary errors by message text');

  for (const anchor of ['creditsBalance', '+5 credits', 'first vote in each campaign']) {
    assert.ok(componentSource.includes(anchor), `FeaturedVote should explain the live reward: ${anchor}`);
  }
});

test('Rewards tab shows the real balance and only promises live reward actions', () => {
  assert.ok(existsSync(communityRewardsComponentPath), 'CommunityRewards component should exist');
  const rewardsSource = readFileSync(communityRewardsComponentPath, 'utf8');
  const hubSource = readFileSync(communityHubPath, 'utf8');

  for (const anchor of [
    'data-section-id="community-rewards"',
    '/api/community/rewards',
    'Credit balance',
    'First vote in a campaign',
    'Changing your vote does not earn extra credits',
    'Comments, shares, and support rewards are not live yet',
  ]) {
    assert.ok(rewardsSource.includes(anchor), `CommunityRewards should include ${anchor}`);
  }

  assert.ok(hubSource.includes("activeTab === 'rewards' && <CommunityRewards />"), 'Rewards tab should render live rewards');
  assert.equal(hubSource.includes('Fans earn credits by voting, commenting, sharing'), false, 'hub should not claim planned rewards are already live');
  assert.equal(hubSource.includes('spend votes'), false, 'hub should not claim credits can already be spent');
});

test('community admin summary reports issued credits and recent reward rows', () => {
  const helperSource = readFileSync(adminSummaryPath, 'utf8');
  const dashboardSource = readFileSync(adminDashboardPath, 'utf8');

  for (const anchor of ['creditsIssued', 'recentRewards', 'prisma.creditLedger.aggregate', 'prisma.creditLedger.findMany']) {
    assert.ok(helperSource.includes(anchor), `admin summary should include ${anchor}`);
  }

  for (const anchor of ['creditsIssued', 'recentRewards', 'Credits issued', 'Recent reward activity']) {
    assert.ok(dashboardSource.includes(anchor), `admin dashboard should include ${anchor}`);
  }

  assert.equal(
    dashboardSource.includes('Credit rows stay empty until the reward rules are switched on.'),
    false,
    'admin should no longer say rewards are disabled'
  );
});
