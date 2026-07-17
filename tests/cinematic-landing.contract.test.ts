import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const home = read('src/app/page.tsx');
const hero = read('src/components/Hero.tsx');

test('the homepage opens with one cinematic record-launch composition', () => {
  assert.ok(hero.includes('data-design-concept="cinematic-record-launch"'));
  assert.ok(hero.includes('data-hero-sleeve="cold-world-volume-2"'));
  assert.ok(hero.includes('/releases/cold-world-volume-2-cover.jpg'));
  assert.ok(hero.includes('data-hero-type="monsta-jam"'));
  assert.ok(hero.includes('aria-hidden="true"'));
  assert.ok(hero.includes('MJ-016'));
  assert.ok(hero.includes('DROP THE NEEDLE'));
  assert.ok(hero.includes('<VinylRecord featuredTrack={featuredTrack} />'));
  assert.equal(home.includes('<AlbumReleaseBanner />'), false);
});

test('the first screen replaces generic marketing filler with real catalog context', () => {
  assert.ok(hero.includes('featuredTrack?.title'));
  assert.ok(hero.includes('featuredTrack?.artist'));
  assert.ok(hero.includes('featuredTrack?.bpm'));
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
