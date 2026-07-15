import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const schemaPath = join(root, 'prisma/schema.prisma');
const helperPath = join(root, 'src/lib/community/featuredVote.ts');
const campaignHelperPath = join(root, 'src/lib/community/voteCampaigns.ts');
const routePath = join(root, 'src/app/api/community/featured-vote/route.ts');
const kickoffRolloutPath = join(root, 'scripts/community-kickoff-campaign.ts');
const packagePath = join(root, 'package.json');

test('Prisma schema defines the community hub persistence layer', () => {
  const source = readFileSync(schemaPath, 'utf8');
  const requiredSchemaAnchors = [
    'enum VoteCampaignStatus',
    'enum CreditAction',
    'model FanProfile',
    'visitorId      String         @unique',
    'model VoteCampaign',
    'slug        String             @unique',
    'status      VoteCampaignStatus @default(DRAFT)',
    '@@map("vote_campaigns")',
    'model VoteOption',
    '@@unique([campaignId, label])',
    'model Vote',
    '@@unique([campaignId, visitorId])',
    'model CreditLedger',
  ];

  for (const anchor of requiredSchemaAnchors) {
    assert.ok(source.includes(anchor), `schema should include ${anchor}`);
  }

  const forbiddenSchemaAnchors = [
    'enum ArtistApplicationStatus',
    'model ArtistApplication',
    'artistApplications',
    'ARTIST_APPLICATION',
    '@@map("artist_applications")',
    'creditsBalance Int',
  ];

  for (const forbidden of forbiddenSchemaAnchors) {
    assert.equal(source.includes(forbidden), false, `schema should not include artist apply persistence: ${forbidden}`);
  }
});

test('Featured vote helper defines the first database-backed campaign contract', () => {
  assert.ok(existsSync(helperPath), 'src/lib/community/featuredVote.ts should exist');

  const source = readFileSync(helperPath, 'utf8');
  const requiredHelperAnchors = [
    'FEATURED_VOTE_SLUG',
    'what-should-monstajam-push-next',
    'FEATURED_VOTE_OPTIONS',
    "label: 'Song'",
    "label: 'Cover art'",
    "label: 'Remix'",
    "label: 'Artist spotlight'",
    "label: 'Future release'",
    'FeaturedVoteRequestSchema',
    'buildFeaturedVotePayload',
    'selectedOptionId',
    'voteCount',
  ];

  for (const anchor of requiredHelperAnchors) {
    assert.ok(source.includes(anchor), `featured vote helper should include ${anchor}`);
  }
});

test('Managed vote campaign helper supports admin-created active polls', () => {
  assert.ok(existsSync(campaignHelperPath), 'src/lib/community/voteCampaigns.ts should exist');

  const source = readFileSync(campaignHelperPath, 'utf8');
  const requiredManagedCampaignAnchors = [
    'ManagedVoteCampaignSchema',
    'ManagedVoteCampaignUpdateSchema',
    'getActiveVoteCampaignForPublic',
    'createManagedVoteCampaign',
    'updateManagedVoteCampaign',
    'closeOtherActiveCampaigns',
    'VoteCampaignOptionEditError',
  ];

  for (const anchor of requiredManagedCampaignAnchors) {
    assert.ok(source.includes(anchor), `managed vote campaign helper should include ${anchor}`);
  }
});

test('default campaign initialization is create-only and never rewrites a legacy campaign with votes', () => {
  const source = readFileSync(campaignHelperPath, 'utf8');
  const defaultStart = source.indexOf('export async function ensureDefaultFeaturedVoteCampaign');
  const defaultEnd = source.indexOf('export async function getVoteCampaignWithOptionsAndVotes', defaultStart);
  const defaultInitializer = source.slice(defaultStart, defaultEnd);
  const publicStart = source.indexOf('export async function getActiveVoteCampaignForPublic');
  const publicEnd = source.indexOf('export async function createManagedVoteCampaign', publicStart);
  const publicSelector = source.slice(publicStart, publicEnd);
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };

  for (const anchor of [
    'update: {}',
    'options: {',
    'create: FEATURED_VOTE_OPTIONS.map',
  ]) {
    assert.ok(defaultInitializer.includes(anchor), `default initializer should include ${anchor}`);
  }

  assert.equal(defaultInitializer.includes('prisma.voteOption.upsert'), false, 'existing campaign options must never be upserted by fallback initialization');
  assert.ok(publicSelector.includes('seeded.status !== VoteCampaignStatus.ACTIVE'), 'a closed legacy campaign must not be reactivated automatically');
  assert.equal(publicSelector.includes('prisma.voteCampaign.update'), false, 'public fallback must never mutate an existing campaign');
  assert.equal(existsSync(kickoffRolloutPath), false, 'the completed one-time semantic rewrite script must not remain runnable');
  assert.equal(pkg.scripts?.['db:community-kickoff'], undefined, 'the completed semantic rewrite command must be removed');
});

test('Featured vote API exposes GET and POST handlers against the active campaign', () => {
  assert.ok(existsSync(routePath), 'src/app/api/community/featured-vote/route.ts should exist');

  const source = readFileSync(routePath, 'utf8');
  const requiredRouteAnchors = [
    'export async function GET',
    'export async function POST',
    'getActiveVoteCampaignForPublic',
    'saveVoteAndAwardCredits',
    'FeaturedVoteRequestSchema.safeParse',
    'getOrCreateVisitorSession',
    'Invalid vote',
  ];

  for (const anchor of requiredRouteAnchors) {
    assert.ok(source.includes(anchor), `featured vote route should include ${anchor}`);
  }
});

test('package exposes a community database contract test script', () => {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
  assert.equal(
    pkg.scripts?.['test:community-db'],
    'tsx --test tests/community-db.contract.test.ts'
  );
});
