'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the client hook in an isolated jsdom runtime. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/upload' });
for (const key of ['window', 'document', 'Element', 'HTMLElement']) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const { useAdminLibrary } = require('../../src/components/useAdminLibrary');
const { AdminSaveError, readAdminResponse } = require('../../src/lib/admin-save');
const originalFetch = globalThis.fetch;
const owner = { id: 'owner-id', name: 'Fixture Owner', username: 'fixture_owner', role: 'owner' };
const admin = { id: 'admin-id', name: 'Fixture Admin', username: 'fixture_admin', role: 'admin' };
const track = (id = 'track-1') => ({ id, title: id, slug: id, artist: 'Artist', genre: 'Hip-Hop', number: 1, published: false, createdAt: '2026-01-01T00:00:00Z' });
const video = (id = 'video-1') => ({ id, title: id, artist: null, youtubeUrl: 'https://youtu.be/fixture', youtubeId: 'fixture', order: 1, published: false, createdAt: '2026-01-01T00:00:00Z' });
const session = (identity = owner) => ({ user: { ...identity, accessStatus: 'active', authLocked: false, banned: false }, session: { expiresAt: '2099-01-01T00:00:00Z', userId: identity.id } });
const json = (body, status = 200) => Response.json(body, { status });
const success = (path) => json(path.startsWith('/api/tracks') ? [track()] : path.startsWith('/api/videos') ? [video()] : session());
let root, container, library, responder, calls, renders;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function Probe() {
  library = useAdminLibrary(owner);
  renders++;
  return React.createElement('output', null, library.sessionState);
}
async function mount(strict = false) {
  await act(async () => {
    root.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Probe)) : React.createElement(Probe));
    await new Promise(resolve => setImmediate(resolve));
  });
}
async function refresh() { await act(async () => { await library.reload(); }); }

beforeEach(() => {
  calls = [];
  renders = 0;
  responder = success;
  globalThis.fetch = async (path, options) => { calls.push({ path, options }); return responder(String(path), options); };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  container.remove();
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());

test('a full reload validates current identity and both libraries with private fetch options', async () => {
  responder = path => path.includes('/get-session') ? json(session(admin)) : success(path);
  await mount();
  assert.equal(library.sessionState, 'ready');
  assert.deepEqual(library.identity, admin);
  assert.equal(library.trackState.status, 'ready');
  assert.equal(library.videoState.status, 'ready');
  assert.ok(library.lastLoadedAt instanceof Date);
  assert.ok(library.trackState.lastSuccessAt instanceof Date);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.cache, 'no-store');
    assert.equal(call.options.credentials, 'include');
    assert.ok(call.options.signal instanceof AbortSignal);
  }
});

test('successful empty arrays are ready while an initial failure remains unavailable', async () => {
  responder = path => path.includes('/get-session') ? json(session()) : path.startsWith('/api/tracks') ? json({ error: 'offline' }, 503) : json([]);
  await mount();
  assert.deepEqual(library.tracks, []);
  assert.equal(library.trackState.status, 'error');
  assert.equal(library.trackState.lastSuccessAt, null);
  assert.equal(library.trackState.error.kind, 'connection');
  assert.deepEqual(library.videos, []);
  assert.equal(library.videoState.status, 'ready');
  assert.ok(library.videoState.lastSuccessAt instanceof Date);
  assert.equal(library.lastLoadedAt, null);
});

test('partial refresh keeps last rows and full-check time, and a single-library retry does not advance it', async () => {
  await mount();
  const fullTime = library.lastLoadedAt;
  const trackTime = library.trackState.lastSuccessAt;
  responder = path => path.startsWith('/api/tracks') ? json({ error: 'failed' }, 500) : path.startsWith('/api/videos') ? json([video('new-video')]) : json(session());
  await refresh();
  assert.deepEqual(library.tracks, [track()]);
  assert.equal(library.trackState.status, 'error');
  assert.equal(library.trackState.lastSuccessAt, trackTime);
  assert.deepEqual(library.videos, [video('new-video')]);
  assert.equal(library.lastLoadedAt, fullTime);
  responder = path => path.startsWith('/api/tracks') ? json([track('retried-track')]) : success(path);
  await act(async () => { assert.equal(await library.loadTracks(), true); });
  assert.equal(library.trackState.status, 'ready');
  assert.equal(library.lastLoadedAt, fullTime);
});

