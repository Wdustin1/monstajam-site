import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPlaybackDuration,
  getPlaybackMode,
  isSamePlayback,
  toPublicTrack,
} from '../../src/lib/track-playback';

const track = {
  slug: 'fixture-song',
  title: 'Fixture song',
  artist: 'Fixture artist',
  genre: 'Hip-Hop',
  color: 'bg-purple-500',
  audioUrl: 'https://legacy.example/song.mp3',
};

test('explicit playback mode is independent of genre; only legacy records use the genre fallback', () => {
  assert.equal(getPlaybackMode(track), 'preview');
  assert.equal(getPlaybackMode({ genre: 'Full Songs', playbackMode: null }), 'full');
  assert.equal(getPlaybackMode({ genre: 'Full Songs', playbackMode: 'preview' }), 'preview');
  assert.equal(getPlaybackMode({ genre: 'Hip-Hop', playbackMode: 'full' }), 'full');
  assert.equal(getPlaybackMode({ genre: 'Full Songs', playbackMode: 'unexpected' }), 'preview');
});

test('managed audio uses an encoded application route and strips private fields recursively', () => {
  const record = {
    ...track,
    slug: 'fixture song/#?',
    playbackMode: 'preview',
    audioAssetId: 'private-asset-id',
    audioUrl: 'https://private.example/original.mp3',
    originalPath: 'secret-original-path',
    previewPath: 'secret-preview-path',
    audioAsset: { originalPath: 'secret-relation-path' },
    futurePrivateField: 'secret-future-field',
    credits: [{
      id: 'credit-1', trackId: 'track-1', role: 'Producer', name: 'Fixture producer',
      futurePrivateField: 'secret-credit-field',
    }],
  };
  const result = toPublicTrack(record);
  assert.equal(result.audioUrl, '/api/audio/fixture%20song%2F%23%3F');
  assert.equal(result.playbackMode, 'preview');
  assert.deepEqual(result.credits, [{ id: 'credit-1', trackId: 'track-1', role: 'Producer', name: 'Fixture producer' }]);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /private|secret|originalPath|previewPath|audioAsset|futurePrivateField/);
});

test('legacy tracks keep their existing audio URL and resolved playback behavior', () => {
  const legacy = toPublicTrack({ ...track, genre: 'Full Songs', audioAssetId: null, playbackMode: null, updatedAt: new Date('2026-01-01T00:00:00Z') });
  assert.equal(legacy.audioUrl, track.audioUrl);
  assert.equal(legacy.playbackMode, 'full');
  assert.equal(toPublicTrack({ ...track, playbackMode: 'preview' }).playbackMode, 'preview');
});

test('managed replacements receive a public timestamp revision without exposing asset IDs', () => {
  const first = toPublicTrack({ ...track, audioAssetId: 'private-first-asset', updatedAt: new Date('2026-01-01T00:00:00Z') });
  const same = toPublicTrack({ ...track, audioAssetId: 'private-first-asset', updatedAt: '2026-01-01T00:00:00Z' });
  const replacement = toPublicTrack({ ...track, audioAssetId: 'private-second-asset', updatedAt: '2026-01-02T00:00:00Z' });
  assert.equal(first.audioUrl, `/api/audio/${track.slug}?v=${Date.parse('2026-01-01T00:00:00Z')}`);
  assert.equal(same.audioUrl, first.audioUrl);
  assert.notEqual(replacement.audioUrl, first.audioUrl);
  assert.equal(isSamePlayback(first, replacement), false);
  assert.doesNotMatch(JSON.stringify(replacement), /private-second-asset|audioAssetId/);
  assert.equal(toPublicTrack({ ...track, audioAssetId: 'private-asset', updatedAt: 'invalid' }).audioUrl, `/api/audio/${track.slug}`);
});

test('preview timeline and seeking duration are limited to the available clip', () => {
  assert.equal(getPlaybackDuration({ playbackMode: 'preview' }, 240), 45);
  assert.equal(getPlaybackDuration({ genre: 'Hip-Hop' }, 240), 45);
  assert.equal(getPlaybackDuration({ playbackMode: 'preview' }, 20), 20);
  assert.equal(getPlaybackDuration({ playbackMode: 'full' }, 240), 240);
  assert.equal(getPlaybackDuration({ genre: 'Full Songs' }, 240), 240);
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.equal(getPlaybackDuration({ playbackMode: 'preview' }, duration), 0);
  }
});

test('same-song public preview and full admin audition cannot reuse each other as the current source', () => {
  const preview = { ...track, playbackMode: 'preview', audioUrl: '/api/audio/fixture-song' };
  const audition = { ...preview, playbackMode: 'full', audioUrl: '/api/audio/fixture-song?full=true' };
  assert.equal(isSamePlayback(preview, { ...preview }), true);
  assert.equal(isSamePlayback(null, preview), false);
  assert.equal(isSamePlayback(preview, audition), false);
  assert.equal(isSamePlayback(preview, { ...preview, playbackMode: 'full' }), false);
  assert.equal(isSamePlayback(preview, { ...preview, slug: 'other-song' }), false);
});
