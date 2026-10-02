import { mockNamedAdminSession } from './fixtures/admin-session';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { adminFetch, AdminSaveError, formChanged, readAdminResponse } from '../../src/lib/admin-save';

type WriteArgs = { data: Record<string, unknown>; where?: Record<string, unknown> };
type WriteCall = { model: 'track' | 'video'; method: 'create' | 'update'; args: WriteArgs };
let createTrack: typeof import('../../src/app/api/tracks/route').POST;
let updateTrack: typeof import('../../src/app/api/tracks/[slug]/route').PUT;
let createVideo: typeof import('../../src/app/api/videos/route').POST;
let updateVideo: typeof import('../../src/app/api/videos/[id]/route').PUT;

const testSecret = 'local-admin-save-test';

const track = {
  slug: 'admin-save-track', title: 'Saved track', artist: 'MonstaJam', genre: 'Hip-Hop',
  bpm: 120, mood: 'Calm', story: 'Existing track story',
  spotifyUrl: 'https://open.spotify.com/track/example',
  appleMusicUrl: 'https://music.apple.com/us/album/example',
  audioUrl: 'https://example.invalid/audio.mp3', coverUrl: 'https://example.invalid/cover.png',
  published: false, number: 1, credits: [],
  playbackMode: 'preview', audioAssetId: null,
};
const video = {
  id: '507f1f77bcf86cd799439011', title: 'Saved video', artist: 'MonstaJam', duration: '3:45',
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ',
  published: false, order: 0,
};
const emptyTrackMetadata = { bpm: null, mood: null, story: null, spotifyUrl: null, appleMusicUrl: null };
const emptyVideoMetadata = { artist: null, duration: null };
const trackCreateInput = { slug: track.slug, title: track.title, artist: track.artist, number: 1 };
const videoCreateInput = { title: video.title, youtubeUrl: video.youtubeUrl, youtubeId: video.youtubeId };
const savedRevision = new Date('2026-01-01T12:00:00.000Z');

async function unmockedWrite(args: WriteArgs): Promise<Record<string, unknown>> {
  throw new Error(`Unexpected unmocked write: ${JSON.stringify(args)}`);
}
const database = {
  track: { create: unmockedWrite, update: unmockedWrite, findUnique: async () => ({ ...track, updatedAt: savedRevision }) },
  video: { create: unmockedWrite, update: unmockedWrite, findUnique: async () => ({ ...video, updatedAt: savedRevision }) },
};
const prismaCache = globalThis as unknown as { prisma?: PrismaClient };
const originalPrisma = prismaCache.prisma;
let writes: WriteCall[] = [];

before(async () => {
  // Inject before route imports: no real Prisma client or database can be used.
  prismaCache.prisma = database as unknown as PrismaClient;
  createTrack = (await import('../../src/app/api/tracks/route')).POST;
  updateTrack = (await import('../../src/app/api/tracks/[slug]/route')).PUT;
  createVideo = (await import('../../src/app/api/videos/route')).POST;
  updateVideo = (await import('../../src/app/api/videos/[id]/route')).PUT;
});

beforeEach(() => {
  mockNamedAdminSession(testSecret);
  writes = [];
  mock.method(console, 'error', () => {});
  for (const model of ['track', 'video'] as const) {
    for (const method of ['create', 'update'] as const) {
      mock.method(database[model], method, async (args: WriteArgs) => {
        writes.push({ model, method, args });
        const previous = method === 'update' ? (model === 'track' ? track : video) : {};
        // Prisma preserves omitted/undefined keys and writes explicit null.
        const data = Object.fromEntries(Object.entries(args.data).filter(([, value]) => value !== undefined));
        return { ...previous, ...data };
      });
    }
  }
});

afterEach(() => {
  mock.restoreAll();


});

after(() => {
  if (originalPrisma === undefined) delete prismaCache.prisma;
  else prismaCache.prisma = originalPrisma;
});

const routes = [
  { name: 'track create', path: '/api/tracks', method: 'POST', valid: trackCreateInput, run: (req: NextRequest) => createTrack(req) },
  { name: 'track update', path: `/api/tracks/${track.slug}`, method: 'PUT', valid: { title: track.title }, run: (req: NextRequest) => updateTrack(req, { params: Promise.resolve({ slug: track.slug }) }) },
  { name: 'video create', path: '/api/videos', method: 'POST', valid: videoCreateInput, run: (req: NextRequest) => createVideo(req) },
  { name: 'video update', path: `/api/videos/${video.id}`, method: 'PUT', valid: { title: video.title }, run: (req: NextRequest) => updateVideo(req, { params: Promise.resolve({ id: video.id }) }) },
] as const;

