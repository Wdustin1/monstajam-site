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
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
let state;
const blobPath = require.resolve('@vercel/blob/client');
const oldBlobModule = require.cache[blobPath];
require.cache[blobPath] = { id: blobPath, filename: blobPath, loaded: true, exports: {
  upload: async (pathname, file, options) => {
    state.uploads.push({ pathname, file, options });
    return { url: `https://example.invalid/private/${encodeURIComponent(file.name)}` };
  },
} };
const Dashboard = require('../../src/components/UploadDashboard').default;
let root;
let container;
const oldFetch = globalThis.fetch;

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
async function audioFile(name = 'new original.wav') {
  const file = new dom.window.File(['fake-audio'], name, { type: 'audio/wav' });
  const input = field('Replace audio file');
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  return file;
}

async function fetchMock(input, init = {}) {
  assert.ok(input.startsWith('/api/'));
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  state.calls.push({ input, method, body });
  if (input === '/api/tracks?all=true') return Response.json(state.tracks);
  if (input === '/api/videos?all=true') return Response.json([]);
  if (input.startsWith('/api/audio-assets/') && method === 'GET') {
    if (state.detailGate) await state.detailGate;
    return Response.json({ id: input.split('/').at(-1), status: 'ready', previewStart: 12.5, previewDuration: 45 });
  }
  if (input === '/api/audio-assets' && method === 'POST') {
    if (state.preparationFailure) { state.preparationFailure = false; return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    return Response.json({ id: 'new-ready-asset', status: 'ready', previewStart: body.previewStart, previewDuration: 45 });
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
  state = { calls: [], uploads: [], metadataFailure: false, preparationFailure: false, detailGate: null,
    tracks: [track('legacy-full', { genre: 'Full Songs' }), track('managed', { audioAssetId: 'saved-asset', playbackMode: 'preview', audioUrl: null }), track('legacy-preview')] };
  globalThis.fetch = fetchMock;
  document.body.innerHTML = '<div id="root"></div>';
  container = document.getElementById('root'); root = createRoot(container);
  await act(async () => { root.render(React.createElement(Dashboard, { currentAdmin: { id: 'owner-fixture', name: 'Fixture Owner', email: 'owner@example.invalid', role: 'owner' } })); });
});
afterEach(async () => { await act(async () => root.unmount()); globalThis.fetch = oldFetch; });
after(() => { if (oldBlobModule) require.cache[blobPath] = oldBlobModule; else delete require.cache[blobPath]; dom.window.close(); });

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
