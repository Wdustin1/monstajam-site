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
dom.window.HTMLMediaElement.prototype.pause = function pause() {};
dom.window.HTMLMediaElement.prototype.load = function load() {};
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let objectURLNumber = 0;
URL.createObjectURL = () => `blob:local-editor-fixture-${++objectURLNumber}`;
URL.revokeObjectURL = () => {};

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
const ownerIdentity = { id: 'owner-fixture', name: 'Fixture Owner', username: 'fixture.owner', role: 'owner' };

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
    calls: [], uploads: [], mutationResponses: [], nextMutationGate: null, failNextRead: false, mutationRevision: 0,
    readResponses: {}, session: { user: { ...ownerIdentity, accessStatus: 'active', authLocked: false }, session: { expiresAt: '2099-01-01T00:00:00.000Z' } },
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
    const queued = network.readResponses[input]?.shift();
    if (queued) {
      if (queued.gate) await queued.gate.promise;
      if (queued.error) throw queued.error;
      if (queued.raw !== undefined) return new Response(queued.raw, { status: queued.status || 200 });
      return Response.json(queued.body, { status: queued.status || 200 });
    }
    if (input === '/api/auth/get-session') return Response.json(network.session);
    if (network.failNextRead && (input === '/api/tracks?all=true' || input === '/api/videos?all=true')) {
      network.failNextRead = false;
      return Response.json({ error: 'Fixture read failed' }, { status: 500 });
    }
    if (input === '/api/tracks?all=true') return Response.json(structuredClone(network.tracks.filter((row) => !row.deletedAt)));
    if (input === '/api/videos?all=true') return Response.json(structuredClone(network.videos.filter((row) => !row.deletedAt)));
    if (input === '/api/admin/trash') return Response.json({
      tracks: structuredClone(network.tracks.filter((row) => row.deletedAt)),
      videos: structuredClone(network.videos.filter((row) => row.deletedAt)),
    });
    if (input.startsWith('/api/admin/track-title?')) {
      const title = new URL(input, 'http://localhost').searchParams.get('title');
      const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return Response.json({ available: true, slug });
    }
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
  if (method === 'POST' && input.startsWith('/api/admin/trash/')) {
    const [, , , , kind, key, action] = input.split('/');
    assert.equal(action, 'restore');
    const rows = kind === 'tracks' ? network.tracks : network.videos;
    const record = rows.find((row) => row.slug === decodeURIComponent(key) || row.id === decodeURIComponent(key));
    assert.ok(record, 'Restore target must remain in fixture storage');
    if (record.deletedAt) Object.assign(record, { deletedAt: null, deletedBy: null, published: false,
      updatedAt: new Date(Date.UTC(2026, 9, 1, 12) + (++network.mutationRevision * 1000)).toISOString() });
    return Response.json(record);
  }
  const records = input.startsWith('/api/tracks') ? network.tracks : network.videos;
  if (method === 'PUT') {
    const key = input.split('/').at(-1);
    const index = records.findIndex((record) => record.slug === key || record.id === key);
    assert.ok(index >= 0, `Fixture update target missing: ${key}`);
    if (records[index].deletedAt) return Response.json({ error: 'Not found' }, { status: 404 });
    if (body.expectedUpdatedAt && body.expectedUpdatedAt !== records[index].updatedAt) {
      return Response.json({ error: 'This item changed since you started editing. Reload and review it before saving.' }, { status: 409 });
    }
    const data = { ...body };
    delete data.expectedUpdatedAt;
    records[index] = { ...records[index], ...data, updatedAt: new Date(Date.UTC(2026, 9, 1, 12) + (++network.mutationRevision * 1000)).toISOString() };
    return Response.json(records[index]);
  }
  if (method === 'POST') {
    const saved = { id: `new-${records.length}`, createdAt: '2026-01-02T12:00:00Z', ...body };
    records.push(saved);
    return Response.json(saved, { status: 201 });
  }
  if (method === 'DELETE') {
    const key = input.split('/').at(-1);
    const record = records.find((row) => row.slug === key || row.id === key);
    assert.ok(record, 'Trash target must remain in fixture storage');
    if (!record.deletedAt) Object.assign(record, { deletedAt: '2026-10-01T12:00:00.000Z', deletedBy: ownerIdentity.username, published: false,
      updatedAt: new Date(Date.UTC(2026, 9, 1, 12) + (++network.mutationRevision * 1000)).toISOString() });
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
function stat(label) {
  const heading = [...container.querySelectorAll('div')].find((node) => node.children.length === 0 && node.textContent === label);
  assert.ok(heading, `Missing statistic ${label}`);
  return heading.parentElement;
}
function statValue(label) { return stat(label).children[1].textContent; }
function lastFullCheck() { return stat('Last full check').querySelector('time')?.dateTime ?? null; }
function readiness(label) {
  const heading = [...container.querySelectorAll('span')].find((node) => node.textContent === label);
  assert.ok(heading, `Missing readiness status ${label}`);
  return heading.parentElement.textContent;
}
async function renderDashboard() {
  await act(async () => { root.render(React.createElement(UploadDashboard, { currentAdmin: ownerIdentity })); });
}
async function remountWith(overrides) {
  await act(async () => { root.unmount(); });
  network = { ...fixtures(), ...overrides };
  root = createRoot(container);
  await renderDashboard();
}

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
  await renderDashboard();
  assert.deepEqual(network.calls.filter((call) => call.method === 'GET').map((call) => call.input).sort(), [
    '/api/auth/get-session', '/api/tracks?all=true', '/api/videos?all=true',
  ]);
});

