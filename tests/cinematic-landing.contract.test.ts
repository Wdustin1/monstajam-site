import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const home = read('src/app/page.tsx');
const hero = read('src/components/Hero.tsx');

test('the homepage opens with a MonstaJam catalog-vault composition', () => {
  assert.ok(hero.includes('data-design-concept="catalog-vault"'));
  assert.ok(hero.includes('data-hero-sleeve="active-vault-pick"'));
  assert.ok(hero.includes('data-hero-type="monsta-jam"'));
  assert.ok(hero.includes('THE VAULT'));
  assert.ok(hero.includes('IS OPEN'));
  assert.ok(hero.includes('DROP THE NEEDLE'));
  assert.ok(hero.includes('<VinylRecord featuredTrack={activeTrack} />'));
  assert.equal(home.includes('<AlbumReleaseBanner />'), false);
});

test('the hero presents several real catalog picks instead of hard-coding one album campaign', () => {
  assert.ok(home.includes('const showcaseTracks'));
  assert.ok(home.includes('showcaseTracks={showcaseTracks}'));
  assert.ok(hero.includes('showcaseTracks?: PlayerTrack[]'));
  assert.ok(hero.includes('setActiveTrackIndex'));
  assert.ok(hero.includes('data-hero-selector="catalog-picks"'));
  assert.ok(hero.includes('aria-pressed={isActive}'));
  assert.ok(hero.includes('proxyCoverUrl(activeTrack?.coverUrl)'));
  assert.ok(hero.includes('activeTrack?.title'));
  assert.ok(hero.includes('activeTrack?.artist'));
  assert.ok(hero.includes('activeTrack?.bpm'));
  assert.equal(hero.includes('/releases/cold-world-volume-2-cover.jpg'), false);
  assert.equal(hero.includes('Cold World'), false);
  assert.equal(hero.includes('MJ-016'), false);
});

test('the first screen removes generic marketing filler and empty statistics', () => {
  assert.equal(hero.includes('Discover the beats and tracks that never made it to the mainstream.'), false);
  assert.equal(hero.includes('Music Videos'), false);
  assert.equal(hero.includes('UNRELEASED.'), false);
});

test('the cinematic composition remains bounded and tactile on phones', () => {
  assert.ok(hero.includes('min-h-[calc(100svh-6rem)]'));
  assert.ok(hero.includes('data-hero-stage="record-launch"'));
  assert.ok(hero.includes('width: 300px; height: 204px;'));
  assert.ok(hero.includes('transform: scale(0.536);'));
  assert.ok(hero.includes('min-h-11'));
});
