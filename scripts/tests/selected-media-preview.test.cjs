/* Browser object URLs and media events are simulated; no uploads or network calls. */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone virtual-DOM test runner. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/upload' });
for (const key of ['window', 'document', 'Element', 'HTMLElement']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const SelectedMediaPreview = require('../../src/components/SelectedMediaPreview').default;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
const originalFetch = globalThis.fetch;
let root, container, created, revoked, paused, loaded;

function file(name = 'selected.wav', type = 'audio/wav') { return new dom.window.File(['fixture'], name, { type }); }
async function render(props) { await act(async () => { root.render(React.createElement(SelectedMediaPreview, props)); }); }
async function event(element, name) { await act(async () => { element.dispatchEvent(new dom.window.Event(name)); }); }
async function unmount() { await act(async () => { root.unmount(); }); root = null; }

beforeEach(() => {
  created = []; revoked = []; paused = []; loaded = [];
  URL.createObjectURL = (value) => { const url = `blob:http://localhost/fixture-${created.length + 1}`; created.push({ file: value, url }); return url; };
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  dom.window.HTMLMediaElement.prototype.pause = function () { paused.push(this); };
  dom.window.HTMLMediaElement.prototype.load = function () { loaded.push({ element: this, src: this.getAttribute('src') }); };
  globalThis.fetch = () => assert.fail('Selected media previews must not make HTTP requests');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  if (root) await unmount();
  container.remove(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; globalThis.fetch = originalFetch;
});
after(() => dom.window.close());

test('no selection creates no URL; selected artwork reuses its URL until replaced and revokes on reset/unmount', async () => {
  await render({ kind: 'image', file: null });
  assert.equal(container.textContent, ''); assert.deepEqual(created, []);
  const first = file('first.png', 'image/png');
  await render({ kind: 'image', file: first });
  assert.equal(container.querySelector('img').alt, 'Selected artwork');
  assert.equal(container.querySelector('img').src, created[0].url);
  assert.match(container.textContent, /first.png/);
  await render({ kind: 'image', file: first });
  assert.equal(created.length, 1, 'Unrelated rerenders must not allocate another object URL');
  const second = file('second.png', 'image/png');
  await render({ kind: 'image', file: second });
  assert.deepEqual(revoked, [created[0].url]);
  assert.equal(container.querySelector('img').src, created[1].url);
  await render({ kind: 'image', file: null });
  assert.equal(container.querySelector('img'), null);
  assert.deepEqual(revoked, created.map((entry) => entry.url));
  await render({ kind: 'image', file: second });
  await unmount();
  assert.equal(created.length, 3);
  assert.deepEqual(revoked, created.map((entry) => entry.url));
});

test('selected audio forwards play and its element reference, then pauses and clears old media on replace/reset/unmount', async () => {
  const audioRef = { current: null }; let plays = 0;
  const props = { kind: 'audio', audioRef, onAudioPlay: () => { plays++; } };
  await render({ ...props, file: file() });
  const first = container.querySelector('audio');
  assert.equal(audioRef.current, first);
  assert.ok(first.controls); assert.equal(first.getAttribute('autoplay'), null);
  assert.equal(first.getAttribute('aria-label'), 'Selected audio');
  assert.match(container.textContent, /not the saved 45-second preview/);
  await event(first, 'play'); assert.equal(plays, 1);
  await render({ ...props, file: file('replacement.wav') });
  const second = container.querySelector('audio');
  assert.notEqual(first, second); assert.equal(audioRef.current, second);
  assert.ok(paused.includes(first)); assert.equal(first.getAttribute('src'), null);
  assert.ok(loaded.some((entry) => entry.element === first && entry.src === null));
  await render({ ...props, file: null });
  assert.equal(audioRef.current, null); assert.ok(paused.includes(second));
  await render({ ...props, file: file('last.wav') });
  const last = audioRef.current;
  await unmount();
  assert.equal(audioRef.current, null); assert.ok(paused.includes(last)); assert.equal(last.getAttribute('src'), null);
  assert.deepEqual(revoked, created.map((entry) => entry.url));
});

for (const kind of ['audio', 'image']) {
  test(`${kind} decode errors retain the selected filename and clear for a replacement or reset`, async () => {
    const first = file('unsupported-fixture');
    await render({ kind, file: first });
    await event(container.querySelector(kind === 'audio' ? 'audio' : 'img'), 'error');
    assert.match(container.querySelector('[role="status"]').textContent, /Your file is still selected/);
    assert.match(container.textContent, /unsupported-fixture/);
    assert.equal(created[0].file, first);
    assert.deepEqual(revoked, [], 'Decode failure must not discard the selected source');
    await render({ kind, file: file('replacement-fixture') });
    assert.equal(container.querySelector('[role="status"]'), null);
    await event(container.querySelector(kind === 'audio' ? 'audio' : 'img'), 'error');
    await render({ kind, file: null });
    await render({ kind, file: first });
    assert.equal(container.querySelector('[role="status"]'), null);
  });
}

test('missing object URL support gives an actionable message without discarding the selection', async () => {
  URL.createObjectURL = () => { throw new Error('Unsupported local preview'); };
  await render({ kind: 'audio', file: file('kept.wav') });
  assert.match(container.textContent, /kept.wav/);
  assert.match(container.querySelector('[role="status"]').textContent, /Your file is still selected/);
  assert.equal(container.querySelector('audio'), null);
  assert.deepEqual(revoked, []);
});