afterEach(async () => {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
});

after(() => {
  if (previousBlobModule) require.cache[blobModule] = previousBlobModule;
  else delete require.cache[blobModule];
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
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
  await press('Retry connection');
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
  assert.deepEqual(mutations()[0].body, { published: false, expectedUpdatedAt: '2026-01-01T12:00:00Z' });
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
  assert.deepEqual(mutations()[0].body, { published: false, expectedUpdatedAt: '2026-01-01T12:00:00Z' });
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
  assert.match(container.textContent, /Track library unavailable/);
  assert.match(container.textContent, /Showing previously loaded tracks\./);
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

test('canceling trash preserves edits; a delayed double-click moves one item without clearing another form', async () => {
  await edit('Live fixture');
  await change('Mood', 'Unsaved track must remain');
  await press('Move to Trash', article('Live fixture'));
  let dialog = container.querySelector('dialog[aria-label="Move track to Trash"]');
  assert.ok(dialog?.hasAttribute('open'));
  await press('Cancel', dialog);
  assert.equal(mutations().length, 0);
  assert.equal(field('Mood').value, 'Unsaved track must remain');

  await press('Move to Trash', article('Draft fixture'));
  dialog = container.querySelector('dialog[aria-label="Move track to Trash"]');
  const gate = deferred();
  network.nextMutationGate = gate;
  const confirmDelete = button('Move to Trash', dialog);
  await act(async () => { confirmDelete.click(); confirmDelete.click(); });
  assert.equal(mutations().length, 1);
  assert.equal(mutations()[0].method, 'DELETE');
  assert.equal(mutations()[0].input, '/api/tracks/draft-fixture');
  assert.equal(field('Mood').value, 'Unsaved track must remain');
  assert.ok(field('Mood').matches(':disabled'));
  assert.equal(button('Cancel', dialog).disabled, true);
  await act(async () => { gate.resolve(); });
  assert.equal(network.tracks.length, 2, 'Trash must preserve the saved record');
  assert.equal(network.tracks.filter((track) => !track.deletedAt).length, 1);
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

test('an initial track-library failure is unavailable rather than empty and cannot pass Ops checks', async () => {
  await remountWith({ readResponses: { '/api/tracks?all=true': [{ status: 503, body: { error: 'Fixture tracks unavailable' } }] } });
  assert.match(container.textContent, /Connection needs attention/);
  assert.match(container.textContent, /Track library unavailable/);
  assert.doesNotMatch(container.textContent, /No tracks match that search|No tracks yet/);
  assert.equal(statValue('Tracks'), '\u2014');
  assert.equal(statValue('Videos'), '2');
  assert.equal(lastFullCheck(), null);
  assert.equal(button('Add track').matches(':disabled'), true, 'Creation cannot assume an unloaded library is empty');
  await press('Ops');
  assert.match(readiness('Admin library is reachable'), /Needs attention/);
  assert.match(readiness('All live tracks have audio'), /Not checked/);
  assert.match(readiness('All live tracks have cover art'), /Not checked/);
  await press('Tracks');
  await press('Retry tracks');
  assert.ok(article('Live fixture'));
  assert.doesNotMatch(container.textContent, /Track library unavailable|Connection needs attention/);
  assert.equal(statValue('Tracks'), '2');
  assert.equal(button('Add track').matches(':disabled'), false);
});

test('a successfully loaded empty library remains distinguishable from an unavailable library', async () => {
  await remountWith({ tracks: [], videos: [] });
  assert.equal(statValue('Tracks'), '0');
  assert.equal(statValue('Videos'), '0');
  assert.ok(lastFullCheck());
  assert.match(container.textContent, /No tracks yet/);
  assert.doesNotMatch(container.textContent, /library unavailable|Connection needs attention/);
  await press('Videos');
  assert.match(container.textContent, /No videos yet/);
});

test('a partial refresh retains the last known tracks and does not advance the last full check', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 1, 12) });
  await remountWith({});
  const previousCheck = lastFullCheck();
  assert.ok(previousCheck);
  await edit('Live fixture');
  await change('Mood', 'Retain this partial-refresh draft');
  context.mock.timers.tick(60_000);
  network.readResponses['/api/tracks?all=true'] = [{ status: 503, body: { error: 'Track refresh unavailable' } }];
  network.videos.push({ ...network.videos[0], id: 'video-3', title: 'New server video' });
  await press('Reload');
  assert.ok(article('Live fixture'));
  assert.match(container.textContent, /Showing previously loaded tracks\./);
  assert.equal(statValue('Videos'), '3');
  assert.equal(field('Mood').value, 'Retain this partial-refresh draft');
  assert.equal(lastFullCheck(), previousCheck);
  await press('Ops');
  assert.match(readiness('Admin library is reachable'), /Needs attention/);
  await press(/^Tracks/);
  await press('Retry connection');
  assert.notEqual(lastFullCheck(), previousCheck);
  assert.equal(field('Mood').value, 'Retain this partial-refresh draft');
  assert.doesNotMatch(container.textContent, /Showing previously loaded tracks\.|Connection needs attention/);
});

