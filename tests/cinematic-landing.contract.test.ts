import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const home = read('src/app/page.tsx');
const hero = read('src/components/Hero.tsx');

test('the homepage opens as a full-viewport living catalog triptych', () => {
  assert.ok(hero.includes('data-design-concept="living-triptych"'));
  assert.ok(hero.includes('data-hero-stage="catalog-triptych"'));
  assert.ok(hero.includes('data-release-panel'));
  assert.ok(hero.includes('data-hero-type="monsta-jam"'));
  assert.ok(hero.includes('MONSTA'));
  assert.ok(hero.includes('JAM'));
  assert.ok(hero.includes('Independent sound archive'));
  assert.ok(hero.includes('Tap a release to listen'));
  assert.equal(hero.includes('VinylRecord'), false);
  assert.equal(hero.includes('data-hero-sleeve'), false);
  assert.equal(home.includes('<AlbumReleaseBanner />'), false);
});

test('the hero presents several real catalog picks instead of hard-coding one album campaign', () => {
  assert.ok(home.includes('const showcaseTracks'));
  assert.ok(home.includes('showcaseTracks={showcaseTracks}'));
  assert.ok(hero.includes('showcaseTracks?: PlayerTrack[]'));
  assert.ok(hero.includes('setActiveTrackIndex'));
  assert.ok(hero.includes('activeTrackIndex === index'));
  assert.ok(hero.includes('aria-pressed={isActive}'));
  assert.ok(hero.includes('proxyCoverUrl(track.coverUrl)'));
  assert.ok(hero.includes('track.title'));
  assert.ok(hero.includes('track.artist'));
  assert.ok(hero.includes('toggle(track)'));
  assert.equal(hero.includes('/releases/cold-world-volume-2-cover.jpg'), false);
  assert.equal(hero.includes('Cold World'), false);
  assert.equal(hero.includes('MJ-016'), false);
});

test('the first screen removes generic marketing filler and empty statistics', () => {
  assert.equal(hero.includes('Discover the beats and tracks that never made it to the mainstream.'), false);
  assert.equal(hero.includes('Music Videos'), false);
  assert.equal(hero.includes('UNRELEASED.'), false);
});

test('the triptych remains one-screen, touch-first, and motion respectful on phones', () => {
  assert.ok(hero.includes('min-h-[calc(100svh-6rem)]'));
  assert.ok(hero.includes('triptych-active-none'));
  assert.ok(hero.includes('grid-template-rows'));
  assert.ok(hero.includes('grid-template-columns'));
  assert.ok(hero.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(hero.includes('min-h-11'));
});
