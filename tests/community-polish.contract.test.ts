import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const hub = readFileSync(join(root, 'src/components/CommunityHub.tsx'), 'utf8');
const vote = readFileSync(join(root, 'src/components/FeaturedVote.tsx'), 'utf8');
const voteContract = readFileSync(join(root, 'src/lib/community/featuredVote.ts'), 'utf8');
const rewards = readFileSync(join(root, 'src/components/CommunityRewards.tsx'), 'utf8');
const navbar = readFileSync(join(root, 'src/components/Navbar.tsx'), 'utf8');
const footer = readFileSync(join(root, 'src/components/Footer.tsx'), 'utf8');
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8');

test('community hub is a focused fan surface instead of an internal roadmap dashboard', () => {
  for (const anchor of [
    'Vote on the music. Build the community.',
    'data-section-id="community-status-rail"',
    'data-section-id="community-tabs"',
    'handleTabKeyDown',
    "activeTab === 'vote' && <FeaturedVote />",
    "activeTab === 'rewards' && <CommunityRewards />",
    'Community conversations are coming soon',
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
    'then join the conversation around every decision',
  ]) {
    assert.equal(hub.includes(stale), false, `CommunityHub should remove internal/roadmap surface: ${stale}`);
  }
});

test('community voting copy explains the client intent in concrete language', () => {
  for (const anchor of [
    'Vote on the music. Build the community.',
    'songs, cover art, remixes, artist spotlights, and upcoming releases',
  ]) {
    assert.ok(hub.includes(anchor), `CommunityHub should explain ${anchor}`);
  }

  for (const anchor of [
    'Community Kickoff Vote',
    'What should fans vote on first?',
    'Choose the first music decision MonstaJam opens to the community.',
    "label: 'Artist spotlight'",
  ]) {
    assert.ok(voteContract.includes(anchor), `featured vote contract should include ${anchor}`);
  }

  const publicVoteSources = `${hub}\n${vote}\n${voteContract}`;
  for (const vagueCopy of ['What should MonstaJam push next?', 'next push', 'shaping what MonstaJam should push next']) {
    assert.equal(publicVoteSources.includes(vagueCopy), false, `public voting copy should remove vague phrase: ${vagueCopy}`);
  }
});

test('featured vote is compact, result-aware, and rolls back failed optimistic votes', () => {
  for (const anchor of [
    'previousSelectedOptionId',
    'role="status"',
    'aria-live="polite"',
    'sm:grid-cols-2',
    'votePercentage',
    'Live vote',
    'const [loadState',
    'const [loadAttempt',
    "setLoadState('error')",
    "loadState !== 'ready'",
    'Retry live vote',
    'setLoadAttempt',
  ]) {
    assert.ok(vote.includes(anchor), `FeaturedVote should include ${anchor}`);
  }

  assert.equal(vote.includes('localStorage'), false, 'optimistic rollback should not depend on caller-controlled browser identity state');

  for (const stale of [
    'Database backed',
    'controlled from the backstage community admin',
    'preview the vote flow',
    'Your device selection is still saved for this preview',
  ]) {
    assert.equal(vote.includes(stale), false, `FeaturedVote should remove internal or misleading copy: ${stale}`);
  }
});

test('rewards surface uses returned activity and distinguishes loading, error, and empty states', () => {
  for (const anchor of [
    'Recent activity',
    'rewards.recentRewards',
    'reward.reason',
    'formatRewardDate',
    'const [rewardsState',
    "rewardsState === 'loading'",
    "rewardsState === 'error'",
    'Activity is temporarily unavailable',
    'Retry rewards',
    'setRewardsAttempt',
    'No rewards yet. Cast your first vote to start the activity log.',
  ]) {
    assert.ok(rewards.includes(anchor), `CommunityRewards should render ${anchor}`);
  }
});

test('community coming-soon heading fits narrow phone layouts', () => {
  assert.ok(
    hub.includes('data-coming-soon-heading className="mt-2 text-2xl leading-tight'),
    'Coming-soon heading should use a narrow-phone-safe size and line height',
  );
});

test('mobile navigation closes on Escape and returns focus to its trigger', () => {
  for (const anchor of [
    'useEffect',
    'menuButtonRef',
    "event.key === 'Escape'",
    'setMenuOpen(false)',
    'menuButtonRef.current?.focus()',
  ]) {
    assert.ok(navbar.includes(anchor), `Navbar should include ${anchor}`);
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