test('an independently failing video refresh preserves video edits and is visible while the tracks tab is open', async () => {
  await press('Videos');
  await edit('Video fixture');
  await change('Duration', 'Keep this video draft');
  await press('Tracks');
  network.readResponses['/api/videos?all=true'] = [{ status: 503, body: { error: 'Videos temporarily unavailable' } }];
  const previousCheck = lastFullCheck();
  await press('Reload');
  assert.match(container.textContent, /Connection needs attention/);
  assert.equal(lastFullCheck(), previousCheck);
  assert.ok(article('Live fixture'));
  await press(/^Videos/);
  assert.match(container.textContent, /Video library unavailable|Showing previously loaded videos\./);
  assert.ok(article('Video fixture'));
  assert.equal(field('Duration').value, 'Keep this video draft');
  await press('Retry videos');
  assert.doesNotMatch(container.textContent, /Video library unavailable|Connection needs attention/);
  assert.equal(field('Duration').value, 'Keep this video draft');
});

test('an expired library request exposes sign-in recovery and keeps dirty fields and the selected file', async () => {
  await edit('Live fixture');
  await change('Mood', 'Keep after session expiry');
  const file = new dom.window.File(['local-pixels'], 'retained.png', { type: 'image/png' });
  const picker = await chooseFile('Replace cover art', file);
  network.readResponses['/api/tracks?all=true'] = [{ status: 401, body: { error: 'Unauthorized' } }];
  await press('Reload');
  assert.match(container.textContent, /Sign-in required/);
  const signIn = [...container.querySelectorAll('a')].find((link) => link.textContent === 'Sign in in a new tab');
  assert.ok(signIn);
  assert.equal(signIn.target, '_blank');
  assert.equal(new URL(signIn.href).pathname, '/upload/login');
  assert.equal(field('Mood').value, 'Keep after session expiry');
  assert.equal(field('Replace cover art'), picker);
  assert.equal(picker.files[0], file);
  await press('Save changes');
  assert.equal(mutations().length, 0, 'Known expired identity must not start another upload or mutation');
  assert.equal(network.uploads.length, 0);
  await press('Retry connection');
  assert.doesNotMatch(container.textContent, /Sign-in required|Connection needs attention/);
  assert.equal(picker.files[0], file);
  assert.equal(field('Mood').value, 'Keep after session expiry');
  await press('Save changes');
  assert.equal(network.uploads.length, 1);
  assert.equal(network.uploads[0].file, file);
  assert.equal(network.tracks[0].mood, 'Keep after session expiry');
});

