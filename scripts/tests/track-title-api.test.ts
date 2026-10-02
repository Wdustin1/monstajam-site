import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { adminAuthorization } from '../../src/lib/auth';
import { slugifyTrackTitle, TRACK_TITLE_CONFLICT, TRACK_TITLE_TRASH_CONFLICT, TRACK_TITLE_CREATE_CONFLICT } from '../../src/lib/track-title';
import { TrackUpdateSchema } from '../../src/lib/schemas';
import { mockNamedAdminSession } from './fixtures/admin-session';

type Query = { where?: { slug?: string }; select?: { id?: boolean }; data?: Record<string, unknown> };
let checkTitle: typeof import('../../src/app/api/admin/track-title/route').GET;
let createTrack: typeof import('../../src/app/api/tracks/route').POST;
const session = 'track-title-test-session';
const input = { title: 'Cold World', slug: 'cold-world', artist: 'MonstaJam', number: 1 };
let occupied: Record<string, unknown> | null;
let lookupError: Error | undefined;
let createError: Error | undefined;
let reads: Query[];
let writes: Query[];

async function unexpectedQuery(query?: Query): Promise<unknown> { throw new Error(`Unexpected database operation: ${JSON.stringify(query)}`); }
const database = { track: { findUnique: unexpectedQuery, create: unexpectedQuery }, audioAsset: { findUnique: unexpectedQuery } };
const cache = globalThis as typeof globalThis & { prisma?: PrismaClient };
const previousPrisma = cache.prisma;

before(async () => {
  cache.prisma = database as unknown as PrismaClient;
  checkTitle = (await import('../../src/app/api/admin/track-title/route')).GET;
  createTrack = (await import('../../src/app/api/tracks/route')).POST;
});

beforeEach(() => {
  mockNamedAdminSession(session);
  occupied = null;
  lookupError = undefined;
  createError = undefined;
  reads = [];
  writes = [];
  mock.method(console, 'error', () => {});
  mock.method(database.track, 'findUnique', async (query: Query = {}) => {
    reads.push(query);
    if (lookupError) throw lookupError;
    return query.where?.slug === occupied?.slug ? occupied : null;
  });
  mock.method(database.track, 'create', async (query: Query = {}) => {
    writes.push(query);
    if (createError) throw createError;
    return { id: 'new-track-id', ...query.data };
  });
});

afterEach(() => mock.restoreAll());
after(() => {
  if (previousPrisma === undefined) delete cache.prisma;
  else cache.prisma = previousPrisma;
});

function check(title: string | undefined, cookie: string | null = session) {
  const url = new URL('http://localhost/api/admin/track-title');
  if (title !== undefined) url.searchParams.set('title', title);
  return checkTitle(new NextRequest(url, { headers: cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : {} }));
}

function post(body: unknown = input, cookie: string | null = session) {
  return createTrack(new NextRequest('http://localhost/api/tracks', {
    method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', ...(cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : {}) },
    body: JSON.stringify(body),
  }));
}

function privateResponse(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
}

function uniqueError(target: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError('Database unique constraint failure', { code: 'P2002', clientVersion: 'test', meta: { modelName: 'Track', target } });
}

test('title slugging preserves the existing ASCII and punctuation rules', () => {
  assert.equal(slugifyTrackTitle('  Cold WORLD!  '), 'cold-world');
  assert.equal(slugifyTrackTitle('One___Two / Three'), 'one-two-three');
  assert.equal(slugifyTrackTitle('Beyoncé & Déjà Vu'), 'beyonc-d-j-vu');
  assert.equal(slugifyTrackTitle('你好 🎵 !!!'), '');
});

for (const cookie of [null, 'forged-cookie', 'old-shared-password']) {
  test(`title check with ${cookie ?? 'no session'} cannot disclose a draft or query the database`, async () => {
    occupied = { id: 'draft-id', slug: 'cold-world', title: 'Secret draft', published: false, audioAssetId: 'private-asset' };
    const response = await check('Cold World', cookie);
    assert.equal(response.status, 401);
    privateResponse(response);
    const body = await response.json();
    assert.equal(typeof body.error, 'string');
    assert.ok(!('slug' in body) && !('available' in body) && !('details' in body));
    assert.deepEqual(reads, []);
    assert.deepEqual(writes, []);
  });
}

test('unauthorized malformed titles are rejected before validation', async () => {
  const response = await check('!!!', null);
  assert.equal(response.status, 401);
  assert.deepEqual(reads, []);
});

test('available title returns its canonical slug with one minimal unique lookup', async () => {
  const response = await check('  Cold WORLD!  ');
  assert.equal(response.status, 200);
  privateResponse(response);
  assert.deepEqual(await response.json(), { slug: 'cold-world', available: true });
  assert.deepEqual(reads, [{ where: { slug: 'cold-world' }, select: { id: true, deletedAt: true } }]);
  assert.deepEqual(writes, []);
});

