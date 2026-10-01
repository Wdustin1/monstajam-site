/* Virtual-DOM regression coverage for the actual dashboard component.
 * Run: npx tsx --test scripts/tests/admin-editor.test.cjs
 * jsdom does not load resources; fetch and Blob upload are local test doubles.
 * Native browser navigation/dialog behavior is verified separately in-browser.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS allows a scoped Blob SDK test double before loading the TSX component. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/upload' });
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'HTMLAnchorElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLDialogElement', 'location']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };

const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
let network;
const blobModule = require.resolve('@vercel/blob/client');
const previousBlobModule = require.cache[blobModule];
require.cache[blobModule] = { id: blobModule, filename: blobModule, loaded: true, exports: {
  upload: async (pathname, file, options) => {
    network.uploads.push({ pathname, file, options });
    return { url: `https://example.invalid/local-upload/${encodeURIComponent(file.name)}` };
  },
} };
const UploadDashboard = require('../../src/components/UploadDashboard').default;
let root;
let container;
let navigation;
const originalFetch = globalThis.fetch;

function fixtures() {
  const track = {
    artist: 'Fixture Artist', genre: 'Hip-Hop', bpm: 101, mood: 'Original mood', story: 'Original story',
    spotifyUrl: 'https://example.invalid/spotify', appleMusicUrl: 'https://example.invalid/apple',
    audioUrl: 'https://example.invalid/audio.mp3', coverUrl: null,
    color: 'bg-gradient-to-br from-purple-600 to-blue-500',
    createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z',
  };
  const video = {
    artist: 'Fixture Video Artist', youtubeUrl: 'https://www.youtube.com/watch?v=LOCAL000001',
    youtubeId: 'LOCAL000001', duration: '3:45', published: true,
    createdAt: track.createdAt, updatedAt: track.updatedAt,
  };
  return {
    tracks: [
      { ...track, id: 'track-1', slug: 'live-fixture', title: 'Live fixture', number: 1, published: true },
      { ...track, id: 'track-2', slug: 'draft-fixture', title: 'Draft fixture', number: 2, published: false },
    ],
    videos: [
      { ...video, id: 'video-1', title: 'Video fixture', order: 0 },
      { ...video, id: 'video-2', title: 'Second video fixture', order: 1 },
    ],
    calls: [], uploads: [], mutationResponses: [], nextMutationGate: null, failNextRead: false,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function fakeFetch(input, init = {}) {
  assert.equal(typeof input, 'string');
  assert.ok(input.startsWith('/api/'), `Unexpected network destination: ${input}`);
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  network.calls.push({ input, method, body });
  if (method === 'GET') {
    if (network.failNextRead) {
      network.failNextRead = false;
      return Response.json({ error: 'Fixture read failed' }, { status: 500 });
    }
    if (input === '/api/tracks?all=true') return Response.json(structuredClone(network.tracks));
    if (input === '/api/videos?all=true') return Response.json(structuredClone(network.videos));
    throw new Error(`Unsupported fixture read ${input}`);
  }
  if (network.nextMutationGate) {
    const gate = network.nextMutationGate;
    network.nextMutationGate = null;
    await gate.promise;
  }
  const failure = network.mutationResponses.shift();
  if (failure) return Response.json(failure.body || { error: 'Fixture save failed' }, { status: failure.status });
  if (input === '/api/auth/logout') return Response.json({ ok: true });
  const records = input.startsWith('/api/tracks') ? network.tracks : network.videos;
  if (method === 'PUT') {
    const key = input.split('/').at(-1);
    const index = records.findIndex((record) => record.slug === key || record.id === key);
    assert.ok(index >= 0, `Fixture update target missing: ${key}`);
    records[index] = { ...records[index], ...body, updatedAt: '2026-01-02T12:00:00Z' };
    return Response.json(records[index]);
  }
  if (method === 'POST') {
    const saved = { id: `new-${records.length}`, createdAt: '2026-01-02T12:00:00Z', ...body };
    records.push(saved);
    return Response.json(saved, { status: 201 });
  }
  if (method === 'DELETE') {
    const key = input.split('/').at(-1);
    records.splice(records.findIndex((record) => record.slug === key || record.id === key), 1);
    return Response.json({ ok: true });
  }
  throw new Error(`Unsupported fixture request ${method} ${input}`);
}

function button(label, scope = container) {
  const found = [...scope.querySelectorAll('button')].find((element) => {
    const text = element.textContent.trim();
    return typeof label === 'string' ? text === label : label.test(text);
  });
  assert.ok(found, `Button not found: ${label}. Available: ${[...scope.querySelectorAll('button')].map((item) => item.textContent.trim()).join(' | ')}`);
  return found;
}

function field(label) {
  const wrapper = [...container.querySelectorAll('label')].find((element) => {
    const span = element.querySelector(':scope > span');
    return span?.textContent.replace(/\s*\*\s*$/, '').trim() === label;
  });
  assert.ok(wrapper, `Field not found: ${label}`);
  const input = wrapper.querySelector('input,textarea,select');
  assert.ok(input, `Field ${label} has no input`);
  return input;
}

function article(title) {
  const element = [...container.querySelectorAll('article')].find((item) => item.querySelector('h3')?.textContent === title);
  assert.ok(element, `Library row not found: ${title}`);
  return element;
}

async function click(element) { await act(async () => { element.click(); }); }
async function press(label, scope) { await click(button(label, scope)); }
async function edit(title) { await press('Edit', article(title)); }
async function change(label, value) {
  const input = field(label);
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype :
    input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function chooseFile(label, file) {
  const input = field(label);
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  return input;
}
function mutations() { return network.calls.filter((call) => call.method !== 'GET'); }
function isDirty(kind) { return container.textContent.includes(`Unsaved ${kind} changes`); }
function dialogOpen() { return !!container.querySelector('dialog[open]'); }

beforeEach(async () => {
  network = fixtures();
  globalThis.fetch = fakeFetch;
  navigation = new dom.window.EventTarget();
  navigation.traversedKeys = [];
  navigation.traverseTo = (key) => {
    navigation.traversedKeys.push(key);
    return { finished: Promise.resolve() };
  };
  Object.defineProperty(dom.window, 'navigation', { configurable: true, value: navigation });
  document.body.innerHTML = '<div id="root"></div>';
  container = document.getElementById('root');
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(UploadDashboard, { currentAdmin: { id: 'owner-fixture', name: 'Fixture Owner', email: 'owner@example.invalid', role: 'owner' } })); });
  assert.equal(network.calls.filter((call) => call.method === 'GET').length, 2);
});

afterEach(async () => {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
});

after(() => {
  if (previousBlobModule) require.cache[blobModule] = previousBlobModule;
  else delete require.cache[blobModule];
  dom.window.close();
});

test('cleared track fields send explicit null, persist, and reset the dirty baseline', async () => {
  await edit('Live fixture');
  for (const label of ['BPM', 'Mood', 'Track story / lyrics', 'Spotify URL', 'Apple Music URL']) await change(label, '');
  assert.ok(isDirty('track'));
  await press('Save changes');
  const payload = mutations()[0].body;
  for (const key of ['bpm', 'mood', 'story', 'spotifyUrl', 'appleMusicUrl']) assert.equal(payload[key], null, `${key} was not explicitly cleared`);
  assert.equal('audioUrl' in payload, false, 'Existing audio must remain untouched');
  assert.equal('coverUrl' in payload, false, 'Existing artwork must remain untouched');
  assert.equal(isDirty('track'), false);
  assert.equal(field('Track title').value, '');
  await edit('Live fixture');
  assert.equal(dialogOpen(), false, 'Successful save left an obsolete dirty baseline');
  for (const label of ['BPM', 'Mood', 'Track story / lyrics', 'Spotify URL', 'Apple Music URL']) assert.equal(field(label).value, '');
});

test('video artist and duration clear explicitly without losing the YouTube identity', async () => {
  await press('Videos');
  await edit('Video fixture');
  await change('Artist', '');
  await change('Duration', '');
  await press('Save changes');
  const payload = mutations()[0].body;
  assert.equal(payload.artist, null);
  assert.equal(payload.duration, null);
  assert.equal(payload.youtubeId, 'LOCAL000001');
  assert.equal(isDirty('video'), false);
  await edit('Video fixture');
  assert.equal(field('Artist').value, '');
  assert.equal(field('Duration').value, '');
  assert.equal(dialogOpen(), false);
});

test('failed metadata save retains edits and selected file; retry reuses the uploaded file once', async () => {
  await edit('Live fixture');
  await change('Track title', 'Retained after failure');
  const file = new dom.window.File(['fake-image-pixels'], 'replacement.png', { type: 'image/png' });
  const picker = await chooseFile('Replace cover art', file);
  network.mutationResponses.push({ status: 500 });
  await press('Save changes');
  assert.equal(field('Track title').value, 'Retained after failure');
  assert.equal(field('Replace cover art'), picker);
  assert.equal(picker.files[0], file);
  assert.ok(isDirty('track'));
  assert.match(container.textContent, /Your edits have been kept/);
  assert.equal(network.uploads.length, 1);
  assert.equal(network.tracks[0].title, 'Live fixture');
  await press('Retry save');
  assert.equal(network.uploads.length, 1, 'Retry must not reupload the same selected file');
  assert.equal(mutations().length, 2);
  assert.equal(network.tracks[0].title, 'Retained after failure');
  assert.equal(network.tracks[0].coverUrl, 'https://example.invalid/local-upload/replacement.png');
  assert.equal(isDirty('track'), false);
  assert.notEqual(field('Cover art'), picker, 'Successful save should reset the file input');
});

test('session expiry keeps video edits and provides a separate sign-in link before retry', async () => {
  await press('Videos');
  await edit('Video fixture');
  await change('Video title', 'Keep this video edit');
  network.mutationResponses.push({ status: 401 });
  await press('Save changes');
  assert.equal(field('Video title').value, 'Keep this video edit');
  assert.ok(isDirty('video'));
  assert.match(container.textContent, /Your session expired/);
  const signIn = container.querySelector('a[href="/upload/login"]');
  assert.equal(signIn.target, '_blank');
  await press('Retry save');
  assert.equal(network.videos[0].title, 'Keep this video edit');
  assert.equal(isDirty('video'), false);
});

test('one delayed double-click save disables editing/actions until its single mutation completes', async () => {
  await edit('Live fixture');
  await change('Mood', 'Snapshot being saved');
  const gate = deferred();
  network.nextMutationGate = gate;
  const save = button('Save changes');
  await act(async () => { save.click(); save.click(); });
  assert.equal(mutations().length, 1);
  assert.ok(field('Track title').matches(':disabled'));
  assert.ok(button('New track').matches(':disabled'));
  assert.ok(button('Videos').matches(':disabled'));
  await click(button('Videos'));
  await click(button('New track'));
  assert.equal(field('Mood').value, 'Snapshot being saved');
  assert.equal(dialogOpen(), false);
  await act(async () => { gate.resolve(); });
  assert.equal(network.tracks[0].mood, 'Snapshot being saved');
  assert.equal(container.querySelector('fieldset').disabled, false);
  assert.equal(mutations().length, 1);
  assert.equal(isDirty('track'), false);
});

test('reopening the same track or its Ops row preserves in-progress edits', async () => {
  await edit('Live fixture');
  await change('Mood', 'Still editing the same track');
  await edit('Live fixture');
  assert.equal(field('Mood').value, 'Still editing the same track');
  assert.equal(dialogOpen(), false);
  await press('Ops');
  await press(/^Live fixtureAudio ok/);
  assert.equal(field('Mood').value, 'Still editing the same track');
  assert.equal(dialogOpen(), false);
  assert.ok(isDirty('track'));
});

test('new track and switching records require Keep/Discard; one confirmation authorizes one action', async () => {
  await edit('Live fixture');
  await change('Mood', 'Do not overwrite silently');
  await press('New track');
  assert.ok(dialogOpen());
  await press('Keep editing');
  assert.equal(field('Mood').value, 'Do not overwrite silently');
  await edit('Draft fixture');
  assert.ok(dialogOpen());
  await press('Keep editing');
  assert.equal(field('Track title').value, 'Live fixture');

  // Simulate two handlers racing before the modal's native inertness can apply.
  await act(async () => { button('New track').click(); button('Edit', article('Draft fixture')).click(); });
  assert.equal(container.querySelectorAll('dialog[open]').length, 1);
  await press('Discard changes');
  assert.equal(field('Track title').value, '', 'A second waiting action inherited the first confirmation');
  assert.equal(isDirty('track'), false);

  await edit('Live fixture');
  await change('Mood', 'Discard for the other record');
  await edit('Draft fixture');
  await press('Discard changes');
  assert.equal(field('Track title').value, 'Draft fixture');
  assert.equal(field('Mood').value, 'Original mood');
  assert.equal(isDirty('track'), false);
});

test('dirty track and video forms survive tab changes; video reset asks and respects the answer', async () => {
  await edit('Live fixture');
  await change('Mood', 'Track draft remains');
  await press('Videos');
  await edit('Video fixture');
  await change('Duration', '9:59');
  await press(/^Tracks/);
  assert.equal(field('Mood').value, 'Track draft remains');
  await press(/^Videos/);
  assert.equal(field('Duration').value, '9:59');
  await edit('Video fixture');
  assert.equal(field('Duration').value, '9:59');
  assert.equal(dialogOpen(), false);
  await press('New video');
  await press('Keep editing');
  assert.equal(field('Duration').value, '9:59');
  await press('New video');
  await press('Discard changes');
  assert.equal(field('Video title').value, '');
  await press(/^Tracks/);
  assert.equal(field('Mood').value, 'Track draft remains', 'Resetting video unexpectedly discarded the track form');
});

test('quick publish blocks dirty edits and synchronizes the pristine editor with its saved baseline', async () => {
  await edit('Live fixture');
  await change('Mood', 'Dirty metadata');
  await press('Draft', article('Live fixture'));
  assert.equal(mutations().length, 0);
  assert.match(container.textContent, /Save or discard your track edits before changing its publish status/);
  await change('Mood', 'Original mood');
  assert.equal(isDirty('track'), false);
  await press('Draft', article('Live fixture'));
  assert.deepEqual(mutations()[0].body, { published: false });
  assert.ok(button(/^Save as draftHidden/));
  assert.equal(isDirty('track'), false, 'Quick publish must update the baseline as well as the form');
  await press('New track');
  assert.equal(dialogOpen(), false);
});

test('quick video publish also respects dirty state and updates the editor after a pristine change', async () => {
  await press('Videos');
  await edit('Video fixture');
  await change('Duration', '8:00');
  await press('Draft', article('Video fixture'));
  assert.equal(mutations().length, 0);
  await change('Duration', '3:45');
  await press('Draft', article('Video fixture'));
  assert.deepEqual(mutations()[0].body, { published: false });
  assert.ok(button(/^Save video as draftHidden/));
  assert.equal(isDirty('video'), false);
  await press('New video');
  assert.equal(dialogOpen(), false);
});

test('failed library refresh retains loaded records and unsaved form contents', async () => {
  await edit('Live fixture');
  await change('Mood', 'Keep through refresh');
  network.failNextRead = true;
  await press('Reload');
  assert.equal(field('Mood').value, 'Keep through refresh');
  assert.ok(article('Live fixture'));
  assert.ok(article('Draft fixture'));
  assert.match(container.textContent, /Track library failed to load/);
  assert.ok(isDirty('track'));
});

test('server validation errors stay beside the field while preserving the complete form for correction', async () => {
  await edit('Live fixture');
  await change('Spotify URL', 'not-a-valid-url');
  await change('Mood', 'Retain this unrelated edit');
  network.mutationResponses.push({ status: 422, body: { error: 'Validation failed', details: { spotifyUrl: ['Enter a valid Spotify URL'] } } });
  await press('Save changes');
  assert.match(field('Spotify URL').closest('label').textContent, /Enter a valid Spotify URL/);
  assert.equal(field('Spotify URL').value, 'not-a-valid-url');
  assert.equal(field('Mood').value, 'Retain this unrelated edit');
  assert.ok(isDirty('track'));
  await change('Spotify URL', 'https://example.invalid/fixed');
  await press('Retry save');
  assert.equal(network.tracks[0].spotifyUrl, 'https://example.invalid/fixed');
  assert.equal(network.tracks[0].mood, 'Retain this unrelated edit');
  assert.equal(isDirty('track'), false);
});

test('reload/close guard cancels beforeunload only while dirty or saving and releases after success', async () => {
  const beforeUnload = () => {
    const event = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(beforeUnload(), false);
  await edit('Live fixture');
  assert.equal(beforeUnload(), false);
  await change('Mood', 'Protected on reload');
  assert.equal(beforeUnload(), true);
  const gate = deferred();
  network.nextMutationGate = gate;
  await press('Save changes');
  assert.equal(beforeUnload(), true);
  await act(async () => { gate.resolve(); });
  assert.equal(beforeUnload(), false);
});

test('a hidden dirty form guards same-tab navigation and Keep editing preserves its contents', async () => {
  await edit('Live fixture');
  await change('Mood', 'Hidden track edit');
  await press('Videos');
  const navbarLink = document.createElement('a');
  navbarLink.href = '/';
  navbarLink.textContent = 'Public site';
  document.body.append(navbarLink);
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  await act(async () => { navbarLink.dispatchEvent(event); });
  assert.equal(event.defaultPrevented, true);
  assert.ok(dialogOpen());
  await press('Keep editing');
  assert.equal(location.pathname, '/upload');
  assert.ok(field('Video title'), 'Keep editing unexpectedly switched the current tab');
  await press(/^Tracks/);
  assert.equal(field('Mood').value, 'Hidden track edit');
  assert.ok(isDirty('track'));
});

test('saved preview links opening another tab are not intercepted while editing', async () => {
  await edit('Live fixture');
  await change('Mood', 'Keep while previewing');
  const preview = article('Live fixture').querySelector('a[target="_blank"]');
  assert.ok(preview);
  let intercepted;
  // Observe the guard's result, then suppress jsdom's unsupported navigation.
  preview.addEventListener('click', (event) => { intercepted = event.defaultPrevented; event.preventDefault(); }, { once: true });
  await click(preview);
  assert.equal(intercepted, false);
  assert.equal(dialogOpen(), false);
  assert.equal(field('Mood').value, 'Keep while previewing');
  assert.equal(mutations().length, 0);
});

test('Navigation API traversal cancels on Keep and one Discard approves only its original destination', async () => {
  await edit('Live fixture');
  await change('Mood', 'Guard history traversal');
  const traverse = (key) => {
    const event = new dom.window.Event('navigate', { cancelable: true });
    Object.assign(event, {
      navigationType: 'traverse',
      destination: { sameDocument: true, url: 'http://localhost/videos', key },
    });
    navigation.dispatchEvent(event);
    return event;
  };
  let keptEvent;
  await act(async () => { keptEvent = traverse('keep-destination'); });
  assert.equal(keptEvent.defaultPrevented, true);
  assert.ok(dialogOpen());
  await press('Keep editing');
  assert.deepEqual(navigation.traversedKeys, []);
  assert.equal(field('Mood').value, 'Guard history traversal');

  let first;
  let concurrent;
  await act(async () => {
    first = traverse('approved-destination');
    concurrent = traverse('unapproved-concurrent-destination');
  });
  assert.equal(first.defaultPrevented, true);
  assert.equal(concurrent.defaultPrevented, true);
  assert.equal(container.querySelectorAll('dialog[open]').length, 1);
  await press('Discard changes');
  assert.deepEqual(navigation.traversedKeys, ['approved-destination']);
});

test('canceling delete preserves edits; a delayed double-click delete runs once without clearing another form', async () => {
  await edit('Live fixture');
  await change('Mood', 'Unsaved track must remain');
  await press('Delete', article('Live fixture'));
  let dialog = container.querySelector('dialog[aria-label="Delete track"]');
  assert.ok(dialog?.hasAttribute('open'));
  await press('Cancel', dialog);
  assert.equal(mutations().length, 0);
  assert.equal(field('Mood').value, 'Unsaved track must remain');

  await press('Delete', article('Draft fixture'));
  dialog = container.querySelector('dialog[aria-label="Delete track"]');
  const gate = deferred();
  network.nextMutationGate = gate;
  const confirmDelete = button('Delete', dialog);
  await act(async () => { confirmDelete.click(); confirmDelete.click(); });
  assert.equal(mutations().length, 1);
  assert.equal(mutations()[0].method, 'DELETE');
  assert.equal(mutations()[0].input, '/api/tracks/draft-fixture');
  assert.equal(field('Mood').value, 'Unsaved track must remain');
  assert.ok(field('Mood').matches(':disabled'));
  assert.equal(button('Cancel', dialog).disabled, true);
  await act(async () => { gate.resolve(); });
  assert.equal(network.tracks.length, 1);
  assert.equal(network.tracks[0].slug, 'live-fixture');
  assert.equal(field('Mood').value, 'Unsaved track must remain');
  assert.ok(isDirty('track'));
  assert.equal(dialogOpen(), false);
});

test('Keep editing in the sign-out confirmation sends no logout request and retains the form', async () => {
  await edit('Live fixture');
  await change('Mood', 'Keep signed-in edit');
  await press('Sign out');
  assert.ok(dialogOpen());
  await press('Keep editing');
  assert.equal(network.calls.some((call) => call.input === '/api/auth/logout'), false);
  assert.equal(field('Mood').value, 'Keep signed-in edit');
  assert.ok(isDirty('track'));
  assert.equal(location.pathname, '/upload');
});
