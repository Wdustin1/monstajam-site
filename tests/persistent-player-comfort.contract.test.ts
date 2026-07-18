import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const playerSource = readFileSync('src/components/PersistentPlayer.tsx', 'utf8');

test('persistent player presents real artwork and a linked track identity', () => {
  assert.match(playerSource, /import Image from 'next\/image'/);
  assert.match(playerSource, /proxyCoverUrl\(track\.coverUrl\)/);
  assert.match(playerSource, /href={`\/tracks\/\$\{displayTrack\.slug\}`}/);
});

test('persistent player names preview playback truthfully', () => {
  assert.match(playerSource, /getPreviewLabel\(currentTrack, duration\)/);
  assert.doesNotMatch(playerSource, /const previewLabel = isPreviewTrack\(currentTrack\) \? '45 sec preview'/);
});

test('persistent player supports compact and expanded modes without covering a newly selected release', () => {
  assert.match(playerSource, /const \[isCompact, setIsCompact\] = useState\(true\)/);
  assert.match(playerSource, /data-player-mode={isCompact \? 'compact' : 'expanded'}/);
  assert.match(playerSource, /aria-label="Minimize player"/);
  assert.match(playerSource, /aria-label="Expand player"/);
});

test('persistent player stays out of the living triptych and returns after the hero leaves view', () => {
  assert.match(playerSource, /data-design-concept="living-triptych"/);
  assert.match(playerSource, /getBoundingClientRect\(\)/);
  assert.match(playerSource, /window\.addEventListener\('scroll', updateHeroVisibility/);
  assert.match(playerSource, /new MutationObserver\(updateHeroVisibility\)/);
  assert.match(playerSource, /setHeroInView\(rect\.bottom > viewThreshold && rect\.top < window\.innerHeight - viewThreshold\)/);
  assert.match(playerSource, /display: heroInView \? 'none' : undefined/);
});

test('persistent player exposes an accessible Up Next queue', () => {
  assert.match(playerSource, /queue, isPlaying/);
  assert.match(playerSource, /aria-controls="player-up-next"/);
  assert.match(playerSource, /aria-expanded={queueOpen}/);
  assert.match(playerSource, /id="player-up-next"/);
  assert.match(playerSource, />Up Next</);
});

test('expanded mobile player keeps every control and track link at least 44px tall', () => {
  const mobileSection = playerSource.match(/<div className="md:hidden[\s\S]*?<div className="mx-auto hidden/)?.[0] ?? '';
  assert.ok(mobileSection);
  assert.doesNotMatch(mobileSection, /h-10 w-10/);
  assert.match(mobileSection, /min-h-11/);
  assert.match(playerSource, /className="group absolute -top-10 left-0 z-10 h-11[^"]*"[\s\S]*?aria-label="Playback position"/);
  assert.match(playerSource, /type="range"[\s\S]*?className="h-11 w-14/);
});

test('Up Next moves focus into the drawer and restores it when closed', () => {
  assert.match(playerSource, /queueTriggerRef/);
  assert.match(playerSource, /queueCloseRef/);
  assert.match(playerSource, /queueCloseRef\.current\?\.focus\(\)/);
  assert.match(playerSource, /queueTriggerRef\.current\?\.focus\(\)/);
  assert.match(playerSource, /ref={queueCloseRef}/);
});

test('minimizing the player moves focus to the compact expand control', () => {
  assert.match(playerSource, /compactExpandRef/);
  assert.match(playerSource, /compactExpandRef\.current\?\.focus\(\)/);
  assert.match(playerSource, /ref={compactExpandRef}/);
});
