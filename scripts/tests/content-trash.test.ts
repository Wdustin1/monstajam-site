import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { activeContentWhere, CONTENT_CHANGED, isContentTrashed, trashedContentWhere } from '../../src/lib/content-trash';
import { mockNamedAdminSession } from './fixtures/admin-session';

type Row = Record<string, unknown>;
type Query = { where?: Row; data?: Row; select?: Row; include?: Row; orderBy?: Row | Row[] };
type Model = 'track' | 'video';
const session = 'content-trash-test-session';
const trackId = '507f1f77bcf86cd799439011';
const videoId = '507f1f77bcf86cd799439012';
const slug = 'preserved-track';
const baseTrack = {
  id: trackId, slug, number: 1, title: 'Preserved track', artist: 'MonstaJam', genre: 'Hip-Hop',
  subtitle: 'Subtitle', bpm: 100, mood: 'Calm', story: 'Keep this story', color: 'bg-blue-500',
  spotifyUrl: 'https://open.spotify.com/track/example', appleMusicUrl: null, audioUrl: null,
  audioAssetId: '507f1f77bcf86cd799439099', playbackMode: 'full', coverUrl: 'https://example.invalid/art.png',
  published: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01'),
  credits: [{ id: 'credit-id', trackId, role: 'Producer', name: 'Dustin' }],
};
const baseVideo = {
  id: videoId, title: 'Preserved video', artist: 'MonstaJam', duration: '3:00',
  youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ',
  order: 1, published: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01'),
};
let rows: Record<Model, Row[]>;
let reads: { model: Model; method: string; query: Query }[];
let writes: { model: Model; query: Query }[];
let applied: number;
let failDatabase: boolean;
let beforeUpdate: ((model: Model, row: Row) => void) | undefined;
let listTracks: typeof import('../../src/app/api/tracks/route').GET;
let listVideos: typeof import('../../src/app/api/videos/route').GET;
let getTrack: typeof import('../../src/app/api/tracks/[slug]/route').GET;
let putTrack: typeof import('../../src/app/api/tracks/[slug]/route').PUT;
let putVideo: typeof import('../../src/app/api/videos/[id]/route').PUT;
let deleteTrack: typeof import('../../src/app/api/tracks/[slug]/route').DELETE;
let deleteVideo: typeof import('../../src/app/api/videos/[id]/route').DELETE;
let listTrash: typeof import('../../src/app/api/admin/trash/route').GET;
let restoreTrack: typeof import('../../src/app/api/admin/trash/tracks/[slug]/restore/route').POST;
let restoreVideo: typeof import('../../src/app/api/admin/trash/videos/[id]/restore/route').POST;

async function unexpected(): Promise<never> { throw new Error('Unexpected database operation'); }
const database = {
  track: { findUnique: unexpected, findMany: unexpected, update: unexpected, delete: unexpected },
  video: { findUnique: unexpected, findMany: unexpected, update: unexpected, delete: unexpected },
  credit: { deleteMany: unexpected }, audioAsset: { findUnique: unexpected, delete: unexpected, update: unexpected },
};
const cache = globalThis as typeof globalThis & { prisma?: PrismaClient };
const previousPrisma = cache.prisma;

// This models only the query operators exercised here; tests also assert the
// exact guards passed to Prisma. No client, database, storage, or network runs.
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([field, filter]) => {
    if (field === 'AND') return (Array.isArray(filter) ? filter : [filter]).every(part => matches(row, part as Row));
    if (field === 'OR') return (filter as Row[]).some(part => matches(row, part));
    if (filter && typeof filter === 'object' && !(filter instanceof Date)) {
      const condition = filter as Row;
      return (!('isSet' in condition) || Object.hasOwn(row, field) === condition.isSet)
        && (!('not' in condition) || (Object.hasOwn(row, field) && row[field] !== condition.not));
    }
    // Mongo's explicit null filter must not accidentally stand in for missing.
    return Object.hasOwn(row, field) && (filter instanceof Date
      ? row[field] instanceof Date && +(row[field] as Date) === +filter
      : row[field] === filter);
  });
}
function missing() { return new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'test' }); }

