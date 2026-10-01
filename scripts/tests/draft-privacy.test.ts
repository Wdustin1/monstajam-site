import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

let getDetails: typeof import('../../src/app/api/tracks/[slug]/route').GET;
let listTracks: typeof import('../../src/app/api/tracks/route').GET;
let getPublishedTrack: typeof import('../../src/lib/published-track').getPublishedTrack;
let publicTrackPage: typeof import('../../src/app/tracks/[slug]/page').default;
let publicTrackMetadata: typeof import('../../src/app/tracks/[slug]/page').generateMetadata;

const testSecret = 'local-track-preview-test';
const originalSecret = process.env.ADMIN_SECRET;
const fixture = {
  slug: 'unreleased-track',
  title: 'Unreleased track',
  published: false,
  audioUrl: 'https://example.invalid/unreleased.mp3',
  credits: [{ role: 'Producer', name: 'Test producer' }],
};
const database = {
  track: {
    async findUnique(): Promise<typeof fixture | null> {
      throw new Error('Unexpected unmocked track query');
    },
    async findFirst(args: { where: { slug: string; published: boolean } }): Promise<typeof fixture | null> {
      throw new Error(`Unexpected unmocked track query: ${JSON.stringify(args)}`);
    },
    async findMany(args?: { where?: { published?: boolean } }): Promise<typeof fixture[]> {
      throw new Error(`Unexpected unmocked track query: ${JSON.stringify(args)}`);
    },
  },
};
const prismaCache = globalThis as unknown as { prisma?: PrismaClient };
const originalPrisma = prismaCache.prisma;

before(async () => {
  // Inject before loading the routes so these tests cannot connect to a database.
  // The real Prisma delegate is a Proxy that node:test cannot mock with mock.method.
  prismaCache.prisma = database as unknown as PrismaClient;
  getDetails = (await import('../../src/app/api/tracks/[slug]/route')).GET;
  listTracks = (await import('../../src/app/api/tracks/route')).GET;
  getPublishedTrack = (await import('../../src/lib/published-track')).getPublishedTrack;
  const publicPage = await import('../../src/app/tracks/[slug]/page');
  publicTrackPage = publicPage.default;
  publicTrackMetadata = publicPage.generateMetadata;
});

after(() => {
  if (originalPrisma === undefined) delete prismaCache.prisma;
  else prismaCache.prisma = originalPrisma;
});

beforeEach(() => {
  // No environment file is loaded and every database call is mocked.
  process.env.ADMIN_SECRET = testSecret;
});

afterEach(() => {
  mock.restoreAll();
  if (originalSecret === undefined) delete process.env.ADMIN_SECRET;
  else process.env.ADMIN_SECRET = originalSecret;
});

function request(query = '', cookie?: string) {
  return new NextRequest(`http://localhost/api/tracks/${fixture.slug}${query}`, {
    headers: cookie ? { Cookie: `admin_session=${cookie}` } : undefined,
  });
}

function getTrack(query = '', cookie?: string) {
  return getDetails(request(query, cookie), { params: Promise.resolve({ slug: fixture.slug }) });
}

function assertPrivateResponse(response: Response) {
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Vary'), 'Cookie');
}

test('published tracks remain public and include their credits', async () => {
  const published = { ...fixture, published: true };
  mock.method(database.track, 'findUnique', async () => published);

  const response = await getTrack();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), published);
  assertPrivateResponse(response);
});

for (const scenario of [
  { name: 'a signed-out visitor', query: '', cookie: undefined },
  { name: 'a signed-out preview visitor', query: '?preview=true', cookie: undefined },
  { name: 'an invalid admin cookie', query: '?preview=true', cookie: 'invalid-session' },
  { name: 'an admin using the ordinary URL', query: '', cookie: testSecret },
  { name: 'an admin with preview disabled', query: '?preview=false', cookie: testSecret },
  { name: 'an admin with an inexact preview value', query: '?preview=1', cookie: testSecret },
]) {
  test(`draft details stay hidden from ${scenario.name}`, async () => {
    mock.method(database.track, 'findUnique', async () => fixture);

    const response = await getTrack(scenario.query, scenario.cookie);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
    assertPrivateResponse(response);
  });
}

test('an admin can explicitly preview a draft without public caching', async () => {
  mock.method(database.track, 'findUnique', async () => fixture);

  const response = await getTrack('?preview=true', testSecret);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), fixture);
  assertPrivateResponse(response);
});

