import assert from 'node:assert/strict';
import test from 'node:test';
import { TrackCreateSchema } from '../src/lib/schemas';

const baseTrack = {
  title: 'Safe media track',
  artist: 'Monsta Jam',
  slug: 'safe-media-track',
  number: 1,
};

test('track audio accepts HTTP(S), while covers require renderable local or Vercel Blob URLs', () => {
  const trusted = TrackCreateSchema.safeParse({
    ...baseTrack,
    audioUrl: 'http://media.example.com/track.mp3',
    coverUrl: ' https://ASSETS.blob.vercel-storage.com:443/covers/../cover%20art.jpg ',
  });
  assert.equal(trusted.success, true);
  if (!trusted.success) assert.fail('trusted cover should parse');
  assert.equal(trusted.data.coverUrl, 'https://assets.blob.vercel-storage.com/cover%20art.jpg');

  for (const coverUrl of ['/monstajam-logo.png', '/monstajam-record-label.png', '/releases/cover.jpg']) {
    const local = TrackCreateSchema.safeParse({ ...baseTrack, coverUrl });
    assert.equal(local.success, true);
    if (local.success) assert.equal(local.data.coverUrl, coverUrl);
  }

  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, audioUrl: '', coverUrl: '' }).success, true);
  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, audioUrl: 'ftp://media.example.com/track.mp3' }).success, false);
  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, coverUrl: 'http://assets.blob.vercel-storage.com/cover.jpg' }).success, false);
  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, coverUrl: 'https://images.example.com/cover.jpg' }).success, false);
  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, coverUrl: 'javascript:alert(1)' }).success, false);
});
