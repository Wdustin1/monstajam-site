import { mockNamedAdminSession } from './fixtures/admin-session';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

let getAudio: typeof import('../../src/app/api/audio/[slug]/route').GET;
let headAudio: typeof import('../../src/app/api/audio/[slug]/route').HEAD;
const slug = 'private-original-track';
const assetId = '507f1f77bcf86cd799439012';
const secret = 'audio-stream-unit-test';

const originalToken = process.env.AUDIO_READ_WRITE_TOKEN;
const previewPath = 'monstajam/previews/test.mp3';
const originalPath = 'monstajam/originals/test.wav';
const previewBytes = Buffer.from('0123456789');
const originalBytes = Buffer.from('PRIVATE ORIGINAL WITH MORE THAN PREVIEW');
type Query = { where: { slug?: string; id?: string } };
type StoredTrack = { slug: string; published: boolean; audioAssetId: string | null; playbackMode: string | null; genre: string; deletedAt?: Date | null };
type StoredAsset = { id: string; status: string; originalPath: string; previewPath: string | null };
let track: StoredTrack | null;
let asset: StoredAsset | null;
let calls: { kind: string; path?: string; range?: string }[];

async function unexpectedCall(...args: unknown[]): Promise<unknown> {
  throw new Error(`Unexpected unmocked transport/database call: ${JSON.stringify(args)}`);
}
const database = { track: { findUnique: unexpectedCall }, audioAsset: { findUnique: unexpectedCall } };
const storage = { head: unexpectedCall, get: unexpectedCall };
const prismaCache = globalThis as unknown as { prisma?: PrismaClient };
const originalPrisma = prismaCache.prisma;
const requireModule = createRequire(__filename);
const blobModulePath = requireModule.resolve('@vercel/blob');
const originalBlobModule = requireModule.cache[blobModulePath];

before(async () => {
  // Substitute the transport before importing the real route and storage helper.
  // Both Blob head/get calls are local stubs; the SDK cannot contact a store.
  prismaCache.prisma = database as unknown as PrismaClient;
  requireModule.cache[blobModulePath] = {
    id: blobModulePath, filename: blobModulePath, loaded: true, exports: storage,
  } as NodeJS.Module;
  const route = await import('../../src/app/api/audio/[slug]/route');
  getAudio = route.GET;
  headAudio = route.HEAD;
});

beforeEach(() => {
  mockNamedAdminSession(secret);
  process.env.AUDIO_READ_WRITE_TOKEN = 'vercel_blob_rw_fake_store_token';
  track = { slug, published: true, audioAssetId: assetId, playbackMode: 'preview', genre: 'Full Songs' };
  asset = { id: assetId, status: 'ready', originalPath, previewPath };
  calls = [];
  mock.method(database.track, 'findUnique', async (query: Query) => {
    calls.push({ kind: 'track' });
    return query.where.slug === track?.slug ? track : null;
  });
  mock.method(database.audioAsset, 'findUnique', async (query: Query) => {
    calls.push({ kind: 'asset' });
    return query.where.id === asset?.id ? asset : null;
  });
  mock.method(storage, 'head', async (path: string, options: { token: string }) => {
    calls.push({ kind: 'head', path });
    assert.equal(options.token, process.env.AUDIO_READ_WRITE_TOKEN);
    assert.ok(path === previewPath || path === originalPath);
    return { size: path === previewPath ? previewBytes.length : originalBytes.length, contentType: 'audio/wav' };
  });
  mock.method(storage, 'get', async (path: string, options: { access: string; token: string; headers?: { Range?: string } }) => {
    assert.equal(options.access, 'private');
    assert.equal(options.token, process.env.AUDIO_READ_WRITE_TOKEN);
    const bytes = path === previewPath ? previewBytes : originalBytes;
    const range = options.headers?.Range;
    calls.push({ kind: 'get', path, range });
    let body = bytes;
    const headers = new Headers();
    if (range) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      assert.ok(match);
      const start = Number(match[1]);
      const end = Number(match[2]);
      body = bytes.subarray(start, end + 1);
      headers.set('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
    }
    // @vercel/blob get maps an upstream206 to statusCode200 plus Content-Range.
    return { statusCode: 200, headers, blob: { size: body.length }, stream: new Response(new Uint8Array(body)).body };
  });
  mock.method(globalThis, 'fetch', async () => assert.fail('These tests must not perform real network requests'));
});