test('an expired save moves the whole dashboard into sign-in recovery instead of only a field error', async () => {
  await edit('Live fixture');
  await change('Mood', 'Keep failed save');
  network.mutationResponses.push({ status: 401 });
  await press('Save changes');
  assert.match(container.textContent, /Sign-in required/);
  assert.equal(field('Mood').value, 'Keep failed save');
  assert.equal(mutations().length, 1);
  await press('Retry save');
  assert.equal(mutations().length, 1);
  await press('Retry connection');
  assert.doesNotMatch(container.textContent, /Sign-in required/);
  await press('Retry save');
  assert.equal(network.tracks[0].mood, 'Keep failed save');
});

test('a failed session lookup is a connection problem, not a claim that the user is signed out', async () => {
  await remountWith({ readResponses: { '/api/auth/get-session': [{ status: 503, body: { error: 'Session store unavailable' } }] } });
  assert.match(container.textContent, /Connection needs attention/);
  assert.doesNotMatch(container.textContent, /Sign-in required/);
  assert.equal(lastFullCheck(), null);
  await press('Ops');
  assert.match(readiness('Admin library is reachable'), /Needs attention/);
  await press('Retry connection');
  assert.doesNotMatch(container.textContent, /Connection needs attention/);
  assert.ok(lastFullCheck());
  assert.match(readiness('Admin library is reachable'), /Checked/);
});

test('a confirmed missing session produces persistent sign-in guidance without discarding the form', async () => {
  await edit('Live fixture');
  await change('Mood', 'Missing session draft');
  network.session = null;
  await press('Reload');
  assert.match(container.textContent, /Sign-in required/);
  assert.equal(field('Mood').value, 'Missing session draft');
  await press('Videos');
  assert.match(container.textContent, /Sign-in required/);
  await press(/^Tracks/);
  assert.equal(field('Mood').value, 'Missing session draft');
});

for (const payload of [{ error: 'Not a record array' }, [null]]) {
  test(`malformed successful track data ${JSON.stringify(payload)} retains old records and a retryable error`, async () => {
    await edit('Live fixture');
    await change('Mood', 'Preserved under malformed response');
    const previousCheck = lastFullCheck();
    network.readResponses['/api/tracks?all=true'] = [{ body: payload }];
    await press('Reload');
    assert.match(container.textContent, /Track library unavailable|Connection needs attention/);
    assert.ok(article('Live fixture'));
    assert.equal(field('Mood').value, 'Preserved under malformed response');
    assert.equal(lastFullCheck(), previousCheck);
    await press('Retry tracks');
    assert.doesNotMatch(container.textContent, /Track library unavailable|Connection needs attention/);
    assert.equal(field('Mood').value, 'Preserved under malformed response');
  });
}

function withTrashedTrack() {
  const rows = fixtures();
  Object.assign(rows.tracks[1], { deletedAt: '2026-10-01T12:00:00.000Z', deletedBy: 'fixture.owner', published: false });
  return rows;
}

test('Trash loads only when opened and an empty result offers no permanent delete action', async () => {
  assert.equal(network.calls.some((call) => call.input === '/api/admin/trash'), false);
  await press('Trash');
  assert.equal(network.calls.filter((call) => call.input === '/api/admin/trash').length, 1);
  assert.match(container.textContent, /Trash is empty\./);
  assert.ok(button('Refresh Trash'));
  assert.equal([...container.querySelectorAll('button')].some((node) => /purge|permanently delete|empty trash/i.test(node.textContent)), false);
});

