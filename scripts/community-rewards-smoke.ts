import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env.local', override: true });

const baseUrl = process.env.COMMUNITY_SMOKE_BASE_URL ?? 'http://127.0.0.1:3015';
const visitorId = `smoke_${randomUUID()}`;
const prisma = new PrismaClient();

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

async function jsonResponse<T>(response: Response) {
  const payload: unknown = await response.json();
  assert.ok(response.ok, `${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  return payload as T;
}

async function cleanup() {
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
    'smoke data should be cleaned up'
  );
}

async function main() {
  try {
    const initial = await jsonResponse<FeaturedVotePayload>(
      await fetch(`${baseUrl}/api/community/featured-vote?visitorId=${encodeURIComponent(visitorId)}`)
    );
    assert.ok(initial.options.length >= 2, 'active campaign should expose at least two options');
    assert.equal(initial.rewards.creditsBalance, 0, 'new visitor should start at zero credits');

    const concurrentResponses = await Promise.all(
      initial.options.slice(0, 2).map((option) =>
        fetch(`${baseUrl}/api/community/featured-vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId, optionId: option.id }),
        })
      )
    );
    const concurrentVotes = await Promise.all(
      concurrentResponses.map((response) => jsonResponse<FeaturedVotePayload>(response))
    );
    assert.deepEqual(
      concurrentVotes.map((vote) => vote.rewards.creditsBalance),
      [5, 5],
      'concurrent first votes should both observe one five-credit reward'
    );

    const changedVote = await jsonResponse<FeaturedVotePayload>(
      await fetch(`${baseUrl}/api/community/featured-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, optionId: initial.options[1].id }),
      })
    );
    assert.equal(changedVote.selectedOptionId, initial.options[1].id, 'visitor should be able to change the vote');
    assert.equal(changedVote.rewards.creditsBalance, 5, 'changing the vote must not grant more credits');

    const rewards = await jsonResponse<RewardsPayload>(
      await fetch(`${baseUrl}/api/community/rewards?visitorId=${encodeURIComponent(visitorId)}`)
    );
    assert.equal(rewards.creditsBalance, 5, 'rewards API should return the durable balance');
    assert.equal(rewards.recentRewards.length, 1, 'campaign reward should be idempotent');

    const [profileCount, voteCount, ledgerCount] = await Promise.all([
      prisma.fanProfile.count({ where: { visitorId } }),
      prisma.vote.count({ where: { visitorId } }),
      prisma.creditLedger.count({ where: { visitorId } }),
    ]);
    assert.equal(profileCount, 1, 'one browser visitor should retain one fan profile');
    assert.equal(voteCount, 1, 'one campaign should retain one vote per visitor');
    assert.equal(ledgerCount, 1, 'one campaign should retain one vote reward per visitor');

    console.log(JSON.stringify({
      ok: true,
      concurrentBalances: concurrentVotes.map((vote) => vote.rewards.creditsBalance),
      changedVoteCredits: changedVote.rewards.creditsBalance,
      rewardRows: ledgerCount,
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
