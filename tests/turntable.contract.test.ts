import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const hero = read('src/components/Hero.tsx');
const player = read('src/components/VinylRecord.tsx');
const playerContext = read('src/context/PlayerContext.tsx');

test('the interactive MonstaJam turntable remains a complete reusable music control', () => {
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

test('the homepage replaces the turntable wrapper with responsive cinematic media', () => {
  assert.equal(hero.includes('VinylRecord'), false);
  assert.ok(hero.includes('data-hero-stage="cinematic-motion"'));
  assert.ok(hero.includes('<video'));
  assert.ok(hero.includes('motion-reduce:hidden'));
  assert.ok(hero.includes('media="(max-width: 767px)"'));
});