for (const [label, badRows] of [
  ['object instead of array', {}], ['null entry', [null]], ['invalid id', [{ ...track(), id: 7 }]],
  ['invalid title', [{ ...track(), title: {} }]], ['invalid optional text', [{ ...track(), mood: 5 }]],
  ['invalid createdAt', [{ ...track(), createdAt: 'not-a-date' }]], ['invalid updatedAt', [{ ...track(), updatedAt: '' }]],
  ['duplicate identity', [track(), track()]],
]) {
  test(`malformed track ${label} retains usable rows and reports a connection error`, async () => {
    await mount();
    const oldTime = library.trackState.lastSuccessAt;
    responder = path => path.startsWith('/api/tracks') ? json(badRows) : success(path);
    await act(async () => { assert.equal(await library.loadTracks(), false); });
    assert.deepEqual(library.tracks, [track()]);
    assert.equal(library.trackState.lastSuccessAt, oldTime);
    assert.equal(library.trackState.error.kind, 'connection');
  });
}

test('malformed video dates retain prior video rows', async () => {
  await mount();
  responder = path => path.startsWith('/api/videos') ? json([{ ...video(), createdAt: 'bad-date' }]) : success(path);
  await act(async () => { assert.equal(await library.loadVideos(), false); });
  assert.deepEqual(library.videos, [video()]);
  assert.equal(library.videoState.status, 'error');
});

test('one401 stays sticky against parallel success and only an explicit successful recheck clears it', async () => {
  await mount();
  const fullTime = library.lastLoadedAt;
  const gate = deferred();
  responder = path => path.startsWith('/api/tracks') ? json({}, 401) : path.startsWith('/api/videos') ? gate.promise : json(session());
  let pending;
  await act(async () => { pending = library.reload(); });
  assert.equal(library.sessionState, 'expired');
  assert.equal(library.identity, null);
  await act(async () => { gate.resolve(json([video('late-video')])); await pending; });
  assert.deepEqual(library.videos, [video()]);
  assert.equal(library.trackState.error.kind, 'auth');
  assert.equal(library.videoState.error.kind, 'auth');
  assert.equal(library.lastLoadedAt, fullTime);
  const count = calls.length;
  await act(async () => { assert.equal(await library.loadVideos(), false); });
  assert.equal(calls.length, count);
  responder = path => path.includes('/get-session') ? json(session(admin)) : success(path);
  await refresh();
  assert.equal(library.sessionState, 'ready');
  assert.deepEqual(library.identity, admin);
  assert.equal(library.trackState.error, null);
  assert.equal(library.videoState.error, null);
  assert.notEqual(library.lastLoadedAt, fullTime);
});

test('a save401 cannot be undone by an already running session check', async () => {
  await mount();
  const sessionGate = deferred();
  responder = path => path.includes('/get-session') ? sessionGate.promise : success(path);
  let pending;
  await act(async () => { pending = library.reload(); });
  await act(async () => library.reportError(new AdminSaveError('Expired', {}, 401)));
  await act(async () => { sessionGate.resolve(json(session())); await pending; });
  assert.equal(library.sessionState, 'expired');
  assert.equal(library.identity, null);
  assert.equal(library.trackState.error.kind, 'auth');
});

test('an older reload and its late401 cannot overwrite a newer successful recheck', async () => {
  await mount();
  const gates = [deferred(), deferred(), deferred()];
  let index = 0;
  responder = () => gates[index++].promise;
  let older;
  await act(async () => { older = library.reload(); });
  responder = path => path.startsWith('/api/tracks') ? json([track('fresh-track')]) : path.includes('/get-session') ? json(session(admin)) : success(path);
  await refresh();
  const fullTime = library.lastLoadedAt;
  await act(async () => {
    gates[0].resolve(json(session(owner)));
    gates[1].resolve(json({}, 401));
    gates[2].resolve(json([video('old-video')]));
    await older;
  });
  assert.equal(library.sessionState, 'ready');
  assert.deepEqual(library.identity, admin);
  assert.deepEqual(library.tracks, [track('fresh-track')]);
  assert.deepEqual(library.videos, [video()]);
  assert.equal(library.lastLoadedAt, fullTime);
});

