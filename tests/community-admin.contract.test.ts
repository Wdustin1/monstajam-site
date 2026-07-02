import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const helperPath = join(root, 'src/lib/community/adminSummary.ts');
const routePath = join(root, 'src/app/api/community/admin/summary/route.ts');
const campaignRoutePath = join(root, 'src/app/api/community/admin/vote-campaigns/route.ts');
const campaignUpdateRoutePath = join(root, 'src/app/api/community/admin/vote-campaigns/[campaignId]/route.ts');
const componentPath = join(root, 'src/components/CommunityAdminDashboard.tsx');
const pagePath = join(root, 'src/app/upload/community/page.tsx');
const uploadDashboardPath = join(root, 'src/components/UploadDashboard.tsx');
const packagePath = join(root, 'package.json');

test('community admin summary helper returns vote and rewards rollups without artist application intake', () => {
  assert.ok(existsSync(helperPath), 'src/lib/community/adminSummary.ts should exist');

  const source = readFileSync(helperPath, 'utf8');
  const requiredHelperAnchors = [
    'buildCommunityAdminSummary',
    'prisma.voteCampaign.findMany',
    'voteCount',
    'votePercent',
    'fanProfiles',
    'creditLedgerRows',
  ];

  for (const anchor of requiredHelperAnchors) {
    assert.ok(source.includes(anchor), `admin summary helper should include ${anchor}`);
  }

  const forbiddenHelperAnchors = [
    'prisma.artistApplication',
    'applicationStatusCounts',
    'recentApplications',
  ];

  for (const forbidden of forbiddenHelperAnchors) {
    assert.equal(source.includes(forbidden), false, `admin summary helper should not include artist application intake: ${forbidden}`);
  }
});

test('community admin summary API is protected by admin session', () => {
  assert.ok(existsSync(routePath), 'src/app/api/community/admin/summary/route.ts should exist');

  const source = readFileSync(routePath, 'utf8');
  const requiredRouteAnchors = [
    'export async function GET',
    'isAdminRequest',
    'Unauthorized',
    '{ status: 401 }',
    'buildCommunityAdminSummary',
    'Cache-Control',
    'no-store',
  ];

  for (const anchor of requiredRouteAnchors) {
    assert.ok(source.includes(anchor), `admin summary route should include ${anchor}`);
  }
});

test('community admin vote campaign APIs are protected and mutate campaigns', () => {
  assert.ok(existsSync(campaignRoutePath), 'admin vote campaign create route should exist');
  assert.ok(existsSync(campaignUpdateRoutePath), 'admin vote campaign update route should exist');

  const createSource = readFileSync(campaignRoutePath, 'utf8');
  const updateSource = readFileSync(campaignUpdateRoutePath, 'utf8');

  const requiredCreateAnchors = [
    'export async function POST',
    'isAdminRequest',
    'Unauthorized',
    'ManagedVoteCampaignSchema.safeParse',
    'createManagedVoteCampaign',
    '{ status: 201',
  ];

  for (const anchor of requiredCreateAnchors) {
    assert.ok(createSource.includes(anchor), `admin campaign create route should include ${anchor}`);
  }

  const requiredUpdateAnchors = [
    'export async function PATCH',
    'params: Promise<{ campaignId: string }>',
    'ManagedVoteCampaignUpdateSchema.safeParse',
    'updateManagedVoteCampaign',
    'VoteCampaignOptionEditError',
    '{ status: 409 }',
  ];

  for (const anchor of requiredUpdateAnchors) {
    assert.ok(updateSource.includes(anchor), `admin campaign update route should include ${anchor}`);
  }
});

test('community admin dashboard page reads protected summary data', () => {
  assert.ok(existsSync(componentPath), 'src/components/CommunityAdminDashboard.tsx should exist');
  assert.ok(existsSync(pagePath), 'src/app/upload/community/page.tsx should exist');

  const componentSource = readFileSync(componentPath, 'utf8');
  const pageSource = readFileSync(pagePath, 'utf8');
  const requiredComponentAnchors = [
    'Community hub admin',
    '/api/community/admin/summary',
    '/api/community/admin/vote-campaigns',
    "credentials: 'include'",
    'Create vote campaign',
    'Activate',
    'Archive',
    'Vote campaigns',
    'Rewards ledger',
    'Sign in to view community data',
  ];

  for (const anchor of requiredComponentAnchors) {
    assert.ok(componentSource.includes(anchor), `community admin dashboard should include ${anchor}`);
  }

  const forbiddenComponentAnchors = [
    'Artist applications',
    'Recent applications',
    'recentApplications',
    'artistApplications',
    'applicationStatusCounts',
    'public apply form',
  ];

  for (const forbidden of forbiddenComponentAnchors) {
    assert.equal(componentSource.includes(forbidden), false, `community admin dashboard should not include artist application intake: ${forbidden}`);
  }

  assert.ok(pageSource.includes('CommunityAdminDashboard'), 'admin page should render the dashboard component');
  assert.ok(pageSource.includes('Community Hub Admin'), 'admin page should expose a descriptive title');
});

test('backstage dashboard links to the community admin surface', () => {
  const source = readFileSync(uploadDashboardPath, 'utf8');

  assert.ok(source.includes('href="/upload/community"'), 'upload dashboard should link to community admin');
  assert.ok(source.includes('Community'), 'upload dashboard should label the community admin link');
});

test('package exposes a community admin contract test script', () => {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
  assert.equal(
    pkg.scripts?.['test:community-admin'],
    'tsx --test tests/community-admin.contract.test.ts'
  );
});