afterEach(() => {
  mock.restoreAll();


  if (originalToken === undefined) delete process.env.AUDIO_READ_WRITE_TOKEN;
  else process.env.AUDIO_READ_WRITE_TOKEN = originalToken;
});

after(() => {
  if (originalPrisma === undefined) delete prismaCache.prisma;
  else prismaCache.prisma = originalPrisma;
  if (originalBlobModule === undefined) delete requireModule.cache[blobModulePath];
  else requireModule.cache[blobModulePath] = originalBlobModule;
});

function serve(options: { query?: string; cookie?: string; range?: string; method?: 'GET' | 'HEAD' } = {}) {
  const { query = '', cookie, range, method = 'GET' } = options;
  const request = new NextRequest(`http://localhost/api/audio/${slug}${query}`, {
    method,
    headers: { ...(cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : {}), ...(range ? { Range: range } : {}) },
  });
  return (method === 'HEAD' ? headAudio : getAudio)(request, { params: Promise.resolve({ slug }) });
}

function privateHeaders(response: Response) {
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Vary'), 'Cookie');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Location'), null);
}

test('published preview playback fetches only the rendered preview, regardless of genre', async () => {
  const response = await serve();

  assert.equal(response.status, 200);
  assert.equal(await response.text(), previewBytes.toString());
  assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.ok(calls.filter((call) => call.path).every((call) => call.path === previewPath));
  privateHeaders(response);
});

for (const cookie of [undefined, 'invalid-session']) {
  test(`a ${cookie ? 'bad session' : 'public request'} cannot request the full private original`, async () => {
    const response = await serve({ query: '?full=true', cookie });

    assert.equal(response.status, 403);
    assert.equal(calls.some((call) => call.kind === 'head' || call.kind === 'get'), false);
    privateHeaders(response);
  });
}

for (const query of ['?full=1', '?full=false&preview=false', '?mode=full&playbackMode=full&type=original']) {
  test(`${query} cannot override a preview track's stored playback policy`, async () => {
    const response = await serve({ query });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), previewBytes.toString());
    assert.ok(calls.filter((call) => call.path).every((call) => call.path === previewPath));
  });
}

test('a published full track serves its original and can still request its short preview', async () => {
  track!.playbackMode = 'full';
  const full = await serve();
  const preview = await serve({ query: '?preview=true' });

  assert.equal(full.status, 200);
  assert.equal(await full.text(), originalBytes.toString());
  assert.equal(full.headers.get('Content-Type'), 'audio/wav');
  assert.equal(await preview.text(), previewBytes.toString());
});

test('an authenticated admin can audition a preview track original', async () => {
  const response = await serve({ query: '?full=true', cookie: secret });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), originalBytes.toString());
  privateHeaders(response);
});

for (const cookie of [undefined, 'invalid-session']) {
  test(`draft audio is hidden from ${cookie ? 'invalid sessions' : 'signed-out listeners'}`, async () => {
    track!.published = false;
    const response = await serve({ cookie });

    assert.equal(response.status, 404);
    assert.deepEqual(calls, [{ kind: 'track' }]);
    privateHeaders(response);
  });
}

test('an authenticated admin can preview a draft', async () => {
  track!.published = false;
  const response = await serve({ cookie: secret });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), previewBytes.toString());
});

for (const method of ['GET', 'HEAD'] as const) {
  for (const published of [true, false]) {
    for (const access of [
      { label: 'public playback', query: '', cookie: undefined },
      { label: 'admin full audition', query: '?full=true', cookie: secret },
      { label: 'admin preview audition', query: '?preview=true', cookie: secret },
    ]) {
      test(`trashed ${published ? 'published' : 'draft'} audio denies ${method} ${access.label} before any asset or Blob lookup`, async () => {
        track!.published = published;
        track!.deletedAt = new Date();
        const response = await serve({ method, query: access.query, cookie: access.cookie, range: 'bytes=0-1' });
        assert.equal(response.status, 404);
        assert.equal(await response.text(), '');
        assert.deepEqual(calls, [{ kind: 'track' }]);
        privateHeaders(response);
      });
    }
  }
}

