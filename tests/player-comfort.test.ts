import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLAYER_STORAGE_KEY,
  PREVIEW_CAP_SECONDS,
  getNextTrack,
  getPlaybackDuration,
  getPlaybackProgress,
  getPreviewLabel,
  isPreviewTrack,
  parsePlayerSnapshot,
  readPlayerSnapshot,
  serializePlayerSnapshot,
  writePlayerSnapshot,
} from '../src/lib/player-comfort';

test('preview tracks expose the truthful 45-second playback window', () => {
  const previewTrack = { genre: 'Trap' };

  assert.equal(PREVIEW_CAP_SECONDS, 45);
  assert.equal(isPreviewTrack(previewTrack), true);
  assert.equal(getPlaybackDuration(previewTrack, 227), 45);
  assert.equal(getPlaybackDuration(previewTrack, 0), 45);
  assert.equal(getPlaybackProgress(previewTrack, 22.5, 227), 0.5);
});

test('full songs retain their real duration and short previews are not extended', () => {
  assert.equal(isPreviewTrack({ genre: 'Full Songs' }), false);
  assert.equal(getPlaybackDuration({ genre: 'Full Songs' }, 227), 227);
  assert.equal(getPlaybackDuration({ genre: 'Trap' }, 30), 30);
  assert.equal(getPlaybackProgress({ genre: 'Trap' }, 60, 227), 1);
});

test('player snapshots round-trip safe resume and preference state', () => {
  const snapshot = {
    currentTrack: {
      slug: 'yalla-habibi',
      title: 'Yalla Habibi',
      artist: 'Tyler J',
      color: 'bg-fuchsia-900',
      genre: 'Trap',
      audioUrl: '/audio/yalla-habibi.mp3',
      coverUrl: '/releases/yalla-habibi.jpg',
    },
    queue: [],
    currentTime: 22.5,
    volume: 0.62,
    shuffleOn: true,
    repeatOn: false,
  };

  assert.equal(PLAYER_STORAGE_KEY, 'monstajam-player-state-v1');
  assert.deepEqual(parsePlayerSnapshot(serializePlayerSnapshot(snapshot)), snapshot);
});

test('invalid or unsafe player snapshots fail closed', () => {
  assert.equal(parsePlayerSnapshot('not-json'), null);
  assert.equal(parsePlayerSnapshot(JSON.stringify({ currentTrack: { slug: '' } })), null);
});

test('serialized snapshots keep only playback metadata', () => {
  const noisyTrack = {
    slug: 'yalla-habibi',
    title: 'Yalla Habibi',
    artist: 'Tyler J',
    color: 'bg-fuchsia-900',
    genre: 'Trap',
    audioUrl: '/audio/yalla-habibi.mp3',
    coverUrl: '/releases/yalla-habibi.jpg',
    story: 'A very long lyrics payload that does not belong in browser storage.',
    credits: [{ role: 'Producer', name: 'MonstaJam' }],
    id: 'database-id',
  };

  const serialized = serializePlayerSnapshot({
    currentTrack: noisyTrack,
    queue: [noisyTrack],
    currentTime: 12,
    volume: 0.75,
    shuffleOn: false,
    repeatOn: false,
  });
  const raw = JSON.parse(serialized);

  assert.equal(raw.currentTrack.story, undefined);
  assert.equal(raw.currentTrack.id, undefined);
  assert.equal(raw.queue[0].credits, undefined);
  assert.equal(raw.queue[0].slug, 'yalla-habibi');
});

