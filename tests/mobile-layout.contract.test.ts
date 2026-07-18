import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const banner = read('src/components/AlbumReleaseBanner.tsx');
const hero = read('src/components/Hero.tsx');
const scrollIndicator = read('src/components/ScrollIndicator.tsx');
const songCard = read('src/components/SongCard.tsx');
const communityHub = read('src/components/CommunityHub.tsx');
const musicLibrary = read('src/components/MusicLibrary.tsx');

test('the album release becomes a compact mobile-first card without changing the desktop rail', () => {
  assert.ok(banner.includes('data-mobile-layout="release-banner"'));
  assert.ok(banner.includes('grid-cols-[80px_minmax(0,1fr)]'));
  assert.ok(banner.includes('h-20 w-20'));
  assert.ok(banner.includes('col-span-2'));
  assert.ok(banner.includes('md:grid-cols-[116px_1fr_auto]'));
});

test('the mobile hero becomes a bounded living catalog triptych', () => {
  assert.ok(hero.includes('data-mobile-layout="home-hero"'));
  assert.ok(hero.includes('data-design-concept="living-triptych"'));
  assert.ok(hero.includes('min-h-[calc(100svh-6rem)]'));
  assert.ok(hero.includes('data-hero-stage="catalog-triptych"'));
  assert.ok(hero.includes('grid-template-rows'));
  assert.ok(hero.includes('grid-template-columns'));
  assert.match(scrollIndicator, /className="[^"]*hidden[^"]*md:flex/);
});

test('the mobile triptych hands off directly to the library without stacked hero padding', () => {
  assert.match(hero, /data-mobile-layout="home-hero"[\s\S]*className="[^"]*h-\[calc\(100svh-6rem\)\][^"]*overflow-hidden/);
  assert.match(musicLibrary, /id="library"[\s\S]*className="[^"]*pt-3[^"]*md:pt-8/);
  assert.doesNotMatch(hero, /className="[^"]*\bpb-(6|8|14)\b/);
});

test('homepage tracks use compact media rows on phones and return to cards at the small breakpoint', () => {
  assert.ok(songCard.includes('data-mobile-layout="song-card"'));
  assert.ok(songCard.includes('grid-cols-[88px_minmax(0,1fr)]'));
  assert.ok(songCard.includes('h-[88px] w-[88px]'));
  assert.ok(songCard.includes('sm:flex'));
  assert.ok(songCard.includes('sm:aspect-square'));
  assert.equal(songCard.includes('w-full aspect-square rounded-xl'), false);
});

test('all four community destinations remain visible without horizontal discovery on phones', () => {
  assert.ok(communityHub.includes('data-mobile-layout="community-tabs"'));
  assert.ok(communityHub.includes('grid grid-cols-2'));
  assert.ok(communityHub.includes('sm:flex'));
  assert.ok(communityHub.includes('min-w-0'));
  assert.ok(communityHub.includes('sm:min-w-[132px]'));
});