function request(route: typeof routes[number], body: unknown, cookie: string | null = testSecret) {
  return new NextRequest(`http://localhost${route.path}`, {
    method: route.method,
    headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', ...(cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : {}) },
    body: JSON.stringify(body),
  });
}

test('track update persists explicit null for every editable optional metadata field', async () => {
  const response = await routes[1].run(request(routes[1], emptyTrackMetadata));

  assert.equal(response.status, 200);
  assert.deepEqual(writes[0].args.data, emptyTrackMetadata);
  assert.deepEqual(writes[0].args.where, { slug: track.slug, updatedAt: savedRevision, AND: [{ OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] }] });
  assert.deepEqual(await response.json(), { ...track, ...emptyTrackMetadata });
});

test('a track title-only update leaves all omitted metadata and uploaded media intact', async () => {
  const changes = { title: 'Renamed track' };
  const response = await routes[1].run(request(routes[1], changes));

  assert.equal(response.status, 200);
  assert.deepEqual(writes[0].args.data, changes);
  assert.deepEqual(await response.json(), { ...track, ...changes });
});

test('track updates distinguish clearing, changing, and omitting fields in one save', async () => {
  const changes = { bpm: null, mood: 'Energetic', spotifyUrl: 'https://open.spotify.com/track/replacement' };
  const response = await routes[1].run(request(routes[1], changes));

  assert.equal(response.status, 200);
  assert.deepEqual(writes[0].args.data, changes);
  assert.deepEqual(await response.json(), { ...track, ...changes });
});

test('video update persists cleared artist and duration', async () => {
  const response = await routes[3].run(request(routes[3], emptyVideoMetadata));

  assert.equal(response.status, 200);
  assert.deepEqual(writes[0].args.data, emptyVideoMetadata);
  assert.deepEqual(writes[0].args.where, { id: video.id, updatedAt: savedRevision, AND: [{ OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] }] });
  assert.deepEqual(await response.json(), { ...video, ...emptyVideoMetadata });
});

test('video title-only update leaves omitted artist and duration intact', async () => {
  const changes = { title: 'Renamed video' };
  const response = await routes[3].run(request(routes[3], changes));

  assert.equal(response.status, 200);
  assert.deepEqual(writes[0].args.data, changes);
  assert.deepEqual(await response.json(), { ...video, ...changes });
});

for (const [route, optional] of [[routes[0], emptyTrackMetadata], [routes[2], emptyVideoMetadata]] as const) {
  test(`${route.name} accepts explicit null optional metadata`, async () => {
    const response = await route.run(request(route, { ...route.valid, ...optional }));

    assert.equal(response.status, 201);
    const saved = await response.json();
    for (const field of Object.keys(optional)) {
      assert.equal(writes[0].args.data[field], null);
      assert.equal(saved[field], null);
    }
  });

  test(`${route.name} still accepts omitted optional metadata`, async () => {
    const response = await route.run(request(route, route.valid));

    assert.equal(response.status, 201);
    for (const field of Object.keys(optional)) assert.equal(Object.hasOwn(writes[0].args.data, field), false);
  });
}

for (const route of routes) {
  for (const cookie of [null, 'invalid-admin-session']) {
    test(`${route.name} rejects ${cookie === null ? 'missing' : 'invalid'} authentication before writing`, async () => {
      const response = await route.run(request(route, route.valid, cookie));

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Unauthorized' });
      assert.equal(writes.length, 0);
    });
  }

  test(`${route.name} reports invalid JSON without writing`, async () => {
    const response = await route.run(new NextRequest(`http://localhost${route.path}`, {
      method: route.method,
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', Cookie: `monstajam_auth.session_token=${testSecret}` },
      body: '{',
    }));

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
    assert.equal(writes.length, 0);
  });

  const requiredFields = route.name.startsWith('track')
    ? (route.method === 'POST' ? ['title', 'artist', 'slug', 'number'] : ['title', 'artist'])
    : ['title', 'youtubeUrl', 'youtubeId'];
  for (const field of requiredFields) {
    test(`${route.name} refuses null ${field}`, async () => {
      const response = await route.run(request(route, { ...route.valid, [field]: null }));

      assert.equal(response.status, 422);
      const error = await response.json();
      assert.equal(error.error, 'Validation failed');
      assert.ok(error.details[field]?.length);
      assert.equal(writes.length, 0);
    });
  }
}

