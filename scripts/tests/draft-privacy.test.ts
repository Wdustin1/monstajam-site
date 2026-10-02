import { mockNamedAdminSession } from './fixtures/admin-session';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

let getDetails: typeof import('../../src/app/api/tracks/[slug]/route').GET;
let listTracks: typeof import('../../src/app/api/tracks/route').GET;
let getPublishedTrack: typeof import('../../src/lib/published-track').getPublishedTrack;
let publicTrackPage: typeof import('../../src/app/tracks/[slug]/page').default;
let publicTrackMetadata: typeof import('../../src/app/tracks/[slug]/page').generateMetadata;
let homePage: typeof import('../../src/app/page').default;
let genresPage: typeof import('../../src/app/genres/page').default;
let videosPage: typeof import('../../src/app/videos/page').default;

const testSecret = 'local-track-preview-test';

const fixture = {
  slug: 'unreleased-track',
  title: 'Unreleased track',
  published: false,
  playbackMode: 'preview',
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
  video: {
    async count(args?: { where?: Record<string, unknown> }): Promise<number> { throw new Error(`Unexpected video count: ${JSON.stringify(args)}`); },
    async findMany(args?: { where?: Record<string, unknown> }): Promise<Record<string, unknown>[]> { throw new Error(`Unexpected video query: ${JSON.stringify(args)}`); },
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
  homePage = (await import('../../src/app/page')).default;
  genresPage = (await import('../../src/app/genres/page')).default;
  videosPage = (await import('../../src/app/videos/page')).default;
});

after(() => {
  if (originalPrisma === undefined) delete prismaCache.prisma;
  else prismaCache.prisma = originalPrisma;
});

beforeEach(() => {
  // No environment file is loaded and every database call is mocked.
  mockNamedAdminSession(testSecret);
});

afterEach(() => {
  mock.restoreAll();


});

function request(query = '', cookie?: string) {
  return new NextRequest(`http://localhost/api/tracks/${fixture.slug}${query}`, {
    headers: cookie ? { Cookie: `monstajam_auth.session_token=${cookie}` } : undefined,
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

test('draft preview is denied after the named admin session is revoked', async () => {
  mock.method(database.track, 'findUnique', async () => fixture);
  mockNamedAdminSession(testSecret, false);
  const response = await getTrack('?preview=true', testSecret);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
  assertPrivateResponse(response);
});

test('the obsolete shared-password cookie cannot preview a draft', async () => {
  mock.method(database.track, 'findUnique', async () => fixture);
  const response = await getDetails(new NextRequest(`http://localhost/api/tracks/${fixture.slug}?preview=true`, {
    headers: { Cookie: `admin_session=${testSecret}` },
  }), { params: Promise.resolve({ slug: fixture.slug }) });
  assert.equal(response.status, 404);
});

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
      headers: scenario.cookie ? { Cookie: `monstajam_auth.session_token=${scenario.cookie}` } : undefined,
    }));

    if (scenario.query === '?all=true' && !scenario.showAll) {
      assert.equal(response.status, 401);
      assert.equal(findMany.mock.callCount(), 0);
    } else {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), scenario.showAll ? [published, fixture] : [published]);
      assert.equal(findMany.mock.calls[0].arguments[0]?.where?.published, scenario.showAll ? undefined : true);
    }
    assertPrivateResponse(response);
  });
}