test('guarded mutation setters defeat pending reads and preserve previous refresh errors', async () => {
  await mount();
  const fullTime = library.lastLoadedAt;
  const successful = library.trackState.lastSuccessAt;
  responder = path => path.startsWith('/api/tracks') ? json({}, 503) : success(path);
  await act(async () => { await library.loadTracks(); });
  const error = library.trackState.error;
  const gate = deferred();
  responder = path => path.startsWith('/api/tracks') ? gate.promise : success(path);
  let pending;
  await act(async () => { pending = library.loadTracks(); });
  await act(async () => library.setTracks(current => [...current, track('saved-track')]));
  assert.equal(library.trackState.status, 'error');
  assert.equal(library.trackState.error, error);
  assert.equal(library.trackState.lastSuccessAt, successful);
  await act(async () => { gate.resolve(json([track('stale-track')])); assert.equal(await pending, false); });
  assert.deepEqual(library.tracks, [track(), track('saved-track')]);
  assert.equal(library.lastLoadedAt, fullTime);
});

test('a partial mutation during initial loading cannot mark an unconfirmed library ready', async () => {
  const gate = deferred();
  responder = path => path.startsWith('/api/tracks') ? gate.promise : success(path);
  await mount();
  await act(async () => library.setTracks([track('saved-track')]));
  assert.equal(library.trackState.status, 'error');
  assert.equal(library.trackState.lastSuccessAt, null);
  await act(async () => { gate.resolve(json([track('stale-track')])); });
  assert.deepEqual(library.tracks, [track('saved-track')]);
  assert.equal(library.lastLoadedAt, null);
});

test('session failures never report a full successful check or keep stale owner identity', async () => {
  await mount();
  const fullTime = library.lastLoadedAt;
  responder = path => path.includes('/get-session') ? json({}, 503) : success(path);
  await refresh();
  assert.equal(library.sessionState, 'error');
  assert.equal(library.identity, null);
  assert.equal(library.lastLoadedAt, fullTime);
  responder = path => path.includes('/get-session') ? json(null) : success(path);
  await refresh();
  assert.equal(library.sessionState, 'expired');
  assert.equal(library.trackState.error.kind, 'auth');
});

test('inactive or malformed session identities cannot become ready', async () => {
  for (const body of [{ ...session(), user: { ...session().user, accessStatus: 'removed' } }, { ...session(), user: { ...session().user, role: 'reader' } }, { ...session(), session: { expiresAt: 'bad-date' } }]) {
    responder = path => path.includes('/get-session') ? json(body) : success(path);
    if (renders === 0) await mount(); else await refresh();
    assert.notEqual(library.sessionState, 'ready');
    assert.equal(library.identity, null);
    assert.equal(library.lastLoadedAt, null);
  }
});

test('stable callbacks and StrictMode lifecycle ignore discarded mounts and unmounted responses', async () => {
  await mount(true);
  assert.equal(calls.length, 3, 'Discarded StrictMode mount must not start duplicate requests');
  const callbacks = ['loadTracks', 'loadVideos', 'reload', 'reportError', 'setTracks', 'setVideos'].map(key => library[key]);
  await act(async () => library.setVideos([video('saved-video')]));
  assert.deepEqual(['loadTracks', 'loadVideos', 'reload', 'reportError', 'setTracks', 'setVideos'].map(key => library[key]), callbacks);
  const gate = deferred();
  responder = () => gate.promise;
  let pending;
  await act(async () => { pending = library.loadTracks(); });
  await act(async () => root.unmount());
  root = null;
  const previousRenders = renders;
  gate.resolve(json([track('too-late')]));
  assert.equal(await pending, false);
  assert.equal(renders, previousRenders);
});

test('typed save errors carry401 and other HTTP statuses without changing field feedback', async () => {
  for (const status of [401, 409, 422, 503]) {
    await assert.rejects(readAdminResponse(json({ error: 'Failure', details: { title: ['Title error'] } }, status)), error => {
      assert.ok(error instanceof AdminSaveError);
      assert.equal(error.status, status);
      if (status !== 401) assert.deepEqual(error.fields, { title: 'Title error' });
      return true;
    });
  }
});
