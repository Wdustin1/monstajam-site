import assert from 'node:assert/strict';
import { setServers } from 'node:dns';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { verifyVisitorSessionToken } from '../src/lib/community/visitorSession';

dotenv.config({ path: '.env.local', override: true });

const dnsServers = process.env.COMMUNITY_MONGO_DNS_SERVERS
  ?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers?.length) setServers(dnsServers);

const baseUrl = process.env.COMMUNITY_SMOKE_BASE_URL ?? 'http://127.0.0.1:3015';
const prisma = new PrismaClient();
let visitorId: string | null = null;
let visitorCookie: string | null = null;
let ownsVisitorData = false;

type FeaturedVotePayload = {
  options: Array<{ id: string }>;
  selectedOptionId: string | null;
  rewards: {
    creditsBalance: number;
  };
};

type RewardsPayload = {
  creditsBalance: number;
  recentRewards: Array<{ amount: number }>;
};

function storeVisitorCookie(headers: Headers) {
  const cookies = headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    if (!pair.startsWith('monstajam_visitor=')) continue;

    visitorCookie = pair;
    const token = pair.slice('monstajam_visitor='.length);
    const verifiedId = verifyVisitorSessionToken(token);
    assert.ok(verifiedId, 'visitor cookie must have a valid signature from this environment');
    visitorId = verifiedId;
  }
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (visitorCookie) headers.set('Cookie', visitorCookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  storeVisitorCookie(response.headers);
  return response;
}

async function jsonResponse<T>(response: Response) {
  const payload: unknown = await response.json();
  assert.ok(response.ok, `${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  return payload as T;
}

async function cleanup() {
  if (!visitorId || !ownsVisitorData) return;

  await prisma.creditLedger.deleteMany({ where: { visitorId } });
  await prisma.vote.deleteMany({ where: { visitorId } });
  await prisma.fanProfile.deleteMany({ where: { visitorId } });

  const [remainingVotes, remainingRewards, remainingProfiles] = await Promise.all([
    prisma.vote.count({ where: { visitorId } }),
    prisma.creditLedger.count({ where: { visitorId } }),
    prisma.fanProfile.count({ where: { visitorId } }),
  ]);
  assert.deepEqual(
    { remainingVotes, remainingRewards, remainingProfiles },
    { remainingVotes: 0, remainingRewards: 0, remainingProfiles: 0 },
    'smoke data should be cleaned up',
  );
}

async function main() {
  try {
    const initial = await jsonResponse<FeaturedVotePayload>(
      await request('/api/community/featured-vote'),
    );
    assert.ok(visitorCookie && visitorId, 'featured vote should issue a signed visitor cookie');
    assert.ok(initial.options.length >= 2, 'active campaign should expose at least two options');
    assert.equal(initial.rewards.creditsBalance, 0, 'new visitor should start at zero credits');

    const preExistingCounts = await Promise.all([
      prisma.fanProfile.count({ where: { visitorId } }),
      prisma.vote.count({ where: { visitorId } }),
      prisma.creditLedger.count({ where: { visitorId } }),
    ]);
    assert.deepEqual(
      preExistingCounts,
      [0, 0, 0],
      'smoke visitor must not match pre-existing data',
    );
    ownsVisitorData = true;

    const concurrentResponses = await Promise.all(
      initial.options.slice(0, 2).map((option) =>
        request('/api/community/featured-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId: option.id }),
        }),
      ),
    );
    const concurrentVotes = await Promise.all(
      concurrentResponses.map((response) => jsonResponse<FeaturedVotePayload>(response)),
    );
    assert.deepEqual(
      concurrentVotes.map((vote) => vote.rewards.creditsBalance),
      [5, 5],
      'concurrent first votes should both observe one five-credit reward',
    );

    const changedVote = await jsonResponse<FeaturedVotePayload>(
      await request('/api/community/featured-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: initial.options[1].id }),
      }),
    );
    assert.equal(changedVote.selectedOptionId, initial.options[1].id, 'visitor should be able to change the vote');
    assert.equal(changedVote.rewards.creditsBalance, 5, 'changing the vote must not grant more credits');

    const rewards = await jsonResponse<RewardsPayload>(
      await request('/api/community/rewards'),
    );
    assert.equal(rewards.creditsBalance, 5, 'rewards API should return the durable balance');
    assert.equal(rewards.recentRewards.length, 1, 'campaign reward should be idempotent');

    const [profileCount, voteCount, ledgerCount] = await Promise.all([
      prisma.fanProfile.count({ where: { visitorId: visitorId! } }),
      prisma.vote.count({ where: { visitorId: visitorId! } }),
      prisma.creditLedger.count({ where: { visitorId: visitorId! } }),
    ]);
    assert.equal(profileCount, 1, 'one browser visitor should retain one fan profile');
    assert.equal(voteCount, 1, 'one campaign should retain one vote per visitor');
    assert.equal(ledgerCount, 1, 'one campaign should retain one vote reward per visitor');

    console.log(JSON.stringify({
      ok: true,
      concurrentBalances: concurrentVotes.map((vote) => vote.rewards.creditsBalance),
      changedVoteCredits: changedVote.rewards.creditsBalance,
      rewardRows: ledgerCount,
      cleanupVisitorId: visitorId,
    }));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
