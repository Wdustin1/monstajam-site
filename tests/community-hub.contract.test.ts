import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const componentPath = join(root, 'src/components/CommunityHub.tsx');
const featuredVotePath = join(root, 'src/components/FeaturedVote.tsx');
const pagePath = join(root, 'src/app/page.tsx');

test('Community Hub component exists with the required public sections', () => {
  assert.ok(existsSync(componentPath), 'src/components/CommunityHub.tsx should exist');

  const source = readFileSync(componentPath, 'utf8');
  const requiredAnchors = [
    'data-section-id="community-hub"',
    'Vote on Music',
    'Community Chat',
    'Live Vote Campaigns',
    'Rewards / Credits',
    'Premium / Token Access',
    'Coming Soon',
    'WhatsApp',
    'Monsta',
  ];

  for (const anchor of requiredAnchors) {
    assert.ok(source.includes(anchor), `CommunityHub should include ${anchor}`);
  }
});

test('Community Hub exposes real CTA action cards instead of loose placeholders', () => {
  const source = readFileSync(componentPath, 'utf8');
  const requiredCtas = [
    'data-section-id="community-actions"',
    'data-cta-id={action.id}',
    "id: 'vote-track'",
    "href: '#library'",
    'Vote on a track',
    "id: 'join-community'",
    'NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL',
    'Join the community',
    "id: 'live-vote'",
    'Vote in the live poll',
    "id: 'earn-credits'",
    'See credit rules',
    "id: 'premium-access'",
    'Watch premium access',
  ];

  for (const anchor of requiredCtas) {
    assert.ok(source.includes(anchor), `CommunityHub CTA contract should include ${anchor}`);
  }

  assert.equal(
    source.includes('WhatsApp invite coming soon'),
    false,
    'CommunityHub should not rely on the old loose WhatsApp placeholder CTA'
  );

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
});

test('Featured Vote module exists with local frontend vote options', () => {
  assert.ok(existsSync(featuredVotePath), 'src/components/FeaturedVote.tsx should exist');

  const source = readFileSync(featuredVotePath, 'utf8');
  const requiredFeaturedVoteAnchors = [
    "'use client'",
    'data-section-id="featured-vote"',
    'Featured Vote',
    'What should MonstaJam push next?',
    "label: 'Song'",
    "label: 'Cover art'",
    "label: 'Remix'",
    "label: 'Artist'",
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

test('Community Hub renders the Featured Vote before roadmap cards', () => {
  const source = readFileSync(componentPath, 'utf8');

  assert.ok(
    source.includes("import FeaturedVote from '@/components/FeaturedVote';"),
    'CommunityHub should import FeaturedVote'
  );

  const featuredVoteIndex = source.indexOf('<FeaturedVote />');
  const cardsIndex = source.indexOf('{HUB_CARDS.map((card) => (');

  assert.ok(featuredVoteIndex !== -1, 'CommunityHub should render <FeaturedVote />');
  assert.ok(cardsIndex !== -1, 'CommunityHub should render the roadmap cards');
  assert.ok(featuredVoteIndex < cardsIndex, 'FeaturedVote should appear before the roadmap cards');
});

test('homepage imports and renders the Community Hub before the music library', () => {
  const source = readFileSync(pagePath, 'utf8');

  assert.ok(
    source.includes("import CommunityHub from '@/components/CommunityHub';"),
    'homepage should import CommunityHub'
  );

  const hubIndex = source.indexOf('<CommunityHub />');
  const libraryIndex = source.indexOf('<MusicLibrary tracks={tracks} />');

  assert.ok(hubIndex !== -1, 'homepage should render <CommunityHub />');
  assert.ok(libraryIndex !== -1, 'homepage should render <MusicLibrary />');
  assert.ok(hubIndex < libraryIndex, 'CommunityHub should appear before the music library');
});
