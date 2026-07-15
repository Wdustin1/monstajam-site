import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const componentPath = join(root, 'src/components/CommunityHub.tsx');
const featuredVotePath = join(root, 'src/components/FeaturedVote.tsx');
const homePagePath = join(root, 'src/app/page.tsx');
const communityPagePath = join(root, 'src/app/community/page.tsx');
const navbarPath = join(root, 'src/components/Navbar.tsx');

test('Community Hub component exists as a focused fan participation surface', () => {
  assert.ok(existsSync(componentPath), 'src/components/CommunityHub.tsx should exist');

  const source = readFileSync(componentPath, 'utf8');
  const requiredAnchors = [
    'data-section-id="community-hub"',
    'Vote on the music. Build the community.',
    'MonstaJam Community',
    'Choose the first vote',
    'One room. Every release.',
    'Listen first',
    'Premium listening is on the way',
    'Monsta access',
  ];

  for (const anchor of requiredAnchors) {
    assert.ok(source.includes(anchor), `CommunityHub should include ${anchor}`);
  }
});

test('Community Hub is tab based instead of rendering every module in one long homepage section', () => {
  const source = readFileSync(componentPath, 'utf8');
  const requiredTabAnchors = [
    "'use client'",
    'data-section-id="community-tabs"',
    'role="tablist"',
    'role="tab"',
    'role="tabpanel"',
    'aria-selected',
    'setActiveTab',
    "id: 'vote'",
    "id: 'talk'",
    "id: 'rewards'",
    "id: 'access'",
  ];

  for (const anchor of requiredTabAnchors) {
    assert.ok(source.includes(anchor), `CommunityHub tab contract should include ${anchor}`);
  }
});

test('Community Hub exposes useful actions and an honest invite fallback', () => {
  const source = readFileSync(componentPath, 'utf8');
  const requiredCtas = [
    "fetch('/api/community/settings'",
    'href={roomSettings.inviteUrl}',
    'Join on {roomSettings.platform}',
    'Invite opening soon',
    'aria-disabled="true"',
    'href="/#library"',
    'Listen first',
  ];

  for (const anchor of requiredCtas) {
    assert.ok(source.includes(anchor), `CommunityHub action contract should include ${anchor}`);
  }

  const forbiddenArtistApplyCopy = [
    'Apply as an artist',
    'apply-artist',
    'NEXT_PUBLIC_MONSTAJAM_ARTIST_APPLY_URL',
    'Artist Hub',
    'artist submissions',
    'Artist action',
    'Drop Requests',
    'Suggest the next drop',
    'request-drop',
  ];

  for (const forbidden of forbiddenArtistApplyCopy) {
    assert.equal(source.includes(forbidden), false, `CommunityHub should not include artist apply copy: ${forbidden}`);
  }

  assert.equal(source.includes('data-section-id="community-actions"'), false, 'hub should not restore the redundant action-card rail');
  assert.equal(source.includes('WhatsApp invite coming soon'), false, 'hub should not rely on the old loose placeholder CTA');
});

test('Featured Vote module exists with local frontend vote options', () => {
  assert.ok(existsSync(featuredVotePath), 'src/components/FeaturedVote.tsx should exist');

  const source = readFileSync(featuredVotePath, 'utf8');
  const requiredFeaturedVoteAnchors = [
    "'use client'",
    'data-section-id="featured-vote"',
    'Community Kickoff Vote',
    'What should fans vote on first?',
    "label: 'Song'",
    "label: 'Cover art'",
    "label: 'Remix'",
    "label: 'Artist spotlight'",
    "label: 'Future release'",
    'monstajam-featured-vote',
    'localStorage.getItem',
    'localStorage.setItem',
    'aria-pressed',
    'Vote saved on this device',
  ];

  for (const anchor of requiredFeaturedVoteAnchors) {
    assert.ok(source.includes(anchor), `FeaturedVote should include ${anchor}`);
  }
});

test('Community route owns the hub and the homepage no longer renders the full hub section', () => {
  assert.ok(existsSync(communityPagePath), 'src/app/community/page.tsx should exist');

  const communityPage = readFileSync(communityPagePath, 'utf8');
  assert.ok(
    communityPage.includes("import CommunityHub from '@/components/CommunityHub';"),
    'community page should import CommunityHub'
  );
  assert.ok(communityPage.includes('<Navbar activeLink="community" />'), 'community page should mark Community nav active');
  assert.ok(communityPage.includes('<CommunityHub />'), 'community page should render <CommunityHub />');

  const homePage = readFileSync(homePagePath, 'utf8');
  assert.equal(
    homePage.includes("import CommunityHub from '@/components/CommunityHub';"),
    false,
    'homepage should not import the full CommunityHub anymore'
  );
  assert.equal(homePage.includes('<CommunityHub />'), false, 'homepage should not render the full CommunityHub anymore');
});

test('Navbar links to the standalone Community page', () => {
  const source = readFileSync(navbarPath, 'utf8');

  assert.ok(source.includes("{ label: 'Community'"), 'navbar should include a Community link');
  assert.ok(source.includes("href: '/community'"), 'navbar Community link should point at /community');
  assert.ok(source.includes("key: 'community'"), 'navbar Community link should expose active key');
});
