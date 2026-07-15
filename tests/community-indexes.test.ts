import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMUNITY_INDEX_SPECS } from '../src/lib/community/indexes';

test('community rollout enumerates every Prisma unique and query index', () => {
  const byName = new Map(COMMUNITY_INDEX_SPECS.map((spec) => [spec.name, spec]));
  const expected = [
    ['fan_profiles_visitorId_key', 'fan_profiles', { visitorId: 1 }, true, undefined],
    ['vote_campaigns_slug_key', 'vote_campaigns', { slug: 1 }, true, undefined],
    ['vote_campaigns_one_active_key', 'vote_campaigns', { status: 1 }, true, { status: 'ACTIVE' }],
    ['vote_options_campaignId_label_key', 'vote_options', { campaignId: 1, label: 1 }, true, undefined],
    ['votes_campaignId_visitorId_key', 'votes', { campaignId: 1, visitorId: 1 }, true, undefined],
    ['votes_optionId_idx', 'votes', { optionId: 1 }, false, undefined],
    ['votes_visitorId_idx', 'votes', { visitorId: 1 }, false, undefined],
    ['credit_ledger_sourceKey_key', 'credit_ledger', { sourceKey: 1 }, true, undefined],
    ['credit_ledger_visitorId_idx', 'credit_ledger', { visitorId: 1 }, false, undefined],
    ['credit_ledger_campaignId_idx', 'credit_ledger', { campaignId: 1 }, false, undefined],
    ['rate_limits_resetAt_ttl', 'rate_limits', { resetAt: 1 }, false, undefined],
  ] as const;

  assert.equal(COMMUNITY_INDEX_SPECS.length, expected.length);
  for (const [name, collection, key, unique, partialFilterExpression] of expected) {
    const spec = byName.get(name);
    assert.ok(spec, name);
    assert.equal(spec.collection, collection);
    assert.deepEqual(spec.key, key);
    assert.equal(Boolean(spec.unique), unique);
    assert.deepEqual(spec.partialFilterExpression, partialFilterExpression);
  }
  assert.equal(byName.get('rate_limits_resetAt_ttl')?.expireAfterSeconds, 0);
});
