/* UI preparation helper against the actual Next route handlers.
 * Prisma, Blob storage, and Next after() jobs are isolated local test doubles.
 * No database, conversion process, or network request is allowed here.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Route dependencies must be isolated before importing TS modules. */
const assert = require('node:assert/strict');
const { test, beforeEach, after } = require('node:test');
const { NextRequest } = require('next/server');
const nextPath = require.resolve('next/server');
const previousNext = require.cache[nextPath].exports;
let jobs;
require.cache[nextPath].exports = { ...previousNext, after: (job) => { jobs.push(job); } };
const storagePath = require.resolve('../../src/lib/audio-storage.ts');
const oldStorage = require.cache[storagePath];
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: {
  originalPathFromUrl(value) {
    const url = new URL(value);
    assert.equal(url.origin, 'https://fixture.private.blob.vercel-storage.com');
    return url.pathname.slice(1);
  },
  checkOriginal: async (pathname) => { assert.match(pathname, /^monstajam\/originals\//); },
  audioToken: () => { throw new Error('The test must not access Blob storage'); },
  getPrivateAudio: () => { throw new Error('The test must not download media'); },
} };
const originalPrisma = globalThis.prisma;
const oldSecret = process.env.ADMIN_SECRET;
const secret = 'local-audio-contract-only';
process.env.ADMIN_SECRET = secret;
let records;
let nextId;
const matches = (row, where) => Object.entries(where).every(([key, value]) =>
  value instanceof Date ? row[key]?.getTime() === value.getTime() : row[key] === value);
globalThis.prisma = { audioAsset: {
  findUnique: async ({ where }) => records.find((row) => matches(row, where)) ?? null,
  findUniqueOrThrow: async ({ where }) => {
    const row = records.find((item) => matches(item, where));
    assert.ok(row); return row;
  },
  create: async ({ data }) => {
    const row = { id: (++nextId).toString(16).padStart(24, '0'), status: 'processing',
      previewDuration: null, previewPath: null, error: null, createdAt: new Date(), updatedAt: new Date(), ...data };
    records.push(row); return row;
  },
  updateMany: async ({ where, data }) => {
    let count = 0;
    records.forEach((row) => { if (matches(row, where)) { Object.assign(row, data); count++; } });
    return { count };
  },
} };
const { POST } = require('../../src/app/api/audio-assets/route.ts');
const { GET } = require('../../src/app/api/audio-assets/[id]/route.ts');
const { prepareAdminAudio } = require('../../src/lib/admin-audio.ts');
const source = { originalUrl: 'https://fixture.private.blob.vercel-storage.com/monstajam/originals/fixture.wav', originalName: 'fixture.wav' };

function routeRequest(authorized = true, finishOnRead = true) {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (authorized) headers.set('cookie', `admin_session=${secret}`);
    const request = new NextRequest(new URL(input, 'http://localhost'), { ...init, headers });
    if (input === '/api/audio-assets') return POST(request);
    const id = input.split('/').at(-1);
    if (finishOnRead) {
      const row = records.find((record) => record.id === id);
      assert.ok(row);
      Object.assign(row, { status: 'ready', previewPath: `monstajam/previews/${id}.mp3`, previewDuration: 45 });
    }
    return GET(request, { params: Promise.resolve({ id }) });
  };
}
const options = (request) => ({ request, wait: async () => {}, onAsset: () => {}, onProgress: () => {} });

beforeEach(() => { records = []; nextId = 0; jobs = []; });
after(() => {
  require.cache[nextPath].exports = previousNext;
  if (oldStorage) require.cache[storagePath] = oldStorage; else delete require.cache[storagePath];
  globalThis.prisma = originalPrisma;
  if (oldSecret === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = oldSecret;
});

test('actual POST/GET contract prepares and polls a real ready asset status without exposing source paths', async () => {
  const result = await prepareAdminAudio(source, 12.5, options(routeRequest()));
  assert.match(result.id, /^[a-f\d]{24}$/);
  assert.equal(result.previewStart, 12.5);
  assert.equal(result.previewDuration, 45);
  assert.equal(result.status, 'ready');
  assert.equal(jobs.length, 1, 'The actual route should schedule exactly one conversion');
  assert.equal('originalPath' in result, false);
  assert.equal('previewPath' in result, false);
});

test('actual route is idempotent and changed start creates a separate asset while the saved clip stays ready', async () => {
  const first = await prepareAdminAudio(source, 12.5, options(routeRequest()));
  const repeated = await prepareAdminAudio(source, 12.5, options(routeRequest()));
  assert.equal(repeated.id, first.id);
  assert.equal(jobs.length, 1);
  const replacement = await prepareAdminAudio({ audioAssetId: first.id }, 30, options(routeRequest()));
  assert.notEqual(replacement.id, first.id);
  assert.equal(replacement.previewStart, 30);
  assert.equal(records.find((row) => row.id === first.id).status, 'ready');
  assert.equal(records.find((row) => row.id === first.id).previewStart, 12.5);
  assert.equal(jobs.length, 2);
});

test('actual authentication and preview-start validation are retained as actionable editor errors', async () => {
  await assert.rejects(prepareAdminAudio(source, 0, options(routeRequest(false))), /session expired/);
  await assert.rejects(prepareAdminAudio(source, 7201, options(routeRequest())), (error) => {
    assert.ok(error.fields.previewStart);
    return true;
  });
  assert.equal(records.length, 0);
});

test('actual stale-job GET becomes a failed job and retry POST claims it without replacing its identity', async () => {
  const request = routeRequest(true, false);
  const response = await request('/api/audio-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...source, previewStart: 0 }) });
  const started = await response.json();
  records[0].updatedAt = new Date(Date.now() - 280000);
  const stale = await request(`/api/audio-assets/${started.id}`);
  const failed = await stale.json();
  assert.equal(failed.status, 'failed');
  const result = await prepareAdminAudio(source, 0, {
    ...options(routeRequest()), previous: { sourceKey: source.originalUrl, previewStart: 0, asset: failed },
  });
  assert.equal(result.id, started.id);
  assert.equal(result.status, 'ready');
  assert.equal(jobs.length, 2);
});