before(async () => {
  cache.prisma = database as unknown as PrismaClient;
  listTracks = (await import('../../src/app/api/tracks/route')).GET;
  listVideos = (await import('../../src/app/api/videos/route')).GET;
  const track = await import('../../src/app/api/tracks/[slug]/route');
  const video = await import('../../src/app/api/videos/[id]/route');
  getTrack = track.GET; putTrack = track.PUT; deleteTrack = track.DELETE;
  putVideo = video.PUT; deleteVideo = video.DELETE;
  listTrash = (await import('../../src/app/api/admin/trash/route')).GET;
  restoreTrack = (await import('../../src/app/api/admin/trash/tracks/[slug]/restore/route')).POST;
  restoreVideo = (await import('../../src/app/api/admin/trash/videos/[id]/restore/route')).POST;
});

beforeEach(() => {
  mockNamedAdminSession(session);
  mock.method(console, 'error', () => {});
  rows = { track: [structuredClone(baseTrack)], video: [structuredClone(baseVideo)] };
  mock.method(database.audioAsset, 'findUnique', async () => ({ status: 'ready', originalPath: 'private/original.wav', previewPath: 'private/preview.mp3', previewStart: 0, previewDuration: 45 }));
  reads = []; writes = []; applied = 0; failDatabase = false; beforeUpdate = undefined;
  for (const model of ['track', 'video'] as const) {
    mock.method(database[model], 'findUnique', async (query: Query) => {
      reads.push({ model, method: 'findUnique', query });
      if (failDatabase) throw new Error('Private database connection information');
      const row = rows[model].find(item => matches(item, query.where));
      return row ? structuredClone(row) : null;
    });
    mock.method(database[model], 'findMany', async (query: Query) => {
      reads.push({ model, method: 'findMany', query });
      if (failDatabase) throw new Error('Private database connection information');
      const found = rows[model].filter(item => matches(item, query.where));
      if (!Array.isArray(query.orderBy) && query.orderBy?.deletedAt === 'desc') {
        found.sort((a, b) => +(b.deletedAt as Date) - +(a.deletedAt as Date));
      }
      return structuredClone(found);
    });
    mock.method(database[model], 'update', async (query: Query) => {
      writes.push({ model, query });
      if (failDatabase) throw new Error('Private database connection information');
      const row = rows[model].find(item => item.id === query.where?.id || item.slug && item.slug === query.where?.slug);
      if (row) beforeUpdate?.(model, row);
      if (!row || !matches(row, query.where)) throw missing();
      Object.assign(row, query.data, { updatedAt: new Date() });
      applied += 1;
      return structuredClone(row);
    });
  }
});
afterEach(() => mock.restoreAll());
after(() => { if (previousPrisma === undefined) delete cache.prisma; else cache.prisma = previousPrisma; });