for (const [field, value] of [
  ['bpm', 39], ['bpm', 301], ['bpm', 120.5],
  ['mood', 'a'.repeat(101)], ['story', 'a'.repeat(10001)],
  ['spotifyUrl', 'not a URL'], ['appleMusicUrl', 'not a URL'],
  ['spotifyUrl', `https://example.invalid/${'a'.repeat(500)}`],
] as const) {
  test(`track optional ${field} still enforces its constraint for ${String(value).slice(0, 20)}`, async () => {
    const response = await routes[1].run(request(routes[1], { [field]: value }));

    assert.equal(response.status, 422);
    assert.ok((await response.json()).details[field]?.length);
    assert.equal(writes.length, 0);
  });
}

for (const [field, value] of [['artist', 'a'.repeat(201)], ['duration', 'a'.repeat(11)]] as const) {
  test(`video optional ${field} still enforces its length limit`, async () => {
    const response = await routes[3].run(request(routes[3], { [field]: value }));

    assert.equal(response.status, 422);
    assert.ok((await response.json()).details[field]?.length);
    assert.equal(writes.length, 0);
  });
}

test('empty-string streaming URLs remain accepted for existing API clients', async () => {
  const changes = { spotifyUrl: '', appleMusicUrl: '' };
  const response = await routes[1].run(request(routes[1], changes));

  assert.equal(response.status, 200);
  assert.deepEqual(writes[0].args.data, changes);
});

for (const body of [JSON.stringify({ error: 'Unauthorized' }), '<html>Login required</html>']) {
  test(`expired-session feedback preserves edit recovery for ${body.startsWith('<') ? 'non-JSON' : 'JSON'} responses`, async () => {
    await assert.rejects(readAdminResponse(new Response(body, { status: 401 })), (error: unknown) => {
      assert.ok(error instanceof AdminSaveError);
      assert.match(error.message, /session expired/i);
      assert.match(error.message, /edits are still here/i);
      assert.match(error.message, /sign in in a new tab, then retry/i);
      assert.deepEqual(error.fields, {});
      return true;
    });
  });
}

test('validation feedback maps the first valid message for each highlighted field', async () => {
  const response = Response.json({
    error: 'Validation failed',
    details: {
      bpm: ['BPM must be an integer.', 'A second detail'],
      spotifyUrl: ['Enter a valid URL.'],
      mood: [],
      story: 'Not an array',
      artist: [42],
    },
  }, { status: 422 });

  await assert.rejects(readAdminResponse(response), (error: unknown) => {
    assert.ok(error instanceof AdminSaveError);
    assert.equal(error.message, 'Check the highlighted fields and retry.');
    assert.deepEqual(error.fields, { bpm: 'BPM must be an integer.', spotifyUrl: 'Enter a valid URL.' });
    return true;
  });
});

test('a non-JSON server error becomes readable retry feedback without forwarding HTML', async () => {
  const response = new Response('<html>private server stack</html>', { status: 500 });

  await assert.rejects(readAdminResponse(response), (error: unknown) => {
    assert.ok(error instanceof AdminSaveError);
    assert.equal(error.message, 'The request failed. Please retry.');
    assert.deepEqual(error.fields, {});
    return true;
  });
});

test('an actionable JSON error keeps the server message', async () => {
  const response = Response.json({ error: 'A track already uses this URL.' }, { status: 409 });

  await assert.rejects(readAdminResponse(response), (error: unknown) => {
    assert.ok(error instanceof AdminSaveError);
    assert.equal(error.message, 'A track already uses this URL.');
    return true;
  });
});

test('successful save responses preserve explicit null and omitted fields', async () => {
  const saved = { title: 'Saved', mood: null, bpm: null };
  const result = await readAdminResponse<typeof saved>(Response.json(saved, { status: 201 }));

  assert.deepEqual(result, saved);
  assert.equal(Object.hasOwn(result, 'story'), false);
});

for (const body of ['', '{incomplete']) {
  test(`${body ? 'malformed' : 'empty'} successful responses explain that the save outcome is uncertain`, async () => {
    await assert.rejects(readAdminResponse(new Response(body, { status: 200 })), (error: unknown) => {
      assert.ok(error instanceof AdminSaveError);
      assert.match(error.message, /response was interrupted/i);
      assert.match(error.message, /check whether the save completed before retrying/i);
      return true;
    });
  });
}