for (const published of [false, true]) {
  test(`${published ? 'published' : 'draft'} tracks reserve their slug and return only a useful title conflict`, async () => {
    occupied = { id: 'existing-id', slug: 'cold-world', title: 'Existing private metadata', published, audioAssetId: 'private-asset' };
    const response = await check('COLD__WORLD');
    assert.equal(response.status, 409);
    privateResponse(response);
    assert.deepEqual(await response.json(), { error: TRACK_TITLE_CONFLICT, details: { title: [TRACK_TITLE_CONFLICT] } });
    assert.deepEqual(reads, [{ where: { slug: 'cold-world' }, select: { id: true, deletedAt: true } }]);
  });
}

test('a trashed track reserves its link with specific restore guidance', async () => {
  occupied = { id: 'trashed-id', slug: 'cold-world', deletedAt: new Date(), published: false };
  const response = await check('Cold World');
  assert.equal(response.status, 409);
  privateResponse(response);
  assert.deepEqual(await response.json(), { error: TRACK_TITLE_TRASH_CONFLICT, details: { title: [TRACK_TITLE_TRASH_CONFLICT] } });
  assert.equal(reads.length, 1);
  assert.deepEqual(writes, []);
});

for (const title of [undefined, '', '   ', '!!!', '你好 🎵', 'a'.repeat(201)]) {
  test(`invalid title ${title === undefined ? '(missing)' : JSON.stringify(title.slice(0, 12))} fails before any database lookup`, async () => {
    const response = await check(title);
    assert.equal(response.status, 422);
    privateResponse(response);
    const body = await response.json();
    assert.ok(body.details.title[0]);
    assert.equal(body.error, body.details.title[0]);
    assert.deepEqual(reads, []);
  });
}

test('the title limit applies after trimming and accepts exactly 200 characters', async () => {
  const response = await check(` ${'a'.repeat(200)} `);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { slug: 'a'.repeat(200), available: true });
});

test('database failure returns a private retry response without internal diagnostics', async () => {
  lookupError = new Error('internal database connection details');
  const response = await check('Cold World');
  assert.equal(response.status, 503);
  privateResponse(response);
  const body = await response.json();
  assert.match(body.error, /try again/i);
  assert.ok(!JSON.stringify(body).includes('connection details'));
});

test('identity lookup failure does not check a title or expose its state', async () => {
  mock.method(adminAuthorization, 'getIdentity', async () => { throw new Error('identity database unavailable'); });
  const response = await check('Cold World');
  assert.equal(response.status, 503);
  privateResponse(response);
  assert.deepEqual(reads, []);
});

for (const target of [['slug'], 'tracks_slug_key', 'Track_slug_key', 'slug_1']) {
  test(`final create maps Prisma slug uniqueness target ${JSON.stringify(target)} to a title conflict`, async () => {
    createError = uniqueError(target);
    const response = await post();
    assert.equal(response.status, 409);
    privateResponse(response);
    assert.deepEqual(await response.json(), { error: TRACK_TITLE_CREATE_CONFLICT, details: { title: [TRACK_TITLE_CREATE_CONFLICT] } });
    assert.equal(writes.length, 1);
    assert.deepEqual(reads, [], 'Final create relies on the unique index, not another pre-create lookup');
  });
}

test('a concurrent save after a successful preflight still receives the same useful conflict', async () => {
  assert.equal((await check('Cold World')).status, 200);
  occupied = { id: 'concurrent-track', slug: 'cold-world', published: false };
  createError = uniqueError('tracks_slug_key');
  const response = await post();
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: TRACK_TITLE_CREATE_CONFLICT, details: { title: [TRACK_TITLE_CREATE_CONFLICT] } });
  assert.equal(reads.length, 1, 'Only the preflight reads the slug');
  assert.equal(writes.length, 1);
});

test('non-slug unique failures remain server errors instead of blaming the title', async () => {
  createError = uniqueError('_id_');
  const response = await post();
  assert.equal(response.status, 500);
  privateResponse(response);
  assert.deepEqual(await response.json(), { error: 'Failed to create track' });
});

test('successful creation trims the title without an unnecessary uniqueness lookup', async () => {
  const response = await post({ ...input, title: '  Cold World  ' });
  assert.equal(response.status, 201);
  privateResponse(response);
  assert.equal(writes[0].data?.title, 'Cold World');
  assert.deepEqual(reads, []);
});

for (const title of ['   ', 'a'.repeat(201)]) {
  test(`final create rejects invalid title ${JSON.stringify(title.slice(0, 12))} even if a slug is supplied`, async () => {
    const response = await post({ ...input, title });
    assert.equal(response.status, 422);
    assert.ok((await response.json()).details.title[0]);
    assert.deepEqual(writes, []);
    assert.deepEqual(reads, []);
  });
}

test('Unicode titles remain valid for existing edits and API creates with an explicit valid slug', async () => {
  assert.deepEqual(TrackUpdateSchema.parse({ title: '  你好 🎵  ' }), { title: '你好 🎵' });
  const response = await post({ ...input, title: '你好 🎵', slug: 'hello-music' });
  assert.equal(response.status, 201);
  assert.equal(writes[0].data?.title, '你好 🎵');
  assert.equal(writes[0].data?.slug, 'hello-music');
});

test('anonymous final creation neither writes nor reports a duplicate draft', async () => {
  createError = uniqueError('tracks_slug_key');
  const response = await post(input, null);
  assert.equal(response.status, 401);
  privateResponse(response);
  assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  assert.deepEqual(writes, []);
});
