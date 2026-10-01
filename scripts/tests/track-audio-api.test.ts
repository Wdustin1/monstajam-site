import { mockNamedAdminSession } from './fixtures/admin-session';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import type { AudioAsset, Prisma, PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

type Track = Prisma.TrackGetPayload<{ include: { credits: true } }>;
type Query = { where?: { slug?: string; id?: string; published?: boolean; genre?: string }; data?: Record<string, unknown> };
let createTrack: typeof import('../../src/app/api/tracks/route').POST;
let listTracks: typeof import('../../src/app/api/tracks/route').GET;
let updateTrack: typeof import('../../src/app/api/tracks/[slug]/route').PUT;
let getTrack: typeof import('../../src/app/api/tracks/[slug]/route').GET;

const slug = 'managed-audio-track';
const secret = 'track-audio-unit-test';

const assetId = '507f1f77bcf86cd799439012';
const legacy: Track = {
  id: '507f1f77bcf86cd799439011', slug, number: 1, title: 'Existing track',
  subtitle: null, artist: 'MonstaJam', genre: 'Hip-Hop', bpm: 120, mood: 'Calm',
  color: 'bg-purple-500', accentCyan: false, story: 'Original story',
  spotifyUrl: 'https://open.spotify.com/track/example',
  appleMusicUrl: 'https://music.apple.com/us/album/example',
  audioUrl: 'https://example.invalid/legacy.mp3', coverUrl: 'https://example.invalid/cover.png',
  playbackMode: null, audioAssetId: null, published: true,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'), credits: [],
};
const ready: AudioAsset = {
  id: assetId, key: 'a'.repeat(64), originalPath: 'private/originals/track.wav',
  originalName: 'track.wav', previewPath: 'private/previews/track.mp3',
  previewStart: 12, previewDuration: 45, status: 'ready', error: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
};
const createInput = { slug, title: 'New track', artist: 'MonstaJam', number: 2 };
let stored: Track | null;
let asset: AudioAsset | null;
let writes: { method: 'create' | 'update'; data: Record<string, unknown> }[];
let reads: string[];

async function unmockedQuery(query?: Query): Promise<unknown> {
  throw new Error(`Unexpected unmocked database access: ${JSON.stringify(query)}`);
}
const database = {
  track: { findUnique: unmockedQuery, findMany: unmockedQuery, create: unmockedQuery, update: unmockedQuery },
  audioAsset: { findUnique: unmockedQuery },
};
const prismaCache = globalThis as unknown as { prisma?: PrismaClient };
const originalPrisma = prismaCache.prisma;

before(async () => {
  // This cache is set before importing routes; no real database client is created.
  prismaCache.prisma = database as unknown as PrismaClient;
  const collection = await import('../../src/app/api/tracks/route');
  const detail = await import('../../src/app/api/tracks/[slug]/route');
  createTrack = collection.POST;
  listTracks = collection.GET;
  updateTrack = detail.PUT;
  getTrack = detail.GET;
});

beforeEach(() => {
  mockNamedAdminSession(secret);
  stored = { ...legacy, credits: [] };
  asset = { ...ready };
  writes = [];
  reads = [];
  mock.method(console, 'error', () => {});
  mock.method(database.track, 'findUnique', async (query?: Query) => {
    reads.push('track');
    return query?.where?.slug === stored?.slug ? stored : null;
  });
  mock.method(database.track, 'findMany', async (query?: Query) => {
    reads.push('tracks');
    return stored && (!query?.where?.published || stored.published) ? [stored] : [];
  });
  mock.method(database.audioAsset, 'findUnique', async (query?: Query) => {
    reads.push('asset');
    return query?.where?.id === asset?.id ? asset : null;
  });
  mock.method(database.track, 'create', async (query?: Query) => {
    const data = query?.data ?? {};
    writes.push({ method: 'create', data });
    stored = { ...legacy, audioUrl: null, published: false, ...data } as Track;
    return stored;
  });
  mock.method(database.track, 'update', async (query?: Query) => {
    assert.ok(stored, 'a missing track cannot be updated');
    const data = query?.data ?? {};
    writes.push({ method: 'update', data });
    stored = { ...stored, ...data } as Track;
    return stored;
  });
});

afterEach(() => {
  mock.restoreAll();


});

after(() => {
  if (originalPrisma === undefined) delete prismaCache.prisma;
  else prismaCache.prisma = originalPrisma;
});

function request(path: string, method: string, body?: unknown, cookie: string | null = secret) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', ...(cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function post(body: unknown, cookie: string | null = secret) {
  return createTrack(request('/api/tracks', 'POST', body, cookie));
}

function put(body: unknown, cookie: string | null = secret) {
  return updateTrack(request(`/api/tracks/${slug}`, 'PUT', body, cookie), { params: Promise.resolve({ slug }) });
}

function detail(query = '', cookie: string | null = null) {
  return getTrack(request(`/api/tracks/${slug}${query}`, 'GET', undefined, cookie), { params: Promise.resolve({ slug }) });
}

