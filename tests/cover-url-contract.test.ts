import assert from 'node:assert/strict';
import test from 'node:test';
import nextConfig from '../next.config';
import { parseAllowedCoverUrl } from '../src/lib/coverProxy';
import { parsePlayerSnapshot } from '../src/lib/player-comfort';
import { proxyCoverUrl } from '../src/lib/proxy-cover';
import { TrackCreateSchema } from '../src/lib/schemas';
import { normalizeAllowedCoverUrl } from '../src/lib/media-url';

const baseTrack = {
  slug: 'cover-contract-track',
  title: 'Cover Contract Track',
  artist: 'Monsta Jam',
  color: 'bg-violet-500',
};

function parseSnapshotCover(coverUrl: string) {
  return parsePlayerSnapshot(JSON.stringify({
    version: 1,
    currentTrack: { ...baseTrack, coverUrl },
    queue: [],
    currentTime: 0,
    volume: 0.75,
    shuffleOn: false,
    repeatOn: false,
  }));
}

function isNextLocalPathAllowed(value: string) {
  const pathname = new URL(value, 'https://monstajam.local').pathname;
  const patterns = (nextConfig.images?.localPatterns ?? []) as Array<{ pathname?: string }>;
  return patterns.some((pattern) => {
    if (!pattern.pathname) return false;
    if (pattern.pathname.endsWith('/**')) {
      return pathname.startsWith(pattern.pathname.slice(0, -2));
    }
    return pathname === pattern.pathname;
  });
}

test('trusted external covers survive schema, snapshot, proxy, Next Image, and route allowlists', () => {
  const coverUrl = 'https://assets.blob.vercel-storage.com/covers/album.jpg';
  const schemaResult = TrackCreateSchema.safeParse({
    title: baseTrack.title,
    artist: baseTrack.artist,
    slug: baseTrack.slug,
    number: 1,
    coverUrl,
  });
  assert.equal(schemaResult.success, true);
  assert.ok(parseSnapshotCover(coverUrl));

  const proxied = proxyCoverUrl(coverUrl);
  assert.ok(proxied.startsWith('/api/cover?url='));
  assert.equal(isNextLocalPathAllowed(proxied), true);
  assert.equal(parseAllowedCoverUrl(new URL(proxied, 'https://monstajam.local').searchParams.get('url')!).toString(), coverUrl);
});

test('trusted external covers are canonicalized before storage, snapshots, and proxy authorization', () => {
  const rawCoverUrl = ' https://ASSETS.blob.vercel-storage.com:443/covers/../album%20art.jpg ';
  const canonicalCoverUrl = 'https://assets.blob.vercel-storage.com/album%20art.jpg';
  const schemaResult = TrackCreateSchema.safeParse({
    title: baseTrack.title,
    artist: baseTrack.artist,
    slug: baseTrack.slug,
    number: 1,
    coverUrl: rawCoverUrl,
  });

  assert.equal(schemaResult.success, true);
  if (!schemaResult.success) assert.fail('trusted non-canonical cover should parse');
  assert.equal(schemaResult.data.coverUrl, canonicalCoverUrl);
  assert.equal(parseSnapshotCover(rawCoverUrl)?.currentTrack?.coverUrl, canonicalCoverUrl);

  const proxied = proxyCoverUrl(rawCoverUrl);
  const sourceUrl = new URL(proxied, 'https://monstajam.local').searchParams.get('url');
  assert.equal(sourceUrl, canonicalCoverUrl);
  assert.equal(parseAllowedCoverUrl(sourceUrl!).toString(), canonicalCoverUrl);
});

test('normalization is idempotent and rejects canonical URLs that exceed the storage contract', () => {
  const expandingCoverUrl = `https://assets.blob.vercel-storage.com/${'é'.repeat(100)}`;
  assert.ok(expandingCoverUrl.length < 500);
  assert.equal(normalizeAllowedCoverUrl(expandingCoverUrl), null);
  assert.equal(proxyCoverUrl(expandingCoverUrl), '');
  assert.equal(parseSnapshotCover(expandingCoverUrl), null);
  assert.equal(TrackCreateSchema.safeParse({
    title: baseTrack.title,
    artist: baseTrack.artist,
    slug: baseTrack.slug,
    number: 1,
    coverUrl: expandingCoverUrl,
  }).success, false);
  assert.throws(() => parseAllowedCoverUrl(expandingCoverUrl));
});

test('allowed local covers survive snapshot parsing and Next Image matching', () => {
  for (const coverUrl of [
    '/monstajam-logo.png',
    '/monstajam-record-label.png',
    '/releases/local-cover.jpg',
  ]) {
    assert.ok(parseSnapshotCover(coverUrl));
    assert.equal(proxyCoverUrl(coverUrl), coverUrl);
    assert.equal(isNextLocalPathAllowed(coverUrl), true);
  }
});

test('unrenderable local and external covers fail before reaching Next Image', () => {
  for (const coverUrl of [
    '/covers/not-in-next-allowlist.jpg',
    'https://images.example.com/cover.jpg',
    'http://assets.blob.vercel-storage.com/cover.jpg',
  ]) {
    assert.equal(parseSnapshotCover(coverUrl), null);
    assert.equal(proxyCoverUrl(coverUrl), '');
  }
});