test('snapshot parsing rejects malformed optional playback fields and unsupported versions', () => {
  const base = {
    version: 1,
    currentTrack: {
      slug: 'yalla-habibi',
      title: 'Yalla Habibi',
      artist: 'Tyler J',
      color: 'bg-fuchsia-900',
      genre: 'Trap',
      audioUrl: '/audio/yalla-habibi.mp3',
      coverUrl: '/releases/yalla-habibi.jpg',
    },
    queue: [],
    currentTime: 4,
    volume: 0.75,
    shuffleOn: false,
    repeatOn: false,
  };

  assert.equal(parsePlayerSnapshot(JSON.stringify({ ...base, version: 2 })), null);
  assert.equal(parsePlayerSnapshot(JSON.stringify({
    ...base,
    currentTrack: { ...base.currentTrack, coverUrl: 42 },
  })), null);
  assert.equal(parsePlayerSnapshot(JSON.stringify({
    ...base,
    currentTrack: { ...base.currentTrack, audioUrl: 'javascript:alert(1)' },
  })), null);
  assert.equal(parsePlayerSnapshot(JSON.stringify({
    ...base,
    currentTrack: { ...base.currentTrack, genre: 12 },
  })), null);
  assert.equal(parsePlayerSnapshot(JSON.stringify({
    ...base,
    currentTrack: { ...base.currentTrack, coverUrl: '/covers/not-next-allowed.jpg' },
  })), null);
  assert.equal(parsePlayerSnapshot(JSON.stringify({
    ...base,
    currentTrack: { ...base.currentTrack, coverUrl: 'https://images.example.com/cover.jpg' },
  })), null);
});

test('storage access failures leave the player functional', () => {
  const snapshot = {
    currentTrack: {
      slug: 'yalla-habibi',
      title: 'Yalla Habibi',
      artist: 'Tyler J',
      color: 'bg-fuchsia-900',
      audioUrl: '/audio/yalla-habibi.mp3',
    },
    queue: [],
    currentTime: 3.5,
    volume: 0.5,
    shuffleOn: false,
    repeatOn: false,
  };
  const deniedStorage = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('quota'); },
  };

  assert.equal(readPlayerSnapshot(deniedStorage), null);
  assert.equal(writePlayerSnapshot(deniedStorage, snapshot), false);
});

test('short previews use their effective duration in user-facing labels', () => {
  assert.equal(getPreviewLabel({ genre: 'Trap' }, 0), '45 sec preview');
  assert.equal(getPreviewLabel({ genre: 'Trap' }, 30), '30 sec preview');
  assert.equal(getPreviewLabel({ genre: 'Full Songs' }, 227), 'Full track');
});

test('shuffle and sequential next never select the active track when alternatives exist', () => {
  const queue = [
    { slug: 'one' },
    { slug: 'two' },
    { slug: 'three' },
  ];

  assert.equal(getNextTrack(queue, 'two', false)?.slug, 'three');
  assert.equal(getNextTrack(queue, 'two', true, () => 0)?.slug, 'one');
  assert.equal(getNextTrack(queue, 'two', true, () => 0.999)?.slug, 'three');
  assert.equal(getNextTrack([{ slug: 'only' }], 'only', true), null);

  const duplicateQueue = [
    { slug: 'active' },
    { slug: 'other' },
    { slug: 'active' },
  ];
  assert.equal(getNextTrack(duplicateQueue, 'active', true, () => 0.999)?.slug, 'other');
});

test('snapshot parsing accepts the safe track shapes allowed by the application schema', () => {
  const parsed = parsePlayerSnapshot(JSON.stringify({
    version: 1,
    currentTrack: {
      slug: '-valid--schema-slug-',
      title: 'Schema-valid title',
      artist: 'Schema-valid artist',
      audioUrl: 'http://media.example.com/track.mp3',
      coverUrl: 'https://assets.blob.vercel-storage.com/cover%25.jpg',
      bpm: 40,
      number: 1,
    },
    queue: [],
    currentTime: 0,
    volume: 0.5,
    shuffleOn: false,
    repeatOn: false,
  }));

  assert.ok(parsed);
  assert.equal(parsed.currentTrack.color, '');
});

test('snapshot parsing rejects duplicate queue slugs', () => {
  const queueTrack = {
    slug: 'duplicate-track',
    title: 'Duplicate Track',
    artist: 'Monsta Jam',
    color: 'bg-violet-500',
  };
  const duplicate = {
    version: 1,
    currentTrack: queueTrack,
    queue: [queueTrack, { ...queueTrack }],
    currentTime: 0,
    volume: 0.75,
    shuffleOn: false,
    repeatOn: false,
  };

  assert.equal(parsePlayerSnapshot(JSON.stringify(duplicate)), null);
});
