import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { VoteCampaignStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createManagedVoteCampaign, updateManagedVoteCampaign } from '../src/lib/community/voteCampaigns';

test('campaign option edits lock the campaign, count votes without loading them, and return bounded data', () => {
  const source = readFileSync(new URL('../src/lib/community/voteCampaigns.ts', import.meta.url), 'utf8');
  for (const anchor of [
    'lockVoteCampaign',
    'tx.vote.count({ where: { campaignId } })',
    'include: { _count: { select: { votes: true } } }',
  ]) {
    assert.ok(source.includes(anchor), `campaign transitions should include ${anchor}`);
  }
  assert.doesNotMatch(source, /votes:\s*\{\s*select:\s*\{\s*optionId:\s*true,\s*visitorId:\s*true/);
});

test('active campaign creation is one failure-atomic transaction with nested options', async () => {
  const client = prisma as unknown as Record<string, unknown>;
  const originalTransaction = client.$transaction;
  const campaignDelegate = prisma.voteCampaign as unknown as Record<string, unknown>;
  const optionDelegate = prisma.voteOption as unknown as Record<string, unknown>;
  const originals = {
    findUnique: campaignDelegate.findUnique,
    updateMany: campaignDelegate.updateMany,
    create: campaignDelegate.create,
    findUniqueOrThrow: campaignDelegate.findUniqueOrThrow,
    optionCreate: optionDelegate.create,
  };

  let transactionCalls = 0;
  let globalMutationCalls = 0;
  const events: string[] = [];
  let createArgs: { data?: Record<string, unknown> } | undefined;
  const created = {
    id: 'campaign-id',
    slug: 'new-campaign',
    title: 'New Campaign',
    question: 'Which song should go next?',
    description: null,
    status: VoteCampaignStatus.ACTIVE,
    options: [],
    votes: [],
  };

  campaignDelegate.findUnique = async () => null;
  campaignDelegate.updateMany = async () => { globalMutationCalls += 1; return { count: 1 }; };
  campaignDelegate.create = async () => { globalMutationCalls += 1; return created; };
  campaignDelegate.findUniqueOrThrow = async () => created;
  optionDelegate.create = async () => { globalMutationCalls += 1; return {}; };

  const transactionClient = {
    voteCampaign: {
      findUnique: async () => null,
      create: async (args: { data?: Record<string, unknown> }) => {
        events.push('create');
        createArgs = args;
        return created;
      },
      updateMany: async () => { events.push('close'); return { count: 1 }; },
      findUniqueOrThrow: async () => created,
    },
  };
  client.$transaction = async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
    transactionCalls += 1;
    return callback(transactionClient);
  };

  try {
    await createManagedVoteCampaign({
      title: 'New Campaign',
      question: 'Which song should go next?',
      description: '',
      status: VoteCampaignStatus.ACTIVE,
      options: [{ label: 'One', description: '' }, { label: 'Two', description: '' }],
    });

    assert.equal(transactionCalls, 1);
    assert.equal(globalMutationCalls, 0);
    assert.deepEqual(events.slice(0, 2), ['close', 'create']);
    assert.deepEqual(
      (createArgs?.data?.options as { create?: unknown[] } | undefined)?.create?.length,
      2,
    );
  } finally {
    client.$transaction = originalTransaction;
    campaignDelegate.findUnique = originals.findUnique;
    campaignDelegate.updateMany = originals.updateMany;
    campaignDelegate.create = originals.create;
    campaignDelegate.findUniqueOrThrow = originals.findUniqueOrThrow;
    optionDelegate.create = originals.optionCreate;
  }
});

test('campaign updates and option replacement stay inside one transaction', async () => {
  const client = prisma as unknown as Record<string, unknown>;
  const originalTransaction = client.$transaction;
  const campaignDelegate = prisma.voteCampaign as unknown as Record<string, unknown>;
  const optionDelegate = prisma.voteOption as unknown as Record<string, unknown>;
  const originals = {
    findUniqueOrThrow: campaignDelegate.findUniqueOrThrow,
    updateMany: campaignDelegate.updateMany,
    update: campaignDelegate.update,
    optionDeleteMany: optionDelegate.deleteMany,
    optionCreate: optionDelegate.create,
  };
  let transactionCalls = 0;
  let globalMutationCalls = 0;
  const events: string[] = [];
  let updateArgs: { data?: Record<string, unknown> } | undefined;
  const existing = { id: 'campaign-id', votes: [], options: [], status: VoteCampaignStatus.DRAFT };
  const result = { ...existing, title: 'Updated', question: 'Which song should go next?' };

  campaignDelegate.findUniqueOrThrow = async () => existing;
  campaignDelegate.updateMany = async () => { globalMutationCalls += 1; return { count: 1 }; };
  campaignDelegate.update = async () => { globalMutationCalls += 1; return result; };
  optionDelegate.deleteMany = async () => { globalMutationCalls += 1; return { count: 2 }; };
  optionDelegate.create = async () => { globalMutationCalls += 1; return {}; };

  const transactionClient = {
    voteCampaign: {
      findUniqueOrThrow: async (args: { include?: unknown }) => args.include ? result : existing,
      updateMany: async (args: { where?: { id?: unknown } }) => {
        events.push(typeof args.where?.id === 'string' ? 'lock' : 'close');
        return { count: 1 };
      },
      update: async (args: { data?: Record<string, unknown> }) => {
        events.push('update');
        updateArgs = args;
        return result;
      },
    },
    vote: { count: async () => 0 },
  };
  client.$transaction = async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
    transactionCalls += 1;
    return callback(transactionClient);
  };

  try {
    await updateManagedVoteCampaign('campaign-id', {
      status: VoteCampaignStatus.ACTIVE,
      options: [
        { label: 'One', description: '' },
        { label: 'Two', description: '' },
      ],
    });
    assert.equal(transactionCalls, 1);
    assert.equal(globalMutationCalls, 0);
    assert.deepEqual(events.slice(0, 3), ['lock', 'close', 'update']);
    const optionWrite = updateArgs?.data?.options as { create?: unknown[]; deleteMany?: unknown } | undefined;
    assert.equal(optionWrite?.create?.length, 2);
    assert.deepEqual(optionWrite?.deleteMany, {});
  } finally {
    client.$transaction = originalTransaction;
    campaignDelegate.findUniqueOrThrow = originals.findUniqueOrThrow;
    campaignDelegate.updateMany = originals.updateMany;
    campaignDelegate.update = originals.update;
    optionDelegate.deleteMany = originals.optionDeleteMany;
    optionDelegate.create = originals.optionCreate;
  }
});
