import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const hub = readFileSync(join(root, 'src/components/CommunityHub.tsx'), 'utf8');
const vote = readFileSync(join(root, 'src/components/FeaturedVote.tsx'), 'utf8');
const rewards = readFileSync(join(root, 'src/components/CommunityRewards.tsx'), 'utf8');
const navbar = readFileSync(join(root, 'src/components/Navbar.tsx'), 'utf8');
const footer = readFileSync(join(root, 'src/components/Footer.tsx'), 'utf8');
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8');

test('community hub is a focused fan surface instead of an internal roadmap dashboard', () => {
  for (const anchor of [
    'Shape the next drop.',
    'data-section-id="community-status-rail"',
    'data-section-id="community-tabs"',
    'handleTabKeyDown',
    "activeTab === 'vote' && <FeaturedVote />",
    "activeTab === 'rewards' && <CommunityRewards />",
    'Join the conversation',
    'Premium listening is on the way',
  ]) {
    assert.ok(hub.includes(anchor), `CommunityHub should include ${anchor}`);
  }

  for (const stale of [
    'HUB_CARDS',
    'HUB_ACTIONS',
    'data-section-id="community-actions"',
    'can become the home base',
    'Admin managed',
    'backstage',
    'preview the premium',
  ]) {
    assert.equal(hub.includes(stale), false, `CommunityHub should remove internal/roadmap surface: ${stale}`);
  }
});

test('featured vote is compact, result-aware, and rolls back failed optimistic votes', () => {
  for (const anchor of [
    'previousSelectedOptionId',
    'previousStoredLabel',
    'localStorage.removeItem(STORAGE_KEY)',
    'role="status"',
    'aria-live="polite"',
    'sm:grid-cols-2',
    'votePercentage',
    'Live vote',
  ]) {
    assert.ok(vote.includes(anchor), `FeaturedVote should include ${anchor}`);
  }

  for (const stale of [
    'Database backed',
    'controlled from the backstage community admin',
    'preview the vote flow',
    'Your device selection is still saved for this preview',
  ]) {
    assert.equal(vote.includes(stale), false, `FeaturedVote should remove internal or misleading copy: ${stale}`);
  }
});

test('rewards surface uses returned recent reward activity', () => {
  for (const anchor of ['Recent activity', 'rewards.recentRewards', 'reward.reason', 'formatRewardDate']) {
    assert.ok(rewards.includes(anchor), `CommunityRewards should render ${anchor}`);
  }
});

test('global mobile interaction and motion defaults meet the launch polish baseline', () => {
  for (const anchor of ['h-11 w-11', 'aria-controls="mobile-navigation"', 'id="mobile-navigation"']) {
    assert.ok(navbar.includes(anchor), `Navbar should include ${anchor}`);
  }

  assert.ok(globals.includes(':focus-visible'), 'global styles should expose a visible keyboard focus treatment');
  assert.ok(
    globals.includes('@media (prefers-reduced-motion: reduce)'),
    'global styles should respect reduced-motion preferences'
  );
  assert.equal(
    footer.includes('Social links coming soon'),
    false,
    'the public footer should omit an unconfigured social placeholder'
  );
});