function request(path: string, method = 'GET', token: string | null = session, body?: unknown, origin = 'http://localhost') {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Origin: origin, ...(token ? { Cookie: `monstajam_auth.session_token=${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function privateResponse(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
}
const trackContext = () => ({ params: Promise.resolve({ slug }) });
const videoContext = () => ({ params: Promise.resolve({ id: videoId }) });
function move(model: Model, token: string | null = session, origin = 'http://localhost') {
  return model === 'track'
    ? deleteTrack(request(`/api/tracks/${slug}`, 'DELETE', token, undefined, origin), trackContext())
    : deleteVideo(request(`/api/videos/${videoId}`, 'DELETE', token, undefined, origin), videoContext());
}
function restore(model: Model, token: string | null = session, origin = 'http://localhost') {
  return model === 'track'
    ? restoreTrack(request(`/api/admin/trash/tracks/${slug}/restore`, 'POST', token, undefined, origin), trackContext())
    : restoreVideo(request(`/api/admin/trash/videos/${videoId}/restore`, 'POST', token, undefined, origin), videoContext());
}
function update(model: Model, body: Row) {
  return model === 'track'
    ? putTrack(request(`/api/tracks/${slug}`, 'PUT', session, body), trackContext())
    : putVideo(request(`/api/videos/${videoId}`, 'PUT', session, body), videoContext());
}
function retained(row: Row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !['deletedAt', 'deletedBy', 'published', 'updatedAt'].includes(key)));
}

test('active predicate includes legacy missing fields and explicit null while trash requires a real timestamp', () => {
  assert.deepEqual(activeContentWhere(), { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] });
  assert.equal(matches({}, activeContentWhere()), true);
  assert.equal(matches({ deletedAt: null }, activeContentWhere()), true);
  assert.equal(matches({ deletedAt: new Date() }, activeContentWhere()), false);
  assert.equal(matches({}, trashedContentWhere()), false);
  assert.equal(matches({ deletedAt: null }, trashedContentWhere()), false);
  assert.equal(isContentTrashed({}), false);
  assert.equal(isContentTrashed({ deletedAt: null }), false);
  assert.equal(isContentTrashed({ deletedAt: new Date() }), true);
});

for (const token of [null, 'forged-session']) {
  test(`unauthorized ${token ?? 'anonymous'} cannot list, trash, or restore either content type`, async () => {
    const responses = await Promise.all([listTrash(request('/api/admin/trash', 'GET', token)), move('track', token), move('video', token), restore('track', token), restore('video', token)]);
    for (const response of responses) { assert.equal(response.status, 401); privateResponse(response); }
    assert.deepEqual(reads, []); assert.deepEqual(writes, []);
  });
}

test('cross-origin trash and restore requests fail before database access', async () => {
  for (const model of ['track', 'video'] as const) {
    for (const action of [move, restore]) { const response = await action(model, session, 'https://attacker.invalid'); assert.equal(response.status, 401); privateResponse(response); }
  }
  assert.deepEqual(reads, []); assert.deepEqual(writes, []);
});

for (const model of ['track', 'video'] as const) {
  test(`${model} trash atomically hides it, records the verified username and preserves every metadata/media field`, async () => {
    const original = structuredClone(rows[model][0]);
    const response = await move(model);
    assert.equal(response.status, 200); privateResponse(response); assert.deepEqual(await response.json(), { ok: true });
    const row = rows[model][0];
    assert.equal(row.published, false); assert.equal(row.deletedBy, 'fixture_admin'); assert.ok(row.deletedAt instanceof Date);
    assert.deepEqual(retained(row), retained(original));
    assert.deepEqual(writes[0].query.where, { ...(model === 'track' ? { slug } : { id: videoId }), AND: [activeContentWhere()] });
    assert.deepEqual(Object.keys(writes[0].query.data!).sort(), ['deletedAt', 'deletedBy', 'published']);
    assert.equal(applied, 1);
  });

  test(`${model} repeated or concurrent trash requests preserve the original trash timestamp`, async () => {
    const responses = await Promise.all([move(model), move(model)]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    const deletedAt = rows[model][0].deletedAt;
    assert.equal((await move(model)).status, 200);
    assert.equal(rows[model][0].deletedAt, deletedAt); assert.equal(applied, 1);
  });

  test(`${model} restores the same record as a draft and preserves media, credits and editable metadata`, async () => {
    const original = structuredClone(rows[model][0]);
    await move(model);
    const response = await restore(model);
    assert.equal(response.status, 200); privateResponse(response);
    const body = await response.json();
    assert.equal(body.id, original.id); assert.equal(body.published, false); assert.equal(body.deletedAt, null); assert.equal(body.deletedBy, null);
    assert.deepEqual(retained(rows[model][0]), retained(original));
    assert.deepEqual(writes[1].query.where, { ...(model === 'track' ? { slug } : { id: videoId }), AND: [trashedContentWhere()] });
    if (model === 'track') assert.deepEqual(body.credits, original.credits);
  });

  test(`${model} repeating restore after republishing never unpublishes or changes the live record`, async () => {
    await move(model); await restore(model);
    assert.equal((await update(model, { published: true, expectedUpdatedAt: (rows[model][0].updatedAt as Date).toISOString(), ...(model === 'track' && { reviewedPlaybackMode: 'full' }) })).status, 200);
    const live = structuredClone(rows[model][0]); const previousWrites = applied;
    const response = await restore(model);
    assert.equal(response.status, 200); assert.equal((await response.json()).published, true);
    assert.deepEqual(rows[model][0], live); assert.equal(applied, previousWrites);
  });

  test(`${model} metadata/publication updates cannot mutate or resurrect a trashed item`, async () => {
    await move(model); const trashed = structuredClone(rows[model][0]);
    const response = await update(model, { title: 'Unexpected edit', published: true, deletedAt: null, deletedBy: null });
    assert.equal(response.status, 404); privateResponse(response);
    assert.deepEqual(rows[model][0], trashed); assert.equal(applied, 1);
  });

  test(`${model} a trash operation winning the race prevents an already-started update from publishing it`, async () => {
    beforeUpdate = (_model, row) => { row.deletedAt = new Date('2026-10-01'); row.deletedBy = 'another_admin'; row.published = false; beforeUpdate = undefined; };
    const response = await update(model, { published: true, title: 'Stale edit' });
    assert.equal(response.status, 404); assert.equal(rows[model][0].published, false);
    assert.notEqual(rows[model][0].title, 'Stale edit'); assert.equal(applied, 0);
  });

  test(`${model} a trash-and-restore cycle blocks an already-started stale save even after the item is active again`, async () => {
    const previousTimestamp = rows[model][0].updatedAt as Date;
    beforeUpdate = (_model, row) => {
      row.deletedAt = null; row.deletedBy = null; row.published = false;
      row.updatedAt = new Date(previousTimestamp.getTime() + 1000);
      beforeUpdate = undefined;
    };
    const response = await update(model, { title: 'Stale live edit', published: true });
    assert.equal(response.status, 409); privateResponse(response);
    assert.deepEqual(await response.json(), { error: CONTENT_CHANGED });
    assert.equal(rows[model][0].published, false); assert.notEqual(rows[model][0].title, 'Stale live edit');
    assert.equal(applied, 0);
    assert.deepEqual(writes[0].query.where?.updatedAt, previousTimestamp);
  });

  test(`${model} an old editor revision returns409 before any write while the current revision saves without persisting its control field`, async () => {
    const previousTimestamp = (rows[model][0].updatedAt as Date).toISOString();
    await move(model); await restore(model);
    const stale = await update(model, { title: 'Stale form', published: true, expectedUpdatedAt: previousTimestamp });
    assert.equal(stale.status, 409); privateResponse(stale);
    assert.deepEqual(await stale.json(), { error: CONTENT_CHANGED });
    assert.equal(applied, 2); assert.equal(rows[model][0].published, false);
    const currentTimestamp = (rows[model][0].updatedAt as Date).toISOString();
    const fresh = await update(model, { title: 'Current form', expectedUpdatedAt: currentTimestamp });
    assert.equal(fresh.status, 200); assert.equal(rows[model][0].title, 'Current form');
    assert.equal(rows[model][0].published, false);
    assert.ok(!('expectedUpdatedAt' in writes.at(-1)!.query.data!));
    assert.ok(!('expectedUpdatedAt' in rows[model][0]));
  });

  test(`${model} malformed expected revisions fail validation before reads or writes`, async () => {
    for (const expectedUpdatedAt of ['invalid', '', null, 123, '2026-02-30T00:00:00Z']) {
      const response = await update(model, { published: true, expectedUpdatedAt });
      assert.equal(response.status, 422); privateResponse(response);
    }
    assert.deepEqual(reads, []); assert.deepEqual(writes, []);
  });

  test(`${model} missing trash/restore targets return private 404 without creating records`, async () => {
    rows[model] = [];
    for (const action of [move, restore]) { const response = await action(model); assert.equal(response.status, 404); privateResponse(response); }
    assert.equal(applied, 0);
  });
}

test('public and admin libraries hide trash but retain legacy active records and explicit-null active records', async () => {
  for (const model of ['track', 'video'] as const) {
    const original = rows[model][0];
    rows[model].push({ ...original, id: 'null-active', slug: 'null-active', deletedAt: null });
    rows[model].push({ ...original, id: 'draft', slug: 'draft', published: false });
    rows[model].push({ ...original, id: 'trash', slug: 'trash', published: true, deletedAt: new Date() });
    const list = model === 'track' ? listTracks : listVideos;
    const publicResponse = await list(request(`/api/${model}s`, 'GET', null));
    const adminResponse = await list(request(`/api/${model}s?all=true`));
    assert.equal(publicResponse.status, 200); assert.equal(adminResponse.status, 200);
    assert.equal((await publicResponse.json()).length, 2);
    const adminRows = await adminResponse.json(); assert.equal(adminRows.length, 3);
    assert.ok(adminRows.every((row: Row) => !isContentTrashed(row)));
  }
});

test('public and authenticated preview detail URLs cannot expose trash even if its published flag is inconsistent', async () => {
  rows.track[0].deletedAt = new Date();
  for (const token of [null, session]) {
    for (const suffix of ['', '?preview=true']) {
      const response = await getTrack(request(`/api/tracks/${slug}${suffix}`, 'GET', token), trackContext());
      assert.equal(response.status, 404); privateResponse(response); assert.deepEqual(await response.json(), { error: 'Not found' });
    }
  }
});

test('Trash lists only deleted records, newest first, including the retained track credits', async () => {
  for (const model of ['track', 'video'] as const) {
    const original = rows[model][0];
    rows[model].push({ ...original, id: 'older-trash', deletedAt: new Date('2026-09-01') });
    rows[model].push({ ...original, id: 'newer-trash', deletedAt: new Date('2026-10-01') });
    rows[model].push({ ...original, id: 'null-active', deletedAt: null });
  }
  const response = await listTrash(request('/api/admin/trash'));
  assert.equal(response.status, 200); privateResponse(response);
  const body = await response.json();
  for (const collection of [body.tracks, body.videos]) assert.deepEqual(collection.map((row: Row) => row.id), ['newer-trash', 'older-trash']);
  assert.deepEqual(body.tracks[0].credits, baseTrack.credits);
  assert.deepEqual(reads.find(call => call.model === 'track')?.query.include, { credits: true });
});

test('database failures never appear as empty Trash or successful deletion/restoration', async () => {
  failDatabase = true;
  const responses = await Promise.all([listTrash(request('/api/admin/trash')), move('track'), move('video'), restore('track'), restore('video')]);
  for (const response of responses) {
    assert.ok(response.status >= 500); privateResponse(response);
    const text = JSON.stringify(await response.json()); assert.ok(!text.includes('connection information')); assert.ok(!text.includes('"ok":true'));
  }
  assert.equal(applied, 0);
});

test('invalid video restore IDs return 404 before database access', async () => {
  const response = await restoreVideo(request('/api/admin/trash/videos/not-an-id/restore', 'POST'), { params: Promise.resolve({ id: 'not-an-id' }) });
  assert.equal(response.status, 404); privateResponse(response); assert.deepEqual(reads, []); assert.deepEqual(writes, []);
});
