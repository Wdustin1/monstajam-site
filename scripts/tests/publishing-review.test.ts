import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { Prisma, type PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { extractYouTubeId } from '../../src/lib/youtube';
import { mockNamedAdminSession } from './fixtures/admin-session';

type Row = Record<string, unknown>;
type Query = { where?: Row; data?: Row; select?: Row; include?: Row };
const revision = new Date('2026-10-01T00:00:00.000Z');
const slug = 'review-track';
const videoId = '507f1f77bcf86cd799439012';
const assetId = '507f1f77bcf86cd799439013';
const token = 'publishing-review-unit-session';
const trackFixture = {
  id: '507f1f77bcf86cd799439011', slug, title: 'Review track', artist: 'MonstaJam', genre: 'Hip-Hop', number: 1,
  subtitle: null, bpm: 120, mood: null, story: null, color: 'bg-blue-500', accentCyan: false,
  spotifyUrl: null, appleMusicUrl: null, audioUrl: null, audioAssetId: assetId, playbackMode: 'preview',
  coverUrl: null, published: false, deletedAt: null, deletedBy: null, createdAt: revision, updatedAt: revision,
  credits: [{ id: 'credit-id', trackId: '507f1f77bcf86cd799439011', role: 'Producer', name: 'Dustin' }],
};
const videoFixture = {
  id: videoId, title: 'Review video', artist: null, duration: null,
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ',
  published: false, order: 0, deletedAt: null, deletedBy: null, createdAt: revision, updatedAt: revision,
};
const assetFixture = {
  status: 'ready', originalPath: 'private/originals/do-not-expose.wav', previewPath: 'private/previews/do-not-expose.mp3',
  previewStart: 12, previewDuration: 45, error: 'Private processing diagnostics must not leave the server.',
};
let track: Row | null;
let video: Row | null;
let asset: Row | null;
let reads: string[];
let writes: { model: string; method: string; query: Query }[];
let databaseFailure: boolean;
let raceUpdate: (() => void) | undefined;
let getTrackReview: typeof import('../../src/app/api/admin/publishing/tracks/[slug]/route').GET;
let getVideoReview: typeof import('../../src/app/api/admin/publishing/videos/[id]/route').GET;
let putTrack: typeof import('../../src/app/api/tracks/[slug]/route').PUT;
let putVideo: typeof import('../../src/app/api/videos/[id]/route').PUT;
let createTrack: typeof import('../../src/app/api/tracks/route').POST;
let createVideo: typeof import('../../src/app/api/videos/route').POST;
async function unexpected(): Promise<never> { throw new Error('Unexpected database or storage operation'); }
const database = {
  track: { findUnique: unexpected, update: unexpected, create: unexpected },
  video: { findUnique: unexpected, update: unexpected, create: unexpected },
  audioAsset: { findUnique: unexpected, update: unexpected, create: unexpected },
};
const cache = globalThis as typeof globalThis & { prisma?: PrismaClient };
const previousPrisma = cache.prisma;

before(async () => {
  cache.prisma = database as unknown as PrismaClient;
  getTrackReview = (await import('../../src/app/api/admin/publishing/tracks/[slug]/route')).GET;
  getVideoReview = (await import('../../src/app/api/admin/publishing/videos/[id]/route')).GET;
  putTrack = (await import('../../src/app/api/tracks/[slug]/route')).PUT;
  putVideo = (await import('../../src/app/api/videos/[id]/route')).PUT;
  createTrack = (await import('../../src/app/api/tracks/route')).POST;
  createVideo = (await import('../../src/app/api/videos/route')).POST;
});
beforeEach(() => {
  mockNamedAdminSession(token);
  mock.method(console, 'error', () => {});
  mock.method(globalThis, 'fetch', unexpected);
  track = structuredClone(trackFixture); video = structuredClone(videoFixture); asset = structuredClone(assetFixture);
  reads = []; writes = []; databaseFailure = false; raceUpdate = undefined;
  mock.method(database.audioAsset, 'findUnique', async () => {
    reads.push('asset'); if (databaseFailure) throw new Error('Private database details'); return structuredClone(asset);
  });
  for (const model of ['track', 'video'] as const) {
    mock.method(database[model], 'findUnique', async () => {
      reads.push(model); if (databaseFailure) throw new Error('Private database details'); return structuredClone(model === 'track' ? track : video);
    });
    mock.method(database[model], 'create', async (query: Query) => {
      writes.push({ model, method: 'create', query });
      return { ...(model === 'track' ? trackFixture : videoFixture), ...query.data };
    });
    mock.method(database[model], 'update', async (query: Query) => {
      writes.push({ model, method: 'update', query });
      raceUpdate?.();
      const row = model === 'track' ? track : video;
      if (!row || row.deletedAt || (query.where?.updatedAt && +(query.where.updatedAt as Date) !== +(row.updatedAt as Date))) {
        throw new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'test' });
      }
      Object.assign(row, query.data, { updatedAt: new Date(+revision + 1000) });
      return structuredClone(row);
    });
  }
});
afterEach(() => mock.restoreAll());
after(() => { if (previousPrisma === undefined) delete cache.prisma; else cache.prisma = previousPrisma; });
function request(path: string, method = 'GET', body?: Row, cookie: string | null = token, origin = 'http://localhost') {
  return new NextRequest(`http://localhost${path}`, {
    method, headers: { Origin: origin, ...(cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const trackContext = () => ({ params: Promise.resolve({ slug }) });
const videoContext = () => ({ params: Promise.resolve({ id: videoId }) });
function review(kind: 'track' | 'video', cookie: string | null = token) {
  return kind === 'track' ? getTrackReview(request(`/api/admin/publishing/tracks/${slug}`, 'GET', undefined, cookie), trackContext())
    : getVideoReview(request(`/api/admin/publishing/videos/${videoId}`, 'GET', undefined, cookie), videoContext());
}
function update(kind: 'track' | 'video', body: Row, cookie: string | null = token, origin = 'http://localhost') {
  return kind === 'track' ? putTrack(request(`/api/tracks/${slug}`, 'PUT', body, cookie, origin), trackContext())
    : putVideo(request(`/api/videos/${videoId}`, 'PUT', body, cookie, origin), videoContext());
}
function publication(kind: 'track' | 'video'): Row { return { published: true, expectedUpdatedAt: revision.toISOString(), ...(kind === 'track' && { reviewedPlaybackMode: 'preview' }) }; }
function privateResponse(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie');
}

for (const kind of ['track', 'video'] as const) {
  for (const cookie of [null, 'forged-session']) {
    test(`${kind} publishing review and final publish reject ${cookie ?? 'anonymous'} without database access`, async () => {
      for (const response of [await review(kind, cookie), await update(kind, publication(kind), cookie)]) { assert.equal(response.status, 401); privateResponse(response); }
      assert.deepEqual(reads, []); assert.deepEqual(writes, []);
    });
  }
  test(`${kind} review is read-only and returns a saved revision with useful ready/warning checks`, async () => {
    const response = await review(kind); assert.equal(response.status, 200); privateResponse(response);
    const body = await response.json();
    assert.equal(body.kind, kind); assert.equal(body.canPublish, true); assert.equal(body.expectedUpdatedAt, revision.toISOString());
    assert.equal(body[kind].title, kind === 'track' ? trackFixture.title : videoFixture.title);
    assert.ok(body.checks.some((check: Row) => check.status === 'ready'));
    assert.ok(body.checks.some((check: Row) => check.status === 'warning'));
    assert.deepEqual(writes, []); assert.equal((kind === 'track' ? track : video)?.published, false);
  });
  test(`${kind} missing and trashed review targets return private404`, async () => {
    const row = kind === 'track' ? track! : video!; row.deletedAt = new Date();
    assert.equal((await review(kind)).status, 404);
    if (kind === 'track') track = null; else video = null;
    const missing = await review(kind); assert.equal(missing.status, 404); privateResponse(missing);
    assert.ok(!reads.includes('asset')); assert.deepEqual(writes, []);
  });
  test(`${kind} review database errors return503 and do not report ready or leak diagnostics`, async () => {
    databaseFailure = true; const response = await review(kind);
    assert.equal(response.status, 503); privateResponse(response);
    const text = await response.text(); assert.ok(!text.includes('Private database')); assert.ok(!text.includes('"canPublish":true'));
  });
  test(`${kind} final publish accepts only its reviewed saved version and changes no other metadata`, async () => {
    const response = await update(kind, publication(kind));
    assert.equal(response.status, 200); privateResponse(response); assert.equal((await response.json()).published, true);
    assert.deepEqual(writes[0].query.data, { published: true });
    assert.equal(+(writes[0].query.where!.updatedAt as Date), +revision);
    assert.ok(writes[0].query.where!.AND);
  });
  test(`${kind} missing review revision or bundled metadata cannot bypass saved-draft review`, async () => {
    for (const body of [{ published: true }, { ...publication(kind), title: 'Unreviewed change' }]) {
      const response = await update(kind, body); assert.equal(response.status, 422); privateResponse(response);
      const failure = await response.json(); assert.equal(failure.details.published[0], failure.error);
    }
    assert.deepEqual(writes, []);
  });
  test(`${kind} a stale reviewed revision returns409 without publishing`, async () => {
    (kind === 'track' ? track! : video!).updatedAt = new Date(+revision + 1000);
    const response = await update(kind, publication(kind)); assert.equal(response.status, 409); privateResponse(response);
    assert.deepEqual(writes, []); assert.equal((kind === 'track' ? track : video)?.published, false);
  });
  test(`${kind} an edit after final readiness is checked is still rejected by atomic CAS`, async () => {
    raceUpdate = () => { (kind === 'track' ? track! : video!).updatedAt = new Date(+revision + 1000); };
    const response = await update(kind, publication(kind)); assert.equal(response.status, 409); privateResponse(response);
    assert.equal((kind === 'track' ? track : video)?.published, false);
  });
  test(`${kind} cross-origin final publication is rejected before any read`, async () => {
    assert.equal((await update(kind, publication(kind), token, 'https://attacker.invalid')).status, 401);
    assert.deepEqual(reads, []); assert.deepEqual(writes, []);
  });
  test(`${kind} whitespace-only saved title blocks review and final publication`, async () => {
    (kind === 'track' ? track! : video!).title = '   ';
    assert.equal((await (await review(kind)).json()).canPublish, false);
    assert.equal((await update(kind, publication(kind))).status, 422); assert.deepEqual(writes, []);
  });
  test(`${kind} new records always start as drafts, including when published is omitted`, async () => {
    const input = kind === 'track' ? { title: 'New track', artist: 'MonstaJam', slug: 'new-track', number: 2 }
      : { title: 'New video', youtubeUrl: videoFixture.youtubeUrl, youtubeId: videoFixture.youtubeId };
    const create = kind === 'track' ? createTrack : createVideo;
    const rejected = await create(request(`/api/${kind}s`, 'POST', { ...input, published: true }));
    assert.equal(rejected.status, 422); privateResponse(rejected); assert.equal(writes.length, 0);
    const failure = await rejected.json(); assert.equal(failure.details.published[0], failure.error);
    const saved = await create(request(`/api/${kind}s`, 'POST', input));
    assert.equal(saved.status, 201); privateResponse(saved); assert.equal((await saved.json()).published, false);
    assert.equal(writes[0].query.data!.published, false);
  });
}

test('track review exposes saved credits and playback choice without private asset paths or diagnostics', async () => {
  const response = await review('track'); const text = await response.text(); const body = JSON.parse(text);
  assert.deepEqual(body.track.credits, trackFixture.credits);
  assert.equal(body.playbackMode, 'preview'); assert.deepEqual(body.audio, { status: 'ready', previewStart: 12, previewDuration: 45 });
  assert.ok(!text.includes('private/originals')); assert.ok(!text.includes('private/previews')); assert.ok(!text.includes('Private processing'));
  assert.equal(body.checks.find((check: Row) => check.key === 'artwork').status, 'warning');
});

for (const mode of [undefined, 'full']) {
  test(`track publication rejects ${mode ?? 'missing'} reviewed playback mode when preview was saved`, async () => {
    const response = await update('track', { published: true, expectedUpdatedAt: revision.toISOString(), ...(mode && { reviewedPlaybackMode: mode }) });
    assert.equal(response.status, 422); assert.deepEqual(writes, []);
  });
}
test('full-song publication requires the explicitly reviewed full mode and keeps that saved choice', async () => {
  track!.playbackMode = 'full';
  const response = await update('track', { ...publication('track'), reviewedPlaybackMode: 'full' });
  assert.equal(response.status, 200); assert.equal(track!.playbackMode, 'full');
});

for (const [label, changes] of [
  ['processing', { status: 'processing' }], ['failed', { status: 'failed' }], ['missing original', { originalPath: '' }],
  ['missing preview', { previewPath: null }], ['zero duration', { previewDuration: 0 }], ['missing duration', { previewDuration: null }],
  ['negative duration', { previewDuration: -1 }], ['infinite duration', { previewDuration: Infinity }],
  ['preview longer than limit', { previewDuration: 46 }], ['invalid start', { previewStart: -1 }],
] as const) {
  test(`track ${label} audio blocks review and cannot be published with a retained asset ID`, async () => {
    Object.assign(asset!, changes);
    const body = await (await review('track')).json(); assert.equal(body.canPublish, false);
    assert.equal(body.checks.find((check: Row) => check.key === 'audio').status, 'blocked');
    assert.equal((await update('track', publication('track'))).status, 422); assert.deepEqual(writes, []);
  });
}
test('a ready review does not bypass a missing or failed asset on the final request', async () => {
  assert.equal((await (await review('track')).json()).canPublish, true);
  asset = null;
  assert.equal((await update('track', publication('track'))).status, 422); assert.deepEqual(writes, []);
});
test('short valid previews and missing artwork can be published with warnings', async () => {
  asset!.previewDuration = 2.5;
  assert.equal((await (await review('track')).json()).canPublish, true);
  assert.equal((await update('track', publication('track'))).status, 200);
});
test('unrecognized saved artwork warns to inspect or replace the link without promising a fallback', async () => {
  track!.coverUrl = 'https://old-artwork.example.invalid/cover.png';
  const body = await (await review('track')).json();
  const check = body.checks.find((entry: Row) => entry.key === 'artwork');
  assert.equal(body.canPublish, true); assert.equal(check.status, 'warning');
  assert.match(check.message, /preview or replace/); assert.ok(!check.message.includes('default'));
});
test('publishing readiness errors preserve their actionable reason as a field error for the admin client', async () => {
  asset!.status = 'processing';
  const response = await update('track', publication('track'));
  assert.equal(response.status, 422);
  const body = await response.json(); assert.match(body.error, /still processing/);
  assert.deepEqual(body.details, { published: [body.error] });
});
test('drafts without audio remain editable but cannot publish', async () => {
  track!.audioAssetId = null;
  assert.equal((await update('track', { title: 'Draft edit' })).status, 200);
  assert.equal((await update('track', { ...publication('track'), expectedUpdatedAt: (track!.updatedAt as Date).toISOString() })).status, 422);
  assert.equal(track!.published, false);
});
test('existing live legacy audio remains editable with a warning but cannot republish from draft', async () => {
  track!.audioAssetId = null; track!.audioUrl = 'https://legacy.example.invalid/song.mp3'; track!.published = true;
  const body = await (await review('track')).json(); assert.equal(body.canPublish, true); assert.equal(body.audio.status, 'legacy');
  assert.equal(body.checks.find((check: Row) => check.key === 'audio').status, 'warning');
  assert.equal((await update('track', { title: 'Renamed live legacy' })).status, 200);
  assert.equal((await update('track', { published: false })).status, 200);
  assert.equal((await (await review('track')).json()).canPublish, false);
  assert.equal((await update('track', { ...publication('track'), expectedUpdatedAt: (track!.updatedAt as Date).toISOString() })).status, 422);
  assert.equal(track!.published, false);
});
test('live managed metadata saves recheck retained audio, while unpublishing stays available to fix problems', async () => {
  track!.published = true; asset!.status = 'failed';
  assert.equal((await update('track', { title: 'Must not go live' })).status, 422);
  assert.equal(track!.title, trackFixture.title);
  assert.equal((await update('track', { published: false })).status, 200);
  assert.equal(track!.published, false);
});

for (const url of [
  'https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=playlist',
  'https://youtu.be/dQw4w9WgXcQ?t=5', 'https://m.youtube.com/shorts/dQw4w9WgXcQ',
  'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
]) test(`supported YouTube link parses ${new URL(url).hostname}${new URL(url).pathname}`, () => assert.equal(extractYouTubeId(url), 'dQw4w9WgXcQ'));

for (const url of [
  'https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ', 'https://evil.invalid/?next=https://youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtube.com@evil.invalid/watch?v=dQw4w9WgXcQ', 'https://user@youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtube.com:8443/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short',
  'https://youtube.com/watch?v=dQw4w9WgXcQ&v=otherOther1', 'https://youtu.be/dQw4w9WgXcQ/extra',
]) test(`spoofed or malformed YouTube URL is blocked: ${url}`, async () => {
  assert.equal(extractYouTubeId(url), null); video!.youtubeUrl = url;
  assert.equal((await (await review('video')).json()).canPublish, false);
  assert.equal((await update('video', publication('video'))).status, 422); assert.deepEqual(writes, []);
});
test('a valid YouTube URL with another saved video ID cannot publish or change a live video', async () => {
  video!.youtubeId = 'abcdefghijk';
  assert.equal((await update('video', publication('video'))).status, 422);
  video!.published = true;
  assert.equal((await update('video', { title: 'Still mismatched' })).status, 422);
  assert.equal((await update('video', { published: false })).status, 200);
});
