import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const home = read('src/app/page.tsx');
const hero = read('src/components/Hero.tsx');

const mediaAssets = [
  'public/media/monstajam-cinematic-desktop.mp4',
  'public/media/monstajam-cinematic-mobile.mp4',
  'public/media/monstajam-cinematic-desktop.webp',
  'public/media/monstajam-cinematic-mobile.webp',
];

test('the homepage opens as a full-viewport cinematic MonstaJam soundstage', () => {
  assert.ok(hero.includes('data-design-concept="cinematic-soundstage"'));
  assert.ok(hero.includes('data-hero-stage="cinematic-motion"'));
  assert.ok(hero.includes('data-hero-type="monsta-jam"'));
  assert.ok(hero.includes('MONSTA'));
  assert.ok(hero.includes('JAM'));
  assert.ok(hero.includes('Independent sound archive'));
  assert.ok(hero.includes('Enter the archive'));
  assert.equal(hero.includes('VinylRecord'), false);
  assert.equal(hero.includes('data-release-panel'), false);
  assert.equal(home.includes('<AlbumReleaseBanner />'), false);
});

test('the cinematic world uses responsive authored media instead of release artwork', () => {
  assert.ok(hero.includes('data-cinematic-poster="true"'));
  assert.ok(hero.includes('data-cinematic-motion="true"'));
  assert.ok(hero.includes('media="(max-width: 767px)"'));
  assert.ok(hero.includes('/media/monstajam-cinematic-mobile.mp4'));
  assert.ok(hero.includes('/media/monstajam-cinematic-desktop.mp4'));
  assert.ok(hero.includes('/media/monstajam-cinematic-mobile.webp'));
  assert.ok(hero.includes('/media/monstajam-cinematic-desktop.webp'));
  assert.ok(hero.includes('autoPlay'));
  assert.ok(hero.includes('muted'));
  assert.ok(hero.includes('loop'));
  assert.ok(hero.includes('playsInline'));
  assert.ok(hero.includes('preload="metadata"'));

  for (const path of mediaAssets) {
    assert.ok(statSync(join(root, path)).size < 1_500_000, `${path} should stay below 1.5 MB`);
  }
});

test('the cinematic first screen stays brand-first and almost UI free', () => {
  assert.ok(home.includes('<Hero />'));
  assert.ok(hero.includes('href="#library"'));
  assert.ok(hero.includes('Originals / Unreleased / Sessions'));
  assert.equal(hero.includes('trackCount'), false);
  assert.equal(hero.includes('videoCount'), false);
  assert.equal(hero.includes('showcaseTracks'), false);
  assert.equal(hero.includes('PlayerTrack'), false);
  assert.equal(hero.includes('usePlayer'), false);
  assert.equal(hero.includes('<button'), false);
  assert.equal(hero.includes('Cold World'), false);
  assert.equal(hero.includes('Music Videos'), false);
});

test('the soundstage remains one-screen, touch-safe, and motion respectful', () => {
  assert.ok(hero.includes('h-[calc(100svh-6rem)]'));
  assert.ok(hero.includes('motion-reduce:hidden'));
  assert.ok(hero.includes('aria-hidden="true"'));
  assert.ok(hero.includes('tabIndex={-1}'));
  assert.ok(hero.includes('min-h-11'));
});
