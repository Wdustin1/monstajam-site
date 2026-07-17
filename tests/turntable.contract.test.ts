import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const hero = read('src/components/Hero.tsx');
const player = read('src/components/VinylRecord.tsx');
const playerContext = read('src/context/PlayerContext.tsx');

test('the homepage uses the full interactive MonstaJam turntable', () => {
  assert.ok(player.includes('data-turntable-id="hero-turntable"'));
  assert.ok(player.includes('/monstajam-record-label.png'));
  assert.ok(player.includes('getControlledTurntableTrack'));
  assert.ok(player.includes('getTonearmRotation'));
  assert.ok(player.includes('onPointerDown={handlePointerStart}'));
  assert.ok(existsSync(join(root, 'public/monstajam-record-label.png')));
  assert.ok(existsSync(join(root, 'src/components/vinylRecordMotion.ts')));
});

test('the turntable follows media-event playback state instead of optimistic animation', () => {
  assert.ok(playerContext.includes("audio.setAttribute('data-monstajam-player', 'true')"));
  assert.ok(playerContext.includes('const startAudio = useCallback'));
  assert.ok(playerContext.includes("audio.addEventListener('play', handlePlay)"));
  assert.ok(playerContext.includes("audio.addEventListener('pause', handlePause)"));
  assert.equal(playerContext.includes('.then(() => setIsPlaying(true))'), false);
});

test('the larger deck keeps a bounded mobile wrapper and its full desktop dimensions', () => {
  assert.ok(hero.includes('width: 280px; height: 190px;'));
  assert.ok(hero.includes('transform: scale(0.50);'));
  assert.ok(hero.includes('width: 320px; height: 217px;'));
  assert.ok(hero.includes('width: 560px; height: 380px;'));
  assert.ok(hero.includes('@media (min-width: 1280px)'));
});