test('a list database failure also keeps private cache headers', async () => {
  mock.method(database.track, 'findMany', async () => {
    throw new Error('Sensitive database connection details');
  });
  mock.method(console, 'error', () => {});

  const response = await listTracks(new NextRequest('http://localhost/api/tracks?all=true', {
    headers: { Cookie: `monstajam_auth.session_token=${testSecret}` },
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
  assert.deepEqual(findFirst.mock.calls[0].arguments[0].where, {
    slug: fixture.slug, published: true, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
  });
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

// Model Mongo's distinction between a missing field and explicit null. A null
// equality alone must not accidentally make these legacy fixtures disappear.
function matchesContent(row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return (value as Record<string, unknown>[]).some((condition) => matchesContent(row, condition));
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((condition) => matchesContent(row, condition));
    if (value && typeof value === 'object' && 'isSet' in value) return Object.hasOwn(row, key) === value.isSet;
    return row[key] === value;
  });
}

function contentFixtures() {
  const common = { ...fixture, id: 'legacy', artist: 'Active Artist', genre: 'Hip-Hop', number: 1, color: 'fixture', createdAt: new Date('2026-01-01'), published: true };
  const rows = [
    { ...common, slug: 'legacy-active', title: 'Legacy active' },
    { ...common, id: 'null', slug: 'null-active', title: 'Explicit null active', number: 2, deletedAt: null },
    { ...common, id: 'trashed', slug: 'trashed-published', title: 'TRASHED_TITLE_SENTINEL', artist: 'Trashed Artist', deletedAt: new Date('2026-02-01'), createdAt: new Date('2026-03-01') },
    { ...common, id: 'draft', slug: 'active-draft', title: 'DRAFT_TITLE_SENTINEL', published: false },
  ];
  const videoRows = [
    { id: 'legacy-video', title: 'Legacy video', published: true },
    { id: 'null-video', title: 'Explicit null video', published: true, deletedAt: null },
    { id: 'trashed-video', title: 'TRASHED_VIDEO_SENTINEL', published: true, deletedAt: new Date() },
    { id: 'draft-video', title: 'Draft video', published: false },
  ];
  mock.method(database.track, 'findFirst', async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matchesContent(row, where)) ?? null);
  mock.method(database.track, 'findMany', async (args?: { where?: Record<string, unknown> }) => rows.filter((row) => matchesContent(row, args?.where)));
  mock.method(database.video, 'findMany', async (args?: { where?: Record<string, unknown> }) => videoRows.filter((row) => matchesContent(row, args?.where)));
  mock.method(database.video, 'count', async (args?: { where?: Record<string, unknown> }) => videoRows.filter((row) => matchesContent(row, args?.where)).length);
  return rows;
}

function findProps(tree: unknown, predicate: (props: Record<string, unknown>) => boolean): Record<string, unknown> | undefined {
  if (Array.isArray(tree)) {
    for (const item of tree) { const found = findProps(item, predicate); if (found) return found; }
  } else if (tree && typeof tree === 'object' && 'props' in tree) {
    const props = tree.props as Record<string, unknown>;
    if (predicate(props)) return props;
    return findProps(props.children, predicate);
  }
}

test('public detail and metadata hide a trashed published track while retaining both legacy and explicit-null active records', async () => {
  contentFixtures();
  for (const slug of ['legacy-active', 'null-active']) {
    assert.equal((await getPublishedTrack(slug))?.slug, slug);
    assert.match((await publicTrackMetadata({ params: Promise.resolve({ slug }) })).title, /active/);
  }
  assert.equal(await getPublishedTrack('trashed-published'), null);
  const params = Promise.resolve({ slug: 'trashed-published' });
  const isNotFound = (error: unknown) => error instanceof Error && 'digest' in error && error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404';
  await assert.rejects(publicTrackPage({ params }), isNotFound);
  await assert.rejects(publicTrackMetadata({ params }), isNotFound);
});

test('homepage featured track, search library, artist and video counts exclude trashed records', async () => {
  contentFixtures();
  const page = await homePage();
  const hero = findProps(page, (props) => 'trackCount' in props);
  assert.ok(hero);
  assert.equal(hero.trackCount, 2);
  assert.equal(hero.artistCount, 1);
  assert.equal(hero.videoCount, 2);
  assert.equal((hero.featuredTrack as { slug: string }).slug, 'legacy-active');
  const library = findProps(page, (props) => Array.isArray(props.tracks));
  assert.deepEqual((library?.tracks as { slug: string }[]).map((row) => row.slug), ['legacy-active', 'null-active']);
});

test('genre browsing, video gallery and related-track player queue receive only active published records', async () => {
  contentFixtures();
  const genres = findProps(await genresPage(), (props) => Array.isArray(props.tracks));
  assert.deepEqual((genres?.tracks as { slug: string }[]).map((row) => row.slug), ['legacy-active', 'null-active']);
  const videos = findProps(await videosPage(), (props) => Array.isArray(props.videos));
  assert.deepEqual((videos?.videos as { id: string }[]).map((row) => row.id), ['legacy-video', 'null-video']);
  const detail = findProps(await publicTrackPage({ params: Promise.resolve({ slug: 'legacy-active' }) }), (props) => Array.isArray(props.allTracks));
  assert.deepEqual((detail?.allTracks as { slug: string }[]).map((row) => row.slug), ['legacy-active', 'null-active']);
});

for (const cookie of [undefined, testSecret]) {
  test(`trashed track details remain hidden from ${cookie ? 'authenticated preview' : 'public'} API requests`, async () => {
    mock.method(database.track, 'findUnique', async () => ({ ...fixture, published: true, deletedAt: new Date() }));
    const response = await getTrack('?preview=true', cookie);
    assert.equal(response.status, 404);
    assertPrivateResponse(response);
  });
}