test('trashing the edited track requires confirmation, preserves its saved record, and discards unsaved fields only after success', async () => {
  const before = structuredClone(network.tracks[0]);
  await edit('Live fixture');
  await change('Mood', 'Unsaved target metadata');
  const file = new dom.window.File(['local-art'], 'unsaved-target.png', { type: 'image/png' });
  const picker = await chooseFile('Replace cover art', file);
  await press('Move to Trash', article('Live fixture'));
  let dialog = container.querySelector('dialog[aria-label="Move track to Trash"]');
  assert.ok(dialog?.hasAttribute('open'));
  assert.match(dialog.textContent, /unsaved/i);
  assert.match(dialog.textContent, /restore.*draft/i);
  await press('Cancel', dialog);
  assert.equal(mutations().length, 0);
  assert.equal(field('Mood').value, 'Unsaved target metadata');
  assert.equal(picker.files[0], file);
  await press('Move to Trash', article('Live fixture'));
  dialog = container.querySelector('dialog[aria-label="Move track to Trash"]');
  await press('Move to Trash', dialog);
  assert.equal(network.tracks.length, 2);
  const trashed = network.tracks.find((track) => track.id === before.id);
  assert.ok(trashed.deletedAt);
  assert.equal(trashed.published, false);
  assert.equal(trashed.mood, before.mood);
  assert.equal(trashed.audioUrl, before.audioUrl);
  assert.equal(trashed.coverUrl, before.coverUrl);
  assert.equal(network.uploads.length, 0);
  assert.equal(field('Track title').value, '');
  assert.equal(isDirty('track'), false);
  await press('Trash');
  assert.ok(article('Live fixture'));
  await press('Restore as draft', article('Live fixture'));
  assert.equal(network.tracks[0].deletedAt, null);
  assert.equal(network.tracks[0].published, false);
  assert.equal(mutations().filter((call) => call.method === 'PUT').length, 0, 'Restoring must not republish');
  await press('Tracks');
  assert.match(article('Live fixture').textContent, /Draft/);
});

test('restoring another track retains the active editor draft and selected file', async () => {
  await remountWith(withTrashedTrack());
  await edit('Live fixture');
  await change('Mood', 'Keep while restoring another track');
  const file = new dom.window.File(['kept-art'], 'keep-across-restore.png', { type: 'image/png' });
  await chooseFile('Replace cover art', file);
  await press('Trash');
  await press('Restore as draft', article('Draft fixture'));
  assert.equal(network.tracks[1].published, false);
  assert.equal(network.tracks[1].deletedAt, null);
  assert.equal(network.uploads.length, 0);
  assert.equal(mutations().length, 1);
  assert.equal(mutations()[0].input, '/api/admin/trash/tracks/draft-fixture/restore');
  await press(/^Tracks/);
  assert.equal(field('Track title').value, 'Live fixture');
  assert.equal(field('Mood').value, 'Keep while restoring another track');
  assert.match(field('Replace cover art').closest('label').textContent, /keep-across-restore\.png/);
  assert.ok(isDirty('track'));
  assert.ok(article('Draft fixture'));
  await press('Save changes');
  assert.equal(network.uploads.length, 1);
  assert.equal(network.uploads[0].file, file, 'Changing tabs and restoring another item must preserve the selected File');
});

test('video trash and restore retain its metadata and return it to the library as a draft', async () => {
  const before = structuredClone(network.videos[0]);
  await press('Videos');
  await press('Move to Trash', article('Video fixture'));
  const dialog = container.querySelector('dialog[aria-label="Move video to Trash"]');
  assert.ok(dialog?.hasAttribute('open'));
  await press('Move to Trash', dialog);
  assert.equal(network.videos.length, 2);
  assert.ok(network.videos[0].deletedAt);
  assert.equal(network.videos[0].youtubeUrl, before.youtubeUrl);
  assert.equal(network.videos[0].duration, before.duration);
  await press('Trash');
  await press('Restore as draft', article('Video fixture'));
  assert.equal(network.videos[0].published, false);
  assert.equal(network.videos[0].deletedAt, null);
  assert.equal(network.videos[0].youtubeId, before.youtubeId);
  await press('Videos');
  assert.match(article('Video fixture').textContent, /Draft/);
});

