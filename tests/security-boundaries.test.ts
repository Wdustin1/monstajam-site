import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { isPublicIpAddress, parseAllowedCoverUrl } from '../src/lib/coverProxy';
import { createCoverHandler } from '../src/app/api/cover/route';
import { GET as getTrack, PUT as updateTrack } from '../src/app/api/tracks/[slug]/route';
import { prisma } from '../src/lib/prisma';
import { TrackCreateSchema } from '../src/lib/schemas';
import { createAdminSessionToken } from '../src/lib/auth';
import { createFixedWindowRateLimiter } from '../src/lib/rateLimit';
import { POST as uploadAsset } from '../src/app/api/upload/route';
import { createLoginHandler } from '../src/app/api/auth/login/route';

test('cover proxy accepts only exact HTTPS Vercel Blob host boundaries', () => {
  assert.equal(
    parseAllowedCoverUrl('https://store-id.public.blob.vercel-storage.com/cover.png').hostname,
    'store-id.public.blob.vercel-storage.com',
  );

  for (const url of [
    'https://attacker.example/collect?marker=blob.vercel-storage.com',
    'https://blob.vercel-storage.com.attacker.example/cover.png',
    'http://store-id.public.blob.vercel-storage.com/cover.png',
    'https://user:pass@store-id.public.blob.vercel-storage.com/cover.png',
    'https://store-id.public.blob.vercel-storage.com:8443/cover.png',
  ]) {
    assert.throws(() => parseAllowedCoverUrl(url), /cover URL/i, url);
  }
});

test('cover proxy rejects private, reserved, documentation, and local IP addresses', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.51.100.1',
    '203.0.113.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
  ]) assert.equal(isPublicIpAddress(address), false, address);

  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
});

test('cover route rejects crafted open-proxy URLs without calling fetch', async () => {
  const getCover = createCoverHandler(async () => ({ allowed: true, retryAfterSeconds: 1 }));
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not be called');
  };

  try {
    const request = new NextRequest(
      'https://monstajam.example/api/cover?url=https%3A%2F%2Fattacker.example%2Fcollect%3Fmarker%3Dblob.vercel-storage.com',
    );
    const response = await getCover(request);
    assert.equal(response.status, 400);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cover route blocks an abusive client before URL validation or global consumption', async () => {
  const namespaces: string[] = [];
  const getBlockedCover = createCoverHandler(async ({ namespace }) => {
    namespaces.push(namespace);
    return { allowed: false, retryAfterSeconds: 60 };
  });

  const response = await getBlockedCover(new NextRequest(
    'https://monstajam.example/api/cover?url=https%3A%2F%2Fstore.public.blob.vercel-storage.com%40127.0.0.1%2Fx',
  ));
  assert.equal(response.status, 429);
  assert.deepEqual(namespaces, ['cover-proxy-client']);
});

test('cover route proxies only cover URLs attached to published tracks', async () => {
  const getCoverWithAvailableLimiter = createCoverHandler(async () => ({
    allowed: true,
    retryAfterSeconds: 1,
  }));
  const trackDelegate = prisma.track as unknown as {
    findFirst: (args: unknown) => Promise<unknown>;
  };
  const originalFindFirst = trackDelegate.findFirst;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  trackDelegate.findFirst = async () => null;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('fetch must not be called');
  };

  try {
    const request = new NextRequest(
      'https://monstajam.example/api/cover?url=https%3A%2F%2Fattacker.public.blob.vercel-storage.com%2Fcover.png',
    );
    const response = await getCoverWithAvailableLimiter(request);
    assert.equal(response.status, 404);
    assert.equal(fetchCalls, 0);
  } finally {
    trackDelegate.findFirst = originalFindFirst;
    globalThis.fetch = originalFetch;
  }
});

test('cover route serves authorized GIF uploads with the correct content type', async () => {
  const getCoverWithAvailableLimiter = createCoverHandler(async () => ({ allowed: true, retryAfterSeconds: 1 }));
  const trackDelegate = prisma.track as unknown as { findFirst: (args: unknown) => Promise<unknown> };
  const originalFindFirst = trackDelegate.findFirst;
  const originalFetch = globalThis.fetch;
  trackDelegate.findFirst = async () => ({ id: 'published-track' });
  globalThis.fetch = async () => new Response(
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]),
    { status: 200, headers: { 'Content-Type': 'image/gif', 'Content-Length': '10' } },
  );

  try {
    const request = new NextRequest(
      'https://monstajam.example/api/cover?url=https%3A%2F%2Fstore.public.blob.vercel-storage.com%2Fcover.gif',
    );
    const response = await getCoverWithAvailableLimiter(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/gif');
  } finally {
    trackDelegate.findFirst = originalFindFirst;
    globalThis.fetch = originalFetch;
  }
});

test('track concurrency smoke exercises the published-audio race and cleans its fixture', () => {
  const smokeUrl = new URL('../scripts/track-concurrency-smoke.ts', import.meta.url);
  assert.ok(existsSync(smokeUrl));
  const source = readFileSync(smokeUrl, 'utf8');
  for (const anchor of [
    'Promise.all',
    "JSON.stringify({ audioUrl: '' })",
    "assertRaceStatuses",
    'published && !finalTrack.audioUrl',
    'verifyFixtureAbsent',
    "method: 'DELETE'",
  ]) {
    assert.ok(source.includes(anchor), `track concurrency smoke should include ${anchor}`);
  }
});

