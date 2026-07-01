import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const componentPath = join(root, 'src/components/CommunityHub.tsx');
const pagePath = join(root, 'src/app/page.tsx');

test('Community Hub component exists with the required public sections', () => {
  assert.ok(existsSync(componentPath), 'src/components/CommunityHub.tsx should exist');

  const source = readFileSync(componentPath, 'utf8');
  const requiredAnchors = [
    'data-section-id="community-hub"',
    'Vote on Music',
    'Community Chat',
    'Artist Hub',
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
    "id: 'apply-artist'",
    'NEXT_PUBLIC_MONSTAJAM_ARTIST_APPLY_URL',
    'Apply as an artist',
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
