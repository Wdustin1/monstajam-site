import assert from 'node:assert/strict';
import test from 'node:test';
import { VoteCampaignStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { saveVoteAndAwardCredits } from '../src/lib/community/rewards';

test('vote writes fail closed inside the transaction when the campaign or option is no longer active', async () => {
  const client = prisma as unknown as Record<string, unknown>;
  const originalTransaction = client.$transaction;
  let mutationCalls = 0;
  let campaignTouch: Record<string, unknown> | undefined;

  const transactionClient = {
    voteCampaign: {
      updateMany: async (args: Record<string, unknown>) => {
        campaignTouch = args;
        return { count: 0 };
      },
      findUnique: async () => {
        throw new Error('campaign title must not be read after a failed authorization touch');
      },
    },
    fanProfile: {
      upsert: async () => {
        mutationCalls += 1;
        return { id: 'fan-id' };
      },
    },
    vote: {
      upsert: async () => {
        mutationCalls += 1;
        return {};
      },
    },
    creditLedger: {
      upsert: async () => {
        mutationCalls += 1;
        return {};
      },
      aggregate: async () => ({ _sum: { amount: 0 } }),
    },
  };

  client.$transaction = async (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient);

  try {
    await assert.rejects(
      saveVoteAndAwardCredits({
        visitorId: 'visitor-id',
        campaignId: 'campaign-id',
        optionId: 'option-id',
      }),
      /active campaign|vote option/i,
    );
    assert.equal(mutationCalls, 0);
    assert.deepEqual(campaignTouch?.where, {
      id: 'campaign-id',
      status: VoteCampaignStatus.ACTIVE,
      options: { some: { id: 'option-id' } },
    });
    assert.ok((campaignTouch?.data as { updatedAt?: unknown })?.updatedAt instanceof Date);
  } finally {
    client.$transaction = originalTransaction;
  }
});