test('track updates enforce publication and audio invariants in one retryable transaction', () => {
  const source = readFileSync(new URL('../src/app/api/tracks/[slug]/route.ts', import.meta.url), 'utf8');
  for (const anchor of ['prisma.$transaction', 'MAX_TRACK_UPDATE_ATTEMPTS', "error.code === 'P2034'"]) {
    assert.ok(source.includes(anchor), `track update route should include ${anchor}`);
  }
  const putStart = source.indexOf('export async function PUT');
  const deleteStart = source.indexOf('export async function DELETE');
  const putSource = source.slice(putStart, deleteStart);
  assert.match(putSource, /tx\.track\.findUnique/);
  assert.match(putSource, /tx\.track\.update/);
});

test('public track page and metadata queries enforce published status', () => {
  const source = readFileSync(new URL('../src/app/tracks/[slug]/page.tsx', import.meta.url), 'utf8');
  const protectedQueries = source.match(
    /prisma\.track\.findFirst\(\{\s*where:\s*\{\s*slug,\s*published:\s*true\s*\}/g,
  ) ?? [];
  assert.equal(protectedQueries.length, 2, 'page and metadata must each query only published tracks');
  assert.doesNotMatch(source, /prisma\.track\.findUnique\(\{\s*where:\s*\{\s*slug\s*\}/);
});

test('public track detail route does not disclose draft metadata or media URLs', async () => {
  const trackDelegate = prisma.track as unknown as {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  const originalFindUnique = trackDelegate.findUnique;
  trackDelegate.findUnique = async () => ({
    id: 'draft-id',
    slug: 'secret-draft',
    title: 'Secret Draft',
    published: false,
    audioUrl: 'https://private.example/unreleased.wav',
    credits: [],
  });

  try {
    const response = await getTrack(
      new NextRequest('https://monstajam.example/api/tracks/secret-draft'),
      { params: Promise.resolve({ slug: 'secret-draft' }) },
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  } finally {
    trackDelegate.findUnique = originalFindUnique;
  }
});

test('track validation rejects publishing without an audio URL', () => {
  const baseTrack = {
    title: 'Ready Soon',
    artist: 'MonstaJam',
    slug: 'ready-soon',
    number: 99,
  };

  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, published: false }).success, true);
  assert.equal(TrackCreateSchema.safeParse({ ...baseTrack, published: true }).success, false);
  assert.equal(
    TrackCreateSchema.safeParse({
      ...baseTrack,
      published: true,
      audioUrl: 'https://store.public.blob.vercel-storage.com/song.wav',
    }).success,
    true,
  );
});

test('track update route rejects publishing an existing audio-less draft', async () => {
  const secret = 'test-only-admin-secret-at-least-32';
  const previousSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = secret;
  const trackDelegate = prisma.track as unknown as {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  const originalFindUnique = trackDelegate.findUnique;
  const originalUpdate = trackDelegate.update;
  const client = prisma as unknown as Record<string, unknown>;
  const originalTransaction = client.$transaction;
  let updateCalls = 0;
  trackDelegate.findUnique = async () => ({
    id: 'draft-id',
    slug: 'audio-less-draft',
    title: 'Audio-less Draft',
    published: false,
    audioUrl: null,
    credits: [],
  });
  trackDelegate.update = async () => {
    updateCalls += 1;
    return {};
  };
  client.$transaction = async (callback: (tx: { track: typeof trackDelegate }) => Promise<unknown>) =>
    callback({ track: trackDelegate });

  try {
    const response = await updateTrack(
      new NextRequest('https://monstajam.example/api/tracks/audio-less-draft', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `admin_session=${createAdminSessionToken(secret)}`,
        },
        body: JSON.stringify({ published: true }),
      }),
      { params: Promise.resolve({ slug: 'audio-less-draft' }) },
    );
    assert.equal(response.status, 422);
    assert.equal(updateCalls, 0);
  } finally {
    trackDelegate.findUnique = originalFindUnique;
    trackDelegate.update = originalUpdate;
    client.$transaction = originalTransaction;
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
  }
});

test('upload endpoint rejects legacy multipart bodies before parsing or uploading', async () => {
  const secret = 'test-only-admin-secret-at-least-32';
  const previousSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = secret;

  try {
    const response = await uploadAsset(new NextRequest('https://monstajam.example/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=unused',
        Cookie: `admin_session=${createAdminSessionToken(secret)}`,
      },
      body: '--unused--',
    }));
    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), { error: 'Unsupported upload request' });
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
  }
});

test('admin login throttles repeated failures by client address', async () => {
  const secret = 'test-only-admin-secret-at-least-32';
  const previousSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = secret;
  const clientAddress = `203.0.113.${Date.now() % 200 + 1}`;
  const clientLimiter = createFixedWindowRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000, maxEntries: 20 });
  const globalLimiter = createFixedWindowRateLimiter({ limit: 100, windowMs: 15 * 60 * 1000, maxEntries: 2 });
  let globalCalls = 0;
  const login = createLoginHandler({
    consume: async ({ namespace, key }) => {
      if (namespace === 'admin-login-global') globalCalls += 1;
      return (namespace === 'admin-login-client' ? clientLimiter : globalLimiter).consume(key);
    },
    clear: async (_namespace, key) => clientLimiter.clear(key),
  });

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(new NextRequest('https://monstajam.example/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': clientAddress },
        body: JSON.stringify({ password: 'wrong-password' }),
      }));
      assert.equal(response.status, 401);
    }

    const blocked = await login(new NextRequest('https://monstajam.example/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': clientAddress },
      body: JSON.stringify({ password: 'wrong-password' }),
    }));
    assert.equal(blocked.status, 429);
    assert.equal(globalCalls, 5, 'a client-blocked request must not consume the global bucket');
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
  }
});