async function invalid(response: Response, field: string) {
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error, 'Validation failed');
  assert.ok(body.details[field]?.length);
  assert.equal(writes.length, 0);
}

test('new managed audio defaults to preview independently of genre', async () => {
  const response = await post({ ...createInput, genre: 'Full Songs', audioAssetId: assetId });

  assert.equal(response.status, 201);
  assert.equal(stored?.playbackMode, 'preview');
  assert.equal(stored?.audioAssetId, assetId);
  assert.equal(stored?.audioUrl, null);
  assert.equal(writes.length, 1);
  const serialized = JSON.stringify(await response.json());
  assert.equal(serialized.includes(ready.originalPath), false);
  assert.equal(serialized.includes(ready.previewPath!), false);
});

test('new managed audio may explicitly enable full playback', async () => {
  const response = await post({ ...createInput, audioAssetId: assetId, playbackMode: 'full' });

  assert.equal(response.status, 201);
  assert.equal(stored?.playbackMode, 'full');
});

test('new tracks without audio retain draft creation and optional metadata clearing support', async () => {
  const response = await post({
    ...createInput, bpm: null, mood: null, story: null, spotifyUrl: null, appleMusicUrl: null,
  });

  assert.equal(response.status, 201);
  assert.equal(stored?.playbackMode, 'preview');
  assert.equal(stored?.audioAssetId, null);
  assert.equal(stored?.mood, null);
  assert.equal(stored?.spotifyUrl, null);
});

test('existing no-audio publish behavior is not changed by audio attachment validation', async () => {
  const response = await post({ ...createInput, published: true });

  assert.equal(response.status, 201);
  assert.equal(stored?.published, true);
});

for (const includeAsset of [false, true]) {
  test(`new raw audio URLs are rejected ${includeAsset ? 'even with a managed asset' : 'without a managed asset'}`, async () => {
    await invalid(await post({ ...createInput, audioUrl: legacy.audioUrl, ...(includeAsset ? { audioAssetId: assetId } : {}) }), 'audioUrl');
  });
}

for (const state of ['processing', 'failed', 'missing', 'missing preview', 'missing original']) {
  for (const operation of ['create', 'update'] as const) {
    test(`${operation} rejects ${state} audio while preserving the existing track`, async () => {
      if (state === 'missing') asset = null;
      else if (state === 'missing preview') asset!.previewPath = null;
      else if (state === 'missing original') asset!.originalPath = '';
      else asset!.status = state;
      const previous = structuredClone(stored);
      const response = operation === 'create'
        ? await post({ ...createInput, audioAssetId: assetId })
        : await put({ title: 'Must not replace saved title', audioAssetId: assetId });

      await invalid(response, 'audioAssetId');
      assert.deepEqual(stored, previous);
    });
  }
}

test('attaching ready audio clears the legacy URL in the same atomic track update', async () => {
  const response = await put({ audioAssetId: assetId, title: 'Updated title' });

  assert.equal(response.status, 200);
  assert.deepEqual(writes, [{ method: 'update', data: {
    audioAssetId: assetId, title: 'Updated title', audioUrl: null, playbackMode: 'preview',
  } }]);
  assert.equal(stored?.audioAssetId, assetId);
  assert.equal(stored?.audioUrl, null);
});

test('replacing a managed asset commits its new identity in one update', async () => {
  stored!.audioAssetId = '507f1f77bcf86cd799439010';
  stored!.audioUrl = null;
  stored!.playbackMode = 'full';

  assert.equal((await put({ audioAssetId: assetId })).status, 200);
  assert.deepEqual(writes, [{ method: 'update', data: { audioAssetId: assetId, audioUrl: null } }]);
});

for (const value of [null, '', 'not-an-object-id', 'g'.repeat(24)]) {
  test(`a managed asset cannot be detached or replaced with invalid identity ${String(value)}`, async () => {
    stored!.audioAssetId = assetId;
    stored!.audioUrl = null;
    const previous = structuredClone(stored);

    await invalid(await put({ audioAssetId: value, audioUrl: 'https://example.invalid/raw.mp3' }), 'audioAssetId');
    assert.deepEqual(stored, previous);
  });
}

for (const replacement of ['https://example.invalid/new.mp3', '']) {
  test(`changing the legacy raw audio URL to ${replacement || 'empty'} is rejected`, async () => {
    const previous = structuredClone(stored);

    await invalid(await put({ audioUrl: replacement }), 'audioUrl');
    assert.deepEqual(stored, previous);
  });
}

test('resubmitting an unchanged legacy URL preserves it during a metadata edit', async () => {
  const response = await put({ title: 'Updated metadata', audioUrl: legacy.audioUrl });

  assert.equal(response.status, 200);
  assert.equal(stored?.audioUrl, legacy.audioUrl);
  assert.equal(stored?.audioAssetId, null);
});

