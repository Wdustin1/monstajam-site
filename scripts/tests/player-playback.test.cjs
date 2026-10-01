/* Real player component coverage. Audio is a local event-driven test double;
 * jsdom does not fetch media and these tests never contact storage or a DB.
 * Run: npx tsx --test scripts/tests/player-playback.test.cjs
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS sets up the DOM before loading the actual TSX provider. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'Element', 'HTMLElement']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let audio;
class FakeAudio extends EventTarget {
  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- Expose only this local Audio test double to event assertions.
    audio = this;
    this._src = '';
    this._time = 0;
    this.duration = NaN;
    this.paused = true;
    this.ended = false;
    this.playCalls = 0;
    this.rejectPlay = false;
  }
  get src() { return this._src; }
  set src(value) { this._src = value; this._time = 0; this.duration = NaN; this.ended = false; }
  get currentTime() { return this._time; }
  set currentTime(value) { this._time = value; this.ended = false; }
  play() {
    this.playCalls++;
    if (this.rejectPlay) return Promise.reject(new Error('Fixture play rejected'));
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() {
    if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); }
  }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() { this.duration = NaN; this._time = 0; }
  metadata(duration) { this.duration = duration; this.dispatchEvent(new Event('loadedmetadata')); }
  tick(time) { this._time = time; this.dispatchEvent(new Event('timeupdate')); }
  finish() {
    this._time = this.duration;
    this.paused = true;
    this.ended = true;
    this.dispatchEvent(new Event('ended'));
  }
}
globalThis.Audio = FakeAudio;
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const { PlayerProvider, usePlayer } = require('../../src/context/PlayerContext');
const { toPublicTrack } = require('../../src/lib/track-playback');
let player;
let root;
function Probe() { player = usePlayer(); return null; }
const preview = {
  slug: 'fixture-preview', title: 'Preview', artist: 'Fixture', color: '',
  genre: 'Full Songs', playbackMode: 'preview', audioUrl: '/api/audio/fixture-preview',
};
const full = {
  slug: 'fixture-full', title: 'Full', artist: 'Fixture', color: '',
  genre: 'Hip-Hop', playbackMode: 'full', audioUrl: '/api/audio/fixture-full',
};

beforeEach(async () => {
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(PlayerProvider, null, React.createElement(Probe))); });
});
afterEach(async () => { await act(async () => { root.unmount(); }); });
after(() => { dom.window.close(); });

test('preview displays a 45-second timeline and seeks within it even with a longer legacy source', async () => {
  await act(async () => { player.play(preview); audio.metadata(240); audio.tick(22.5); });
  assert.equal(player.duration, 45);
  assert.equal(player.currentTime, 22.5);
  assert.equal(player.progress, 0.5);
  await act(async () => { player.seek(0.9); });
  assert.equal(audio.currentTime, 40.5);
  assert.equal(player.progress, 0.9);
  await act(async () => { player.pause(); player.seek(5); });
  assert.equal(audio.currentTime, 45);
  assert.equal(player.progress, 1);
  await act(async () => { player.play(preview); });
  assert.equal(audio.currentTime, 0);
  assert.equal(player.isPlaying, true);
});

test('preview cutoff advances once using the latest queue, and full mode plays beyond 45 seconds', async () => {
  await act(async () => {
    player.setQueue([preview, full]);
    player.play(preview);
    audio.metadata(240);
    audio.tick(45.1);
  });
  assert.equal(player.currentTrack.slug, full.slug);
  assert.equal(audio.src, full.audioUrl);
  assert.equal(audio.playCalls, 2);
  await act(async () => {
    audio.dispatchEvent(new Event('ended'));
    audio.metadata(240);
    audio.tick(90);
  });
  assert.equal(audio.playCalls, 2);
  assert.equal(player.duration, 240);
  assert.equal(player.currentTime, 90);
  assert.equal(player.isPlaying, true);
});

test('real clip end stops with an empty queue and can replay, while repeat restarts the same clip', async () => {
  await act(async () => { player.play(preview); audio.metadata(30); audio.finish(); });
  assert.equal(player.isPlaying, false);
  assert.equal(player.currentTime, 0);
  assert.equal(player.duration, 30);
  await act(async () => { player.toggle(preview); player.toggleRepeat(); audio.finish(); });
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.playCalls, 3);
  assert.equal(player.isPlaying, true);
});

test('same-song admin full audition switches back to its public preview source and duration', async () => {
  const audition = { ...preview, playbackMode: 'full', audioUrl: `${preview.audioUrl}?full=true` };
  await act(async () => { player.play(audition); audio.metadata(240); audio.tick(120); });
  assert.equal(player.duration, 240);
  await act(async () => { player.toggle(preview); audio.metadata(45); });
  assert.equal(audio.src, preview.audioUrl);
  assert.equal(audio.currentTime, 0);
  assert.equal(player.currentTrack.playbackMode, 'preview');
  assert.equal(player.duration, 45);
});

test('a failed media play does not leave the player claiming it is playing', async () => {
  audio.rejectPlay = true;
  await act(async () => { player.play(preview); });
  assert.equal(player.isPlaying, false);
  assert.equal(player.currentTrack.slug, preview.slug);
});

test('replacing managed audio for the same slug and mode loads the new revision instead of resuming old audio', async () => {
  const first = toPublicTrack({ ...preview, audioAssetId: 'private-first-asset', updatedAt: '2026-01-01T00:00:00Z' });
  const replacement = toPublicTrack({ ...preview, audioAssetId: 'private-replacement-asset', updatedAt: '2026-01-02T00:00:00Z' });
  await act(async () => { player.play(first); audio.metadata(45); audio.tick(20); });
  assert.equal(player.currentTime, 20);
  await act(async () => { player.toggle(replacement); audio.metadata(30); });
  assert.equal(audio.src, replacement.audioUrl);
  assert.notEqual(audio.src, first.audioUrl);
  assert.equal(audio.currentTime, 0);
  assert.equal(player.currentTime, 0);
  assert.equal(player.progress, 0);
  assert.equal(player.duration, 30);
  assert.equal(player.isPlaying, true);
});