test('a response-body connection failure explains the ambiguous save outcome', async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.error(new Error('Connection closed during save response'));
    },
  }));

  await assert.rejects(readAdminResponse(response), (error: unknown) => {
    assert.ok(error instanceof AdminSaveError);
    assert.match(error.message, /check whether the save completed before retrying/i);
    assert.doesNotMatch(error.message, /Connection closed/);
    return true;
  });
});

test('dirty detection turns off when edited text is reverted to its saved value', () => {
  const saved = { title: 'Original title', mood: 'Calm', published: false };
  const current = { ...saved, title: 'A new title' };

  assert.equal(formChanged(current, saved), true);
  current.title = saved.title;
  assert.equal(formChanged(current, saved), false);
  current.published = true;
  assert.equal(formChanged(current, saved), true);
});

test('selecting then clearing an unsaved file restores the saved form state', () => {
  const saved: { title: string; audioFile: File | null } = { title: 'Saved track', audioFile: null };
  const current = { ...saved, audioFile: new File(['audio'], 'track.mp3', { type: 'audio/mpeg' }) as File | null };

  assert.equal(formChanged(current, saved), true);
  current.audioFile = null;
  assert.equal(formChanged(current, saved), false);
});

test('dirty detection compares file identity even when file metadata matches', () => {
  const options = { type: 'image/png', lastModified: 123 };
  const original = new File(['same pixels'], 'cover.png', options);
  const replacement = new File(['same pixels'], 'cover.png', options);

  assert.equal(formChanged({ coverFile: original }, { coverFile: original }), false);
  assert.equal(formChanged({ coverFile: replacement }, { coverFile: original }), true);
});

test('dirty detection distinguishes explicitly cleared values from omitted values', () => {
  type OptionalForm = { mood?: string | null };
  const saved: OptionalForm = { mood: undefined };

  assert.equal(formChanged<OptionalForm>({ mood: null }, saved), true);
  assert.equal(formChanged<OptionalForm>({ mood: undefined }, saved), false);
  assert.equal(formChanged<OptionalForm>({ mood: null }, { mood: null }), false);
});

test('adminFetch applies a thirty-second deadline while preserving request options', async () => {
  const deadline = new AbortController().signal;
  const originalSignal = new AbortController().signal;
  const init: RequestInit = {
    method: 'PUT',
    credentials: 'include',
    headers: new Headers({ 'Content-Type': 'application/json', 'X-Test': 'admin-save' }),
    body: JSON.stringify({ mood: null }),
    cache: 'no-store',
    redirect: 'error',
    signal: originalSignal,
  };
  const timeout = mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, 30_000);
    return deadline;
  });
  const response = Response.json({ mood: null });
  const fetchMock = mock.method(globalThis, 'fetch', async (input: unknown, options?: RequestInit) => {
    assert.equal(input, '/api/tracks/admin-save-track');
    assert.deepEqual(options, { ...init, signal: deadline });
    return response;
  });

  assert.equal(await adminFetch('/api/tracks/admin-save-track', init), response);
  assert.equal(init.signal, originalSignal, 'the caller options must not be mutated');
  assert.equal(timeout.mock.callCount(), 1);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('adminFetch supports a default GET request with no options', async () => {
  const deadline = new AbortController().signal;
  mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, 30_000);
    return deadline;
  });
  const response = Response.json([]);
  mock.method(globalThis, 'fetch', async (input: unknown, options?: RequestInit) => {
    assert.equal(input, '/api/tracks?all=true');
    assert.deepEqual(options, { signal: deadline });
    return response;
  });

  assert.equal(await adminFetch('/api/tracks?all=true'), response);
});

test('adminFetch lets the deadline reject a stalled metadata request', { timeout: 1000 }, async () => {
  const controller = new AbortController();
  const reason = new DOMException('Metadata request timed out', 'TimeoutError');
  mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, 30_000);
    return controller.signal;
  });
  mock.method(globalThis, 'fetch', (_input: unknown, options?: RequestInit) => {
    assert.equal(options?.signal, controller.signal);
    return new Promise<Response>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    });
  });

  const pending = adminFetch('/api/tracks/admin-save-track', { method: 'PUT', body: '{}' });
  const timer = setTimeout(() => controller.abort(reason), 20);
  try {
    await assert.rejects(pending, (error: unknown) => error === reason);
  } finally {
    clearTimeout(timer);
  }
});