for (const [originalGenre, editedGenre, expectedMode] of [
  ['Full Songs', 'Hip-Hop', 'full'],
  ['Hip-Hop', 'Full Songs', 'preview'],
] as const) {
  test(`legacy ${originalGenre} tracks retain ${expectedMode} when genre becomes ${editedGenre}`, async () => {
    stored!.genre = originalGenre;

    const response = await put({ genre: editedGenre });

    assert.equal(response.status, 200);
    assert.equal(stored?.genre, editedGenre);
    assert.equal(stored?.playbackMode, expectedMode);
    assert.equal(stored?.audioUrl, legacy.audioUrl);
  });
}

test('explicit playback mode overrides genre and persists across later genre edits', async () => {
  assert.equal((await put({ playbackMode: 'full' })).status, 200);
  assert.equal((await put({ genre: 'Other' })).status, 200);
  assert.equal(stored?.playbackMode, 'full');
});

test('managed audio metadata updates preserve attachment and clear optional fields', async () => {
  stored!.audioAssetId = assetId;
  stored!.audioUrl = null;
  stored!.playbackMode = 'preview';
  const changes = { bpm: null, mood: null, story: null, spotifyUrl: null, appleMusicUrl: null };

  assert.equal((await put(changes)).status, 200);
  for (const key of Object.keys(changes) as (keyof typeof changes)[]) assert.equal(stored![key], null);
  assert.equal(stored?.audioAssetId, assetId);
  assert.equal(stored?.audioUrl, null);
  assert.equal(reads.includes('asset'), false, 'unchanged audio must not be reprocessed');
});

for (const mode of [null, 'all', true]) {
  test(`invalid playback mode ${String(mode)} is rejected before creating or updating`, async () => {
    await invalid(await post({ ...createInput, playbackMode: mode }), 'playbackMode');
    await invalid(await put({ playbackMode: mode }), 'playbackMode');
  });
}

test('deprecated previewOnly is not sent to Prisma and cannot opt into full playback', async () => {
  assert.equal((await post({ ...createInput, previewOnly: false })).status, 201);
  assert.equal(Object.hasOwn(writes[0].data, 'previewOnly'), false);
  assert.equal(stored?.playbackMode, 'preview');
});

for (const cookie of [null, 'invalid-session']) {
  test(`create and update reject ${cookie === null ? 'missing' : 'invalid'} authentication before asset lookups`, async () => {
    assert.equal((await post({ ...createInput, audioAssetId: assetId }, cookie)).status, 401);
    assert.equal((await put({ audioAssetId: assetId }, cookie)).status, 401);
    assert.deepEqual(reads, []);
    assert.deepEqual(writes, []);
  });
}

test('updating a missing track returns404 without trying to attach an asset', async () => {
  stored = null;

  assert.equal((await put({ audioAssetId: assetId })).status, 404);
  assert.deepEqual(reads, ['track']);
  assert.deepEqual(writes, []);
});

test('public detail and listing expose the controlled audio endpoint, not asset metadata', async () => {
  stored!.audioAssetId = assetId;
  stored!.playbackMode = 'preview';
  for (const response of [await detail(), await listTracks(request('/api/tracks', 'GET', undefined, null))]) {
    assert.equal(response.status, 200);
    const body = await response.json();
    const publicTrack = Array.isArray(body) ? body[0] : body;
    assert.equal(publicTrack.audioUrl, `/api/audio/${slug}?v=${legacy.updatedAt.getTime()}`);
    assert.equal(publicTrack.playbackMode, 'preview');
    assert.equal(Object.hasOwn(publicTrack, 'audioAssetId'), false);
    assert.equal(JSON.stringify(body).includes(ready.originalPath), false);
    assert.equal(JSON.stringify(body).includes(ready.previewPath!), false);
  }
  assert.equal(reads.includes('asset'), false);
});

test('authenticated admin reads retain attachment identity without private storage paths', async () => {
  stored!.audioAssetId = assetId;
  stored!.audioUrl = null;
  stored!.published = false;
  for (const response of [
    await detail('?preview=true', secret),
    await listTracks(request('/api/tracks?all=true', 'GET')),
  ]) {
    assert.equal(response.status, 200);
    const body = await response.json();
    const adminTrack = Array.isArray(body) ? body[0] : body;
    assert.equal(adminTrack.audioAssetId, assetId);
    assert.equal(JSON.stringify(body).includes(ready.originalPath), false);
    assert.equal(JSON.stringify(body).includes(ready.previewPath!), false);
  }
  assert.equal(reads.includes('asset'), false);
});

test('draft audio metadata remains hidden on ordinary detail URLs', async () => {
  stored!.audioAssetId = assetId;
  stored!.published = false;

  assert.equal((await detail('', secret)).status, 404);
  assert.equal((await detail('?preview=true')).status, 404);
  assert.equal((await detail('?preview=true', 'invalid-session')).status, 404);
});

test('legacy public audio stays readable while its resolved mode is explicit', async () => {
  stored!.genre = 'Full Songs';
  const response = await detail();

  assert.equal(response.status, 200);
  const publicTrack = await response.json();
  assert.equal(publicTrack.audioUrl, legacy.audioUrl);
  assert.equal(publicTrack.playbackMode, 'full');
});
