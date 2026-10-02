/* Read-only fixtures loaded only by the local HTTP integration test. */
'use strict';

const databaseUrl = new URL(process.env.DATABASE_URL || 'file:///missing');
if (
  process.env.MONSTAJAM_LOCAL_PRIVACY_FIXTURES !== '1' ||
  (process.env.NODE_ENV === 'production' && process.env.MONSTAJAM_LOCAL_PRIVACY_PRODUCTION !== '1') ||
  databaseUrl.protocol !== 'mongodb:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(databaseUrl.hostname) ||
  databaseUrl.pathname !== '/monstajam_privacy_test' ||
  databaseUrl.username || databaseUrl.password
) {
  throw new Error('Privacy fixtures require explicit opt-in and the credential-free local test database URL.');
}

const shared = {
  artist: 'Local Test Artist', genre: 'Hip-Hop', number: 1, bpm: 100,
  mood: 'Test', color: 'bg-gradient-to-br from-purple-600 to-blue-500',
  accentCyan: false, subtitle: null, spotifyUrl: null, appleMusicUrl: null,
  coverUrl: null, credits: [], createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
};
const tracks = [
  { ...shared, id: '000000000000000000000001', slug: 'privacy-public-track',
    title: 'PUBLIC_FIXTURE_TITLE', story: 'PUBLIC_FIXTURE_STORY',
    audioUrl: 'https://example.invalid/public-fixture.mp3', published: true },
  { ...shared, id: '000000000000000000000002', slug: 'privacy-draft-track', number: 2,
    title: 'PRIVATE_FIXTURE_TITLE_9d2a', story: 'PRIVATE_FIXTURE_STORY_7e3b',
    coverUrl: '/favicon.png?private-fixture-cover-6c8a',
    audioUrl: 'https://example.invalid/private-fixture-a8f4.mp3', published: false, deletedAt: null },
  { ...shared, id: '000000000000000000000004', slug: 'privacy-trashed-track', number: 3,
    title: 'TRASHED_FIXTURE_TITLE_1b7c', story: 'TRASHED_FIXTURE_STORY_8f2e',
    coverUrl: '/favicon.png?trashed-fixture-cover-4ae1',
    audioUrl: 'https://example.invalid/trashed-fixture-original-94ae.mp3', published: true,
    audioAssetId: '000000000000000000000007',
    deletedAt: new Date('2026-01-03T00:00:00Z'), deletedBy: 'fixture-admin' },
  { ...shared, id: '000000000000000000000005', slug: 'privacy-trashed-draft', number: 4,
    title: 'TRASHED_DRAFT_FIXTURE_TITLE_763c', published: false,
    audioAssetId: '000000000000000000000008', deletedAt: new Date('2026-01-03T00:00:00Z') },
];
const videos = [{ id: '000000000000000000000003', title: 'Local Fixture Video',
  artist: 'Local Test Artist', youtubeUrl: 'https://example.invalid/local-video',
  youtubeId: 'LOCAL000001', published: true, order: 1, duration: '3:00',
  createdAt: shared.createdAt, updatedAt: shared.updatedAt },
  { id: '000000000000000000000006', title: 'TRASHED_VIDEO_FIXTURE_TITLE_439d',
    artist: 'Trashed Fixture Artist', youtubeUrl: 'https://example.invalid/trashed-video',
    youtubeId: 'TRASHED0001', published: true, order: 2, duration: '4:00',
    deletedAt: new Date('2026-01-03T00:00:00Z'), createdAt: shared.createdAt, updatedAt: shared.updatedAt }];

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((item) => matches(row, item));
    if (key === 'OR') return value.some((item) => matches(row, item));
    if (value && typeof value === 'object') {
      if ('isSet' in value && Object.hasOwn(row, key) !== value.isSet) return false;
      if ('not' in value && row[key] === value.not) return false;
      if ('isSet' in value || 'not' in value) return true;
      if ('equals' in value) return row[key] === value.equals;
      if ('in' in value) return value.in.includes(row[key]);
      throw new Error('Unsupported fixture filter: ' + key);
    }
    return row[key] === value;
  });
}

function read(rows, args = {}) {
  let result = rows.filter((row) => matches(row, args.where));
  const orderBy = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
  result.sort((a, b) => {
    for (const order of orderBy) {
      for (const [field, direction] of Object.entries(order)) {
        const delta = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
        if (delta) return direction === 'desc' ? -delta : delta;
      }
    }
    return 0;
  });
  if (args.skip) result = result.slice(args.skip);
  if (args.take !== undefined) result = result.slice(0, args.take);
  return result.map((row) => structuredClone(args.select
    ? Object.fromEntries(Object.entries(args.select).filter(([, enabled]) => enabled).map(([field]) => [field, row[field]]))
    : row));
}

function readonlyModel(rows) {
  const methods = {
    findMany: async (args) => read(rows, args),
    findFirst: async (args) => read(rows, args)[0] ?? null,
    findUnique: async (args) => read(rows, args)[0] ?? null,
    count: async (args) => read(rows, args).length,
  };
  return new Proxy(methods, {
    get(target, method) {
      if (method in target) return target[method];
      return async () => { throw new Error('Privacy fixture blocks database mutation/unsupported method: ' + String(method)); };
    },
  });
}

globalThis.prisma = new Proxy({ track: readonlyModel(tracks), video: readonlyModel(videos) }, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === '$disconnect' || key === '$connect') return async () => undefined;
    return async () => { throw new Error('Privacy fixture blocks database operation: ' + String(key)); };
  },
});
