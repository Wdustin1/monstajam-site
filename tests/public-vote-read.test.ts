import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma';
import { getActiveVoteCampaignForPublic } from '../src/lib/community/voteCampaigns';

test('public campaign lookup loads only aggregate counts and the signed visitor vote', async () => {
  const delegate = prisma.voteCampaign as unknown as Record<string, unknown>;
  const original = delegate.findFirst;
  let captured: { include?: { options?: unknown; votes?: unknown } } | undefined;
  delegate.findFirst = async (args: typeof captured) => {
    captured = args;
    return {
      id: 'campaign-id',
      slug: 'kickoff',
      title: 'Kickoff',
      question: 'Pick one',
      description: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      options: [
        { id: 'one', campaignId: 'campaign-id', label: 'One', description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), _count: { votes: 123_456 } },
      ],
      votes: [{ optionId: 'one' }],
    };
  };

  try {
    const result = await getActiveVoteCampaignForPublic('signed-visitor-id');
    const votes = captured?.include?.votes as { where?: { visitorId?: string }; select?: Record<string, boolean>; take?: number };
    const options = captured?.include?.options as { include?: { _count?: unknown } };
    assert.equal(votes.where?.visitorId, 'signed-visitor-id');
    assert.equal(votes.take, 1);
    assert.deepEqual(votes.select, { optionId: true });
    assert.ok(options.include?._count);
    assert.equal(result?.options[0]._count.votes, 123_456);
    assert.equal(result?.votes.length, 1);
  } finally {
    delegate.findFirst = original;
  }
});