for (const secret of [undefined, '']) {
  test(`draft preview is denied when ADMIN_SECRET is ${secret === undefined ? 'missing' : 'empty'}`, async () => {
    mock.method(database.track, 'findUnique', async () => fixture);
    if (secret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = secret;

    const response = await getTrack('?preview=true', testSecret);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
    assertPrivateResponse(response);
  });
}

test('a missing track has the same response as an inaccessible draft', async () => {
  mock.method(database.track, 'findUnique', async () => null);

  for (const [query, cookie] of [['', undefined], ['?preview=true', testSecret]]) {
    const response = await getTrack(query, cookie);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
    assertPrivateResponse(response);
  }
});

test('database failures return an uncached generic error without leaking details', async () => {
  mock.method(database.track, 'findUnique', async () => {
    throw new Error('Sensitive database connection details');
  });
  mock.method(console, 'error', () => {});

  const response = await getTrack('?preview=true', testSecret);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to fetch track' });
  assertPrivateResponse(response);
});

for (const scenario of [
  { name: 'the public library', query: '', cookie: undefined, showAll: false },
  { name: 'a signed-out all-tracks request', query: '?all=true', cookie: undefined, showAll: false },
  { name: 'an invalid session requesting all tracks', query: '?all=true', cookie: 'invalid-session', showAll: false },
  { name: 'an admin using the public library URL', query: '', cookie: testSecret, showAll: false },
  { name: 'an admin requesting all tracks', query: '?all=true', cookie: testSecret, showAll: true },
]) {
  test(`${scenario.name} returns only the permitted tracks with private cache headers`, async () => {
    const published = { ...fixture, slug: 'published-track', published: true };
    const findMany = mock.method(database.track, 'findMany', async (args?: { where?: { published?: boolean } }) => {
      return [published, fixture].filter((track) => !args?.where?.published || track.published);
    });

    const response = await listTracks(new NextRequest(`http://localhost/api/tracks${scenario.query}`, {
      headers: scenario.cookie ? { Cookie: `admin_session=${scenario.cookie}` } : undefined,
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), scenario.showAll ? [published, fixture] : [published]);
    assert.equal(findMany.mock.calls[0].arguments[0]?.where?.published, scenario.showAll ? undefined : true);
    assertPrivateResponse(response);
  });
}

test('a list database failure also keeps private cache headers', async () => {
  mock.method(database.track, 'findMany', async () => {
    throw new Error('Sensitive database connection details');
  });
  mock.method(console, 'error', () => {});

  const response = await listTracks(new NextRequest('http://localhost/api/tracks?all=true', {
    headers: { Cookie: `admin_session=${testSecret}` },
  }));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to fetch tracks' });
  assertPrivateResponse(response);
});

test('public track lookup excludes draft records at the database boundary', async () => {
  const findFirst = mock.method(database.track, 'findFirst', async (args: { where: { slug: string; published: boolean } }) => {
    return fixture.slug === args.where.slug && fixture.published === args.where.published ? fixture : null;
  });

  assert.equal(await getPublishedTrack(fixture.slug), null);
  assert.deepEqual(findFirst.mock.calls[0].arguments[0].where, { slug: fixture.slug, published: true });
});

test('public track lookup returns a published record', async () => {
  const published = { ...fixture, published: true };
  mock.method(database.track, 'findFirst', async (args: { where: { slug: string; published: boolean } }) => {
    return published.slug === args.where.slug && published.published === args.where.published ? published : null;
  });

  assert.deepEqual(await getPublishedTrack(published.slug), published);
});

test('public draft pages and metadata both return not found', async () => {
  mock.method(database.track, 'findFirst', async () => null);
  const findMany = mock.method(database.track, 'findMany', async () => []);
  const params = Promise.resolve({ slug: fixture.slug });
  const isNotFound = (error: unknown) => error instanceof Error &&
    'digest' in error && error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404';

  await assert.rejects(publicTrackMetadata({ params }), isNotFound);
  await assert.rejects(publicTrackPage({ params }), isNotFound);
  assert.equal(findMany.mock.callCount(), 0, 'an inaccessible page must not build a player queue');
});

test('published-track metadata remains available', async () => {
  mock.method(database.track, 'findFirst', async () => ({ ...fixture, published: true }));

  const metadata = await publicTrackMetadata({ params: Promise.resolve({ slug: fixture.slug }) });

  assert.equal(metadata.title, `${fixture.title} — MonstaJam`);
});
