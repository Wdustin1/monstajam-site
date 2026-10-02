/* Real dashboard virtual-DOM tests; all audio storage and HTTP calls are mocked. */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Install the scoped Blob mock before requiring TSX. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/upload' });
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'HTMLAnchorElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'location']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
dom.window.HTMLMediaElement.prototype.pause = function () {};
dom.window.HTMLMediaElement.prototype.load = function () {};
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let objectURLNumber = 0;
URL.createObjectURL = () => `blob:local-audio-fixture-${++objectURLNumber}`;
URL.revokeObjectURL = () => {};
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
let state;
const blobPath = require.resolve('@vercel/blob/client');
const oldBlobModule = require.cache[blobPath];
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  upload: async (pathname, file, options) => {
    state.uploads.push({ pathname, file, options });
    const gate = state.uploadGates[options.access];
    if (gate) await gate.promise;
    return { url: `https://example.invalid/private/${encodeURIComponent(file.name)}` };
  },
} };
const Dashboard = require('../../src/components/UploadDashboard').default;
let root;
let container;
const oldFetch = globalThis.fetch;
const fixtureAdmin = { id: 'owner-fixture', name: 'Fixture Owner', username: 'fixture.owner', role: 'owner' };

function track(slug, additions = {}) {
  return { id: slug, slug, title: slug, artist: 'Fixture Artist', genre: 'Hip-Hop', number: 1,
    bpm: 100, mood: 'Mood', story: null, spotifyUrl: null, appleMusicUrl: null,
    audioUrl: 'https://example.invalid/legacy.mp3', coverUrl: null, published: true,
    createdAt: '2026-01-01T00:00:00Z', ...additions };
}
function button(text, scope = container) {
  const result = [...scope.querySelectorAll('button')].find((node) => node.textContent.trim() === text);
  assert.ok(result, `Missing button ${text}`); return result;
}
function field(label) {
  const wrapper = [...container.querySelectorAll('label')].find((node) => node.querySelector(':scope > span')?.textContent.replace(/\s*\*\s*$/, '').trim() === label);
  assert.ok(wrapper, `Missing field ${label}`); return wrapper.querySelector('input,select,textarea');
}
function fullCheckbox() { return container.querySelector('input[type="checkbox"]'); }
async function click(node) { await act(async () => { node.click(); }); }
async function edit(slug) {
  const row = [...container.querySelectorAll('article')].find((node) => node.querySelector('h3')?.textContent === slug);
  assert.ok(row); await click(button('Edit', row));
}
async function change(label, value) {
  const input = field(label);
  const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function audioFile(name = 'new original.wav', label = 'Replace audio file') {
  const file = new dom.window.File(['fake-audio'], name, { type: 'audio/wav' });
  await chooseFile(label, file);
  return file;
}
async function chooseFile(label, file) {
  const input = field(label);
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  return file;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function newTrack(title = 'New upload fixture') {
  await change('Track title', title);
  await change('Artist', 'New fixture artist');
  const audio = await audioFile('original.wav', 'Audio file');
  const cover = new dom.window.File(['fake-art'], 'artwork.png', { type: 'image/png' });
  await chooseFile('Cover art', cover);
  return { audio, cover };
}
function preflights() { return state.calls.filter((call) => call.input.startsWith('/api/admin/track-title?')); }
function savedMetadata() { return state.calls.filter((call) => call.input === '/api/tracks' && call.method === 'POST'); }
function progress(label = 'Audio upload') { return container.querySelector(`progress[aria-label="${label}"]`); }
function assertNoUploadOrMutation() {
  assert.equal(state.uploads.length, 0);
  assert.equal(state.calls.filter((call) => call.method !== 'GET').length, 0);
}
function assertSelectedFiles(files) {
  assert.equal(field('Audio file').files[0], files.audio);
  assert.equal(field('Cover art').files[0], files.cover);
}
async function uploadProgress(index, percentage) {
  const upload = state.uploads[index];
  assert.equal(typeof upload.options.onUploadProgress, 'function');
  await act(async () => { upload.options.onUploadProgress({ loaded: percentage, total: 100, percentage }); });
}

async function fetchMock(input, init = {}) {
  assert.ok(input.startsWith('/api/'));
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  state.calls.push({ input, method, body });
  if (input === '/api/auth/get-session' && method === 'GET') return Response.json({
    user: { ...fixtureAdmin, accessStatus: 'active', banned: false, authLocked: false },
    session: { id: 'audio-editor-session-fixture', userId: fixtureAdmin.id, expiresAt: '2099-01-01T00:00:00.000Z' },
  });
  if (input === '/api/tracks?all=true') return Response.json(state.tracks);
  if (input === '/api/videos?all=true') return Response.json([]);
  if (input.startsWith('/api/admin/track-title?') && method === 'GET') {
    if (state.preflightGate) await state.preflightGate.promise;
    const response = state.preflightResponses.shift();
    if (response instanceof Error) throw response;
    if (response) return Response.json(response.body, { status: response.status });
    const title = new URL(input, 'http://localhost').searchParams.get('title');
    return Response.json({ available: true, slug: title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') });
  }
  if (input.startsWith('/api/audio-assets/') && method === 'GET') {
    if (state.detailGate) await state.detailGate;
    return Response.json({ id: input.split('/').at(-1), status: 'ready', previewStart: 12.5, previewDuration: 45 });
  }
  if (input === '/api/audio-assets' && method === 'POST') {
    if (state.preparationGate) await state.preparationGate.promise;
    if (state.preparationFailure) { state.preparationFailure = false; return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    return Response.json({ id: 'new-ready-asset', status: 'ready', previewStart: body.previewStart, previewDuration: 45 });
  }
  if (input === '/api/tracks' && method === 'POST') {
    const response = state.metadataResponses.shift();
    if (response) return Response.json(response.body, { status: response.status });
    const saved = track(body.slug, { ...body, id: 'new-fixture-id' });
    state.tracks.push(saved);
    return Response.json(saved, { status: 201 });
  }
  if (input.startsWith('/api/tracks/') && method === 'PUT') {
    if (state.metadataFailure) { state.metadataFailure = false; return Response.json({ error: 'Metadata save failed' }, { status: 500 }); }
    const index = state.tracks.findIndex((row) => row.slug === input.split('/').at(-1));
    state.tracks[index] = { ...state.tracks[index], ...body };
    return Response.json(state.tracks[index]);
  }
  throw new Error(`Unexpected request ${method} ${input}`);
}

beforeEach(async () => {
  state = { calls: [], uploads: [], uploadGates: {}, preflightResponses: [], metadataResponses: [],
    metadataFailure: false, preparationFailure: false, detailGate: null, preflightGate: null, preparationGate: null,
    tracks: [track('legacy-full', { genre: 'Full Songs' }), track('managed', { audioAssetId: 'saved-asset', playbackMode: 'preview', audioUrl: null }), track('legacy-preview')] };
  globalThis.fetch = fetchMock;
  document.body.innerHTML = '<div id="root"></div>';
  container = document.getElementById('root'); root = createRoot(container);
  await act(async () => { root.render(React.createElement(Dashboard, { currentAdmin: fixtureAdmin })); });
});
afterEach(async () => { await act(async () => root.unmount()); globalThis.fetch = oldFetch; });
after(() => {
  if (oldBlobModule) require.cache[blobPath] = oldBlobModule; else delete require.cache[blobPath];
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  dom.window.close();
});

test('new tracks default to preview; genre edits never switch playback mode', async () => {
  assert.equal(fullCheckbox().checked, false);
  await change('Genre', 'Full Songs');
  assert.equal(fullCheckbox().checked, false);
  await edit('legacy-full');
  await click(button('Discard changes'));
  assert.equal(fullCheckbox().checked, true);
  await change('Genre', 'Hip-Hop');
  assert.equal(fullCheckbox().checked, true);
  await click(fullCheckbox());
  assert.equal(fullCheckbox().checked, false);
  await click(button('Save changes'));
  assert.equal(state.tracks[0].playbackMode, 'preview');
});

test('private upload prepares before metadata and retry reuses both original and ready asset', async () => {
  await edit('legacy-preview');
  const file = await audioFile();
  await change('Preview starts at (seconds)', '8.5');
  await click(fullCheckbox());
  state.metadataFailure = true;
  await click(button('Save changes'));
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0].file, file);
  assert.equal(state.uploads[0].options.access, 'private');
  assert.match(state.uploads[0].pathname, /^monstajam\/originals\/[0-9a-f-]{36}-new-original\.wav$/);
  const prepare = state.calls.find((call) => call.input === '/api/audio-assets' && call.method === 'POST');
  assert.equal(prepare.body.previewStart, 8.5);
  assert.equal(prepare.body.originalName, 'new original.wav');
  assert.equal(state.tracks[2].audioAssetId, undefined, 'Failed metadata save replaced the saved track');
  assert.equal(field('Replace audio file').files[0], file);
  await click(button('Retry save'));
  assert.equal(state.uploads.length, 1);
  assert.equal(state.calls.filter((call) => call.input === '/api/audio-assets' && call.method === 'POST').length, 1);
  const saved = state.calls.filter((call) => call.input === '/api/tracks/legacy-preview').at(-1).body;
  assert.equal(saved.audioAssetId, 'new-ready-asset');
  assert.equal(saved.playbackMode, 'full');
  assert.equal('audioUrl' in saved, false);
  assert.equal('originalUrl' in saved, false);
  assert.equal('previewStart' in saved, false);
});

test('managed preview settings load without dirtying the form and can change without reupload', async () => {
  await edit('managed');
  assert.equal(field('Preview starts at (seconds)').value, '12.5');
  assert.equal(container.textContent.includes('Unsaved track changes'), false);
  assert.equal(fullCheckbox().checked, false);
  assert.match(container.querySelector('audio[aria-label="Saved preview"]').src, /\/api\/audio\/managed\?preview=true$/);
  assert.match(container.querySelector('audio[aria-label="Full song (admin only)"]').src, /\/api\/audio\/managed\?full=true$/);
  await change('Preview starts at (seconds)', '20');
  await click(button('Save changes'));
  assert.equal(state.uploads.length, 0);
  const preparation = state.calls.find((call) => call.input === '/api/audio-assets' && call.method === 'POST');
  assert.deepEqual(preparation.body, { audioAssetId: 'saved-asset', previewStart: 20 });
  assert.equal(state.tracks[1].audioAssetId, 'new-ready-asset');
});

test('legacy and managed metadata-only edits preserve their existing audio', async () => {
  await edit('legacy-preview');
  assert.equal(field('Preview starts at (seconds)').disabled, true);
  await change('Mood', 'Metadata only');
  await click(button('Save changes'));
  await edit('managed');
  await click(fullCheckbox());
  await click(button('Save changes'));
  assert.equal(state.uploads.length, 0);
  assert.equal(state.calls.filter((call) => call.input === '/api/audio-assets' && call.method === 'POST').length, 0);
  const updates = state.calls.filter((call) => call.method === 'PUT');
  assert.ok(updates.every((call) => !('audioAssetId' in call.body) && !('audioUrl' in call.body)));
  assert.equal(state.tracks[1].audioAssetId, 'saved-asset');
  assert.equal(state.tracks[1].playbackMode, 'full');
});

test('preparation session expiry retains the selected private original for retry', async () => {
  await edit('legacy-preview');
  const file = await audioFile('retained.wav');
  state.preparationFailure = true;
  await click(button('Save changes'));
  assert.match(container.textContent, /session expired/);
  assert.equal(field('Replace audio file').files[0], file);
  assert.equal(state.calls.filter((call) => call.method === 'PUT').length, 0);
  assert.equal(button('Retry save').disabled, true, 'A known expired session must not start another upload');
  const sessionChecks = state.calls.filter((call) => call.input === '/api/auth/get-session').length;
  await click(button('Retry connection'));
  assert.ok(state.calls.filter((call) => call.input === '/api/auth/get-session').length > sessionChecks);
  assert.equal(field('Replace audio file').files[0], file, 'Session recovery must preserve the selected original');
  assert.equal(button('Retry save').disabled, false);
  await click(button('Retry save'));
  assert.equal(state.uploads.length, 1);
  assert.equal(state.tracks[2].audioAssetId, 'new-ready-asset');
});

test('a late audio detail response cannot overwrite another track editor', async () => {
  let release;
  state.detailGate = new Promise((resolve) => { release = resolve; });
  await edit('managed');
  assert.equal(field('Preview starts at (seconds)').disabled, true);
  await edit('legacy-preview');
  await change('Mood', 'Another track draft');
  await act(async () => { release(); });
  assert.equal(field('Track title').value, 'legacy-preview');
  assert.equal(field('Preview starts at (seconds)').value, '0');
  assert.equal(field('Mood').value, 'Another track draft');
  assert.equal(field('Preview starts at (seconds)').disabled, true);
});

test('a title already in the loaded library blocks uploads locally and retains both selected files', async () => {
  const files = await newTrack('  LEGACY preview !! ');
  await click(button('Add track'));
  assertNoUploadOrMutation();
  assert.equal(preflights().length, 0);
  assertSelectedFiles(files);
  assert.match(field('Track title').closest('label').textContent, /already exists/i);
  assert.equal(field('Track title').matches(':disabled'), false);
});

test('a server-side stale title collision blocks uploads and a corrected title saves the retained files', async () => {
  const files = await newTrack();
  state.preflightResponses.push({ status: 409, body: {
    error: 'This title was just added. Choose another title.', details: { title: ['This title was just added. Choose another title.'] },
  } });
  await click(button('Add track'));
  assertNoUploadOrMutation();
  assert.equal(preflights().length, 1);
  assertSelectedFiles(files);
  assert.match(field('Track title').closest('label').textContent, /This title was just added/);
  await change('Track title', 'Corrected title');
  await click(button('Add track'));
  assert.equal(preflights().length, 2);
  assert.equal(state.uploads.length, 2);
  assert.deepEqual(state.uploads.map((upload) => upload.file), [files.audio, files.cover]);
  assert.equal(savedMetadata().length, 1);
  assert.equal(savedMetadata()[0].body.slug, 'corrected-title');
  assert.equal(field('Track title').value, '');
});

for (const failure of [
  { name: 'temporary server failure', response: { status: 503, body: { error: 'Title check temporarily unavailable. Retry.' } }, message: /Title check temporarily unavailable/ },
  { name: 'expired session', response: { status: 401, body: { error: 'Unauthorized' } }, message: /session expired/i },
  { name: 'network failure', response: new Error('Local simulated network interruption'), message: /title.*check|check.*title/i },
]) {
  test(`a title preflight ${failure.name} retains inputs and never starts an upload`, async () => {
    const files = await newTrack('Keep this title');
    await change('Mood', 'Keep this metadata');
    state.preflightResponses.push(failure.response);
    await click(button('Add track'));
    assertNoUploadOrMutation();
    assertSelectedFiles(files);
    assert.equal(field('Track title').value, 'Keep this title');
    assert.equal(field('Mood').value, 'Keep this metadata');
    assert.match(container.textContent, failure.message);
    if (failure.response instanceof Error) assert.match(container.textContent, /No new files were uploaded\./);
    assert.equal(field('Track title').matches(':disabled'), false);
    if (failure.response.status === 401) {
      assert.equal(button('Retry save').disabled, true);
      await click(button('Retry connection'));
      assertSelectedFiles(files);
      assert.equal(field('Track title').value, 'Keep this title');
      assert.equal(field('Mood').value, 'Keep this metadata');
      assertNoUploadOrMutation();
    }
    await click(button('Retry save'));
    assert.equal(state.uploads.length, 2);
    assert.equal(savedMetadata().length, 1);
  });
}

test('a delayed title preflight locks editing and double submission before any file transfer', async () => {
  await newTrack();
  state.preflightGate = deferred();
  const save = button('Add track');
  await act(async () => { save.click(); save.click(); });
  assert.equal(preflights().length, 1);
  assertNoUploadOrMutation();
  assert.equal(field('Track title').matches(':disabled'), true);
  await act(async () => { state.preflightGate.resolve(); });
  assert.equal(state.uploads.length, 2);
  assert.equal(savedMetadata().length, 1);
});

test('a last-moment save collision permits title correction without reuploading prepared audio or artwork', async () => {
  const files = await newTrack();
  state.metadataResponses.push({ status: 409, body: {
    error: 'A track with this title now exists.', details: { title: ['A track with this title now exists.'] },
  } });
  await click(button('Add track'));
  assert.equal(state.uploads.length, 2);
  assert.equal(savedMetadata().length, 1);
  assertSelectedFiles(files);
  assert.match(field('Track title').closest('label').textContent, /now exists/);
  await change('Track title', 'Available retry title');
  await click(button('Add track'));
  assert.equal(preflights().length, 2);
  assert.equal(state.uploads.length, 2, 'Ready files were unnecessarily transferred again');
  assert.equal(state.calls.filter((call) => call.input === '/api/audio-assets' && call.method === 'POST').length, 1);
  const saved = savedMetadata().at(-1).body;
  assert.equal(saved.slug, 'available-retry-title');
  assert.equal(saved.audioAssetId, 'new-ready-asset');
  assert.equal(saved.coverUrl, 'https://example.invalid/private/artwork.png');
});

test('real upload percentages are separate from preview processing and artwork transfer', async () => {
  await newTrack();
  state.uploadGates.private = deferred();
  state.uploadGates.public = deferred();
  state.preparationGate = deferred();
  await click(button('Add track'));
  assert.equal(state.uploads.length, 1);
  await uploadProgress(0, 50);
  assert.equal(progress().value, 50);
  assert.equal(progress().max, 100);
  assert.match(container.textContent, /Audio upload: 50%/);
  assert.equal(savedMetadata().length, 0);
  await uploadProgress(0, 100);
  assert.equal(progress().value, 100);
  assert.equal(savedMetadata().length, 0, '100% of bytes is not a completed metadata save');
  await act(async () => { state.uploadGates.private.resolve(); });
  assert.equal(progress(), null);
  assert.match(container.textContent, /Preparing the 45-second preview/);
  assert.equal(savedMetadata().length, 0);
  await uploadProgress(0, 72);
  assert.equal(progress(), null, 'Late transfer events cannot overwrite preview processing');
  await act(async () => { state.preparationGate.resolve(); });
  assert.equal(state.uploads.length, 2);
  await uploadProgress(1, 50);
  assert.equal(progress('Artwork upload').value, 50);
  assert.equal(progress(), null);
  await uploadProgress(1, 100);
  assert.equal(progress('Artwork upload').value, 100);
  await act(async () => { state.uploadGates.public.resolve(); });
  assert.equal(container.querySelector('progress'), null);
  assert.equal(savedMetadata().length, 1);
});

test('a failed upload clears its stale percentage and a late callback cannot corrupt the retry', async () => {
  const files = await newTrack();
  state.uploadGates.private = deferred();
  await click(button('Add track'));
  await uploadProgress(0, 50);
  assert.equal(progress().value, 50);
  await act(async () => { state.uploadGates.private.reject(new Error('Local simulated upload interruption')); });
  assert.equal(progress(), null);
  assertSelectedFiles(files);
  assert.equal(savedMetadata().length, 0);
  state.uploadGates.private = deferred();
  await click(button('Retry save'));
  assert.equal(state.uploads.length, 2);
  assert.equal(progress().value, 0);
  await uploadProgress(0, 99);
  assert.equal(progress().value, 0, 'Old upload callback changed the new attempt');
  await uploadProgress(1, 50);
  assert.equal(progress().value, 50);
  await act(async () => { state.uploadGates.private.resolve(); });
  assert.equal(container.querySelector('progress'), null);
  assert.equal(savedMetadata().length, 1);
});

test('editing an existing title keeps its existing URL without running a new-track title preflight', async () => {
  await edit('legacy-preview');
  await change('Track title', 'legacy-full');
  await click(button('Save changes'));
  assert.equal(preflights().length, 0);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.tracks[2].slug, 'legacy-preview');
  assert.equal(state.tracks[2].title, 'legacy-full');
});