test('missing legacy trash fields and explicit null both permit active audio, and trash is rechecked on every request', async () => {
  assert.equal((await serve()).status, 200);
  track!.deletedAt = new Date();
  assert.equal((await serve({ cookie: secret, query: '?full=true' })).status, 404);
  track!.deletedAt = null;
  assert.equal((await serve()).status, 200);
});

test('playback-mode changes are checked on each request instead of trusting a prior URL', async () => {
  const first = await serve();
  track!.playbackMode = 'full';
  const second = await serve();
  track!.playbackMode = 'preview';
  const third = await serve();

  assert.equal(await first.text(), previewBytes.toString());
  assert.equal(await second.text(), originalBytes.toString());
  assert.equal(await third.text(), previewBytes.toString());
  assert.equal(calls.filter((call) => call.kind === 'track').length, 3);
});

for (const [range, expectedRange, expectedBody] of [
  ['bytes=2-5', 'bytes 2-5/10', '2345'],
  ['bytes=6-', 'bytes 6-9/10', '6789'],
  ['bytes=8-999', 'bytes 8-9/10', '89'],
  ['bytes=-3', 'bytes 7-9/10', '789'],
  ['bytes=-100', 'bytes 0-9/10', '0123456789'],
  ['bytes=0-0', 'bytes 0-0/10', '0'],
] as const) {
  test(`preview range ${range} stays within preview bytes`, async () => {
    const response = await serve({ range });

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), expectedRange);
    assert.equal(response.headers.get('Content-Length'), String(expectedBody.length));
    assert.equal(await response.text(), expectedBody);
    assert.ok(calls.filter((call) => call.path).every((call) => call.path === previewPath));
    privateHeaders(response);
  });
}

for (const range of ['bytes=10-', 'bytes=20-30', 'bytes=5-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'items=0-1', 'bytes=9007199254740992-']) {
  test(`rejects unsatisfiable or malformed preview range ${range}`, async () => {
    const response = await serve({ range });

    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */10');
    assert.equal(calls.some((call) => call.kind === 'get'), false);
    privateHeaders(response);
  });
}

test('HEAD exposes preview length without downloading bytes or leaking original length', async () => {
  const response = await serve({ method: 'HEAD' });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Length'), String(previewBytes.length));
  assert.equal(await response.text(), '');
  assert.equal(calls.some((call) => call.kind === 'get'), false);
  privateHeaders(response);
});

test('HEAD applies the same full-original and draft access controls', async () => {
  assert.equal((await serve({ method: 'HEAD', query: '?full=true' })).status, 403);
  track!.published = false;
  assert.equal((await serve({ method: 'HEAD' })).status, 404);
  const admin = await serve({ method: 'HEAD', query: '?full=true', cookie: secret });
  assert.equal(admin.status, 200);
  assert.equal(admin.headers.get('Content-Length'), String(originalBytes.length));
  assert.equal(calls.some((call) => call.kind === 'get'), false);
});

for (const unavailable of ['missing track', 'legacy track', 'missing asset', 'processing', 'failed', 'missing preview']) {
  test(`${unavailable} does not stream a private original`, async () => {
    if (unavailable === 'missing track') track = null;
    else if (unavailable === 'legacy track') track!.audioAssetId = null;
    else if (unavailable === 'missing asset') asset = null;
    else if (unavailable === 'missing preview') asset!.previewPath = null;
    else asset!.status = unavailable;

    const response = await serve();

    assert.equal(response.status, 404);
    assert.equal(calls.some((call) => call.kind === 'head' || call.kind === 'get'), false);
    privateHeaders(response);
  });
}

test('storage errors return a generic uncached response without revealing private paths', async () => {
  mock.method(storage, 'head', async () => { throw new Error(`private storage failed at ${originalPath}`); });

  const response = await serve();

  assert.equal(response.status, 503);
  assert.equal(await response.text(), '');
  privateHeaders(response);
});

test('a missing preview object cannot fall back to the original', async () => {
  mock.method(storage, 'get', async () => null);

  const response = await serve();

  assert.equal(response.status, 404);
  assert.ok(calls.filter((call) => call.path).every((call) => call.path === previewPath));
  privateHeaders(response);
});