test('a failed restore keeps the item in Trash and the same action can retry successfully', async () => {
  await remountWith(withTrashedTrack());
  await press('Trash');
  network.mutationResponses.push({ status: 503, body: { error: 'Could not restore this track. Refresh Trash before trying again.' } });
  await press('Restore as draft', article('Draft fixture'));
  assert.ok(network.tracks[1].deletedAt);
  assert.ok(article('Draft fixture'));
  assert.match(container.textContent, /Could not restore this track/);
  await press('Restore as draft', article('Draft fixture'));
  assert.equal(network.tracks[1].deletedAt, null);
  assert.equal(network.tracks[1].published, false);
  assert.equal(mutations().length, 2);
  assert.match(container.textContent, /Trash is empty\./);
});

test('a delayed double-click restore sends one request and never duplicates the active record', async () => {
  await remountWith(withTrashedTrack());
  await press('Trash');
  const gate = deferred();
  network.nextMutationGate = gate;
  const restore = button('Restore as draft', article('Draft fixture'));
  await act(async () => { restore.click(); restore.click(); });
  assert.equal(mutations().length, 1);
  assert.ok(restore.matches(':disabled'));
  await act(async () => { gate.resolve(); });
  assert.equal(network.tracks.filter((track) => track.id === 'track-2').length, 1);
  await press('Tracks');
  assert.equal([...container.querySelectorAll('article h3')].filter((node) => node.textContent === 'Draft fixture').length, 1);
});

test('a failed Trash load is retryable and never claims the bin is empty', async () => {
  await remountWith(withTrashedTrack());
  network.readResponses['/api/admin/trash'] = [{ status: 503, body: { error: 'Trash temporarily unavailable' } }];
  await press('Trash');
  assert.match(container.textContent, /Trash could not be loaded/);
  assert.doesNotMatch(container.textContent, /Trash is empty\./);
  await press('Retry Trash');
  assert.ok(article('Draft fixture'));
  assert.doesNotMatch(container.textContent, /Trash could not be loaded/);
});

test('an expired Trash load uses dashboard sign-in recovery without losing another dirty form', async () => {
  await remountWith(withTrashedTrack());
  await edit('Live fixture');
  await change('Mood', 'Keep through trash sign-in');
  network.readResponses['/api/admin/trash'] = [{ status: 401, body: { error: 'Sign in to view Trash.' } }];
  await press('Trash');
  assert.match(container.textContent, /Sign-in required/);
  assert.ok([...container.querySelectorAll('a')].some((link) => link.textContent === 'Sign in in a new tab' && link.target === '_blank'));
  await press('Retry connection');
  assert.doesNotMatch(container.textContent, /Sign-in required/);
  assert.ok(article('Draft fixture'));
  await press(/^Tracks/);
  assert.equal(field('Mood').value, 'Keep through trash sign-in');
  assert.ok(isDirty('track'));
});

test('a failed move to Trash preserves the current unsaved metadata and selected file', async () => {
  await edit('Live fixture');
  await change('Mood', 'Retain failed-trash edits');
  const file = new dom.window.File(['keep'], 'failed-trash.png', { type: 'image/png' });
  const picker = await chooseFile('Replace cover art', file);
  network.mutationResponses.push({ status: 500, body: { error: 'Failed to move track to Trash' } });
  await press('Move to Trash', article('Live fixture'));
  await press('Move to Trash', container.querySelector('dialog[aria-label="Move track to Trash"]'));
  assert.equal(network.tracks[0].deletedAt, undefined);
  assert.equal(network.tracks[0].published, true);
  assert.ok(article('Live fixture'));
  assert.equal(field('Mood').value, 'Retain failed-trash edits');
  assert.equal(picker.files[0], file);
  assert.equal(network.uploads.length, 0);
  assert.match(container.textContent, /Failed to move track to Trash/);
});

test('a stale Trash card accepts an already restored live result without silently unpublishing it', async () => {
  await remountWith(withTrashedTrack());
  await press('Trash');
  Object.assign(network.tracks[1], { deletedAt: null, deletedBy: null, published: true });
  await press('Restore as draft', article('Draft fixture'));
  assert.equal(network.tracks[1].published, true);
  assert.match(container.textContent, /already restored and is live/);
  assert.equal(mutations().filter((call) => call.method === 'PUT').length, 0);
  await press('Tracks');
  assert.match(article('Draft fixture').textContent, /Live/);
});

test('malformed Trash data cannot appear empty or replace a previously loaded recoverable item', async () => {
  await remountWith(withTrashedTrack());
  await press('Trash');
  network.readResponses['/api/admin/trash'] = [{ body: { tracks: [null], videos: [] } }];
  await press('Refresh Trash');
  assert.match(container.textContent, /Trash could not be loaded|Showing previously loaded items/);
  assert.doesNotMatch(container.textContent, /Trash is empty\./);
  assert.ok(article('Draft fixture'));
  assert.equal(button('Restore as draft', article('Draft fixture')).disabled, true);
  await press('Retry Trash');
  assert.equal(button('Restore as draft', article('Draft fixture')).disabled, false);
});

test('a stale track save after trash and restore cannot republish, and opening the latest version requires discarding old edits', async () => {
  const originalRevision = network.tracks[0].updatedAt;
  await edit('Live fixture');
  await change('Mood', 'Stale track edit');
  const file = new dom.window.File(['pending-art'], 'stale-edit.png', { type: 'image/png' });
  const picker = await chooseFile('Replace cover art', file);
  // Another admin trashed and restored this item while this form remained open.
  const restoredRevision = '2026-10-01T12:30:00.000Z';
  Object.assign(network.tracks[0], { deletedAt: null, deletedBy: null, published: false, updatedAt: restoredRevision });
  await press('Reload');
  assert.equal(field('Mood').value, 'Stale track edit');
  await press('Save changes');
  assert.equal(mutations()[0].body.expectedUpdatedAt, originalRevision, 'Reload must not silently authorize the stale form against the latest record');
  assert.equal(network.tracks[0].published, false);
  assert.equal(network.tracks[0].mood, 'Original mood');
  assert.equal(picker.files[0], file);
  assert.equal(field('Mood').value, 'Stale track edit');
  assert.match(container.textContent, /changed since you started editing/);
  await edit('Live fixture');
  assert.ok(dialogOpen());
  await press('Keep editing');
  assert.equal(field('Mood').value, 'Stale track edit');
  await edit('Live fixture');
  await press('Discard changes');
  assert.equal(field('Mood').value, 'Original mood');
  assert.equal(isDirty('track'), false);
  await change('Mood', 'Reviewed latest track');
  await press('Save changes');
  assert.equal(mutations().at(-1).body.expectedUpdatedAt, restoredRevision);
  assert.equal(network.tracks[0].published, false);
  assert.equal(network.tracks[0].mood, 'Reviewed latest track');
});

test('a stale video save keeps its original revision across reload and can recover by reopening the latest draft', async () => {
  const originalRevision = network.videos[0].updatedAt;
  await press('Videos');
  await edit('Video fixture');
  await change('Duration', '9:59');
  const restoredRevision = '2026-10-01T12:30:00.000Z';
  Object.assign(network.videos[0], { deletedAt: null, deletedBy: null, published: false, updatedAt: restoredRevision });
  await press('Reload');
  await press('Save changes');
  assert.equal(mutations()[0].body.expectedUpdatedAt, originalRevision);
  assert.equal(network.videos[0].published, false);
  assert.equal(network.videos[0].duration, '3:45');
  assert.equal(field('Duration').value, '9:59');
  assert.match(container.textContent, /changed since you started editing/);
  await edit('Video fixture');
  assert.ok(dialogOpen());
  await press('Discard changes');
  assert.equal(field('Duration').value, '3:45');
  await change('Duration', '4:05');
  await press('Save changes');
  assert.equal(mutations().at(-1).body.expectedUpdatedAt, restoredRevision);
  assert.equal(network.videos[0].duration, '4:05');
  assert.equal(network.videos[0].published, false);
});
