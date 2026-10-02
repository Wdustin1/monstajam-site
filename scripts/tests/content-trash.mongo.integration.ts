// Opt-in network check. DATABASE_URL is redirected to a fresh, asserted-empty
// test database BEFORE importing either driver or any application module.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';

async function main() {
  assert.ok(process.argv.includes('--isolated-database'), 'Pass --isolated-database to run this network check.');
  assert.ok(process.env.DATABASE_URL, 'Supply DATABASE_URL through the environment.');
  const uri = new URL(process.env.DATABASE_URL);
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(uri.protocol));
  const databaseName = `monstajam_trash_test_${randomBytes(8).toString('hex')}`;
  assert.match(databaseName, /^monstajam_trash_test_[a-f0-9]{16}$/);
  assert.notEqual(databaseName, 'monstajam');
  uri.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = uri.toString();
  assert.equal(new URL(process.env.DATABASE_URL).pathname, `/${databaseName}`);
  process.env.BETTER_AUTH_URL = 'http://localhost';
  Object.assign(process.env, { NODE_ENV: 'test' });
  setServers(['1.1.1.1', '8.8.8.8']);

  const { MongoClient, ObjectId } = await import('mongodb');
  const { PrismaClient, Prisma } = await import('@prisma/client');
  const { NextRequest } = await import('next/server');
  const mongo = new MongoClient(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 15_000, connectTimeoutMS: 15_000 });
  const db = mongo.db();
  assert.equal(db.databaseName, databaseName);
  let ownsDatabase = false;
  let prisma: InstanceType<typeof PrismaClient> | undefined;
  const trackIds = [new ObjectId(), new ObjectId(), new ObjectId()];
  const videoIds = [new ObjectId(), new ObjectId(), new ObjectId()];
  const assetId = new ObjectId(); const creditId = new ObjectId();
  let checks = 0;
  function checked(message: string) { checks++; console.log(`PASS ${message}`); }
  function retained(record: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(record).filter(([key]) => !['deletedAt', 'deletedBy', 'published', 'updatedAt'].includes(key)));
  }
  function privateResponse(response: Response) {
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('vary'), 'Cookie');
  }
  function request(path: string, method = 'GET', body?: Record<string, unknown>) {
    return new NextRequest(`http://localhost${path}`, {
      method, headers: { Origin: 'http://localhost', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  try {
    assert.equal((await db.listCollections().toArray()).length, 0, 'Refuse to reuse a nonempty database.');
    ownsDatabase = true;
    await db.collection('tracks').createIndex({ slug: 1 }, { unique: true, name: 'tracks_slug_key' });
    const timestamp = new Date('2026-01-01T00:00:00Z');
    const trackBase = {
      title: 'Trash fixture', artist: 'Isolated fixture', genre: 'Hip-Hop', number: 1,
      color: 'bg-blue-500', accentCyan: false, story: 'Preserve this exact story',
      audioAssetId: assetId, playbackMode: 'full', coverUrl: 'https://example.invalid/cover.png',
      published: true, createdAt: timestamp, updatedAt: timestamp,
    };
    const videoBase = {
      title: 'Trash video fixture', artist: 'Isolated fixture', duration: '3:45',
      youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ',
      published: true, order: 1, createdAt: timestamp, updatedAt: timestamp,
    };
    await db.collection('tracks').insertMany(trackIds.map((_id, i) => ({ ...trackBase, _id, slug: `trash-track-${i}`, ...(i === 1 ? { deletedAt: null } : i === 2 ? { deletedAt: timestamp, deletedBy: 'prior_fixture' } : {}) })));
    await db.collection('videos').insertMany(videoIds.map((_id, i) => ({ ...videoBase, _id, ...(i === 1 ? { deletedAt: null } : i === 2 ? { deletedAt: timestamp, deletedBy: 'prior_fixture' } : {}) })));
    await db.collection('credits').insertOne({ _id: creditId, trackId: trackIds[0], role: 'Producer', name: 'Retained credit' });
    await db.collection('audio_assets').insertOne({
      _id: assetId, key: 'fixture-asset', originalPath: 'private/fixture/original.wav', originalName: 'original.wav',
      previewPath: 'private/fixture/preview.mp3', previewStart: 0, previewDuration: 45, status: 'ready', createdAt: timestamp, updatedAt: timestamp,
    });

    prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    (globalThis as typeof globalThis & { prisma?: InstanceType<typeof PrismaClient> }).prisma = prisma;
    const { adminAuthorization } = await import('../../src/lib/auth');
    adminAuthorization.getIdentity = async () => ({ id: 'isolated-trash-operator', name: 'Fixture operator', username: 'fixture_operator', role: 'admin' });
    const { activeContentWhere, trashedContentWhere } = await import('../../src/lib/content-trash');
    const trackRoute = await import('../../src/app/api/tracks/[slug]/route');
    const videoRoute = await import('../../src/app/api/videos/[id]/route');
    const trackRestore = await import('../../src/app/api/admin/trash/tracks/[slug]/restore/route');
    const videoRestore = await import('../../src/app/api/admin/trash/videos/[id]/restore/route');
    const trashRoute = await import('../../src/app/api/admin/trash/route');
    const tracksRoute = await import('../../src/app/api/tracks/route');
    const videosRoute = await import('../../src/app/api/videos/route');
    const titleRoute = await import('../../src/app/api/admin/track-title/route');

    const activeTracks = await prisma.track.findMany({ where: activeContentWhere(), orderBy: { slug: 'asc' } });
    const activeVideos = await prisma.video.findMany({ where: activeContentWhere() });
    assert.deepEqual(activeTracks.map(track => track.id).sort(), trackIds.slice(0, 2).map(id => id.toHexString()).sort());
    assert.deepEqual(activeVideos.map(video => video.id).sort(), videoIds.slice(0, 2).map(id => id.toHexString()).sort());
    assert.equal(await prisma.track.count({ where: trashedContentWhere() }), 1);
    assert.equal(await prisma.video.count({ where: trashedContentWhere() }), 1);
    for (const [route, path] of [[tracksRoute, '/api/tracks'], [videosRoute, '/api/videos']] as const) {
      assert.equal((await (await route.GET(request(path))).json()).length, 2);
      assert.equal((await (await route.GET(request(`${path}?all=true`))).json()).length, 2);
    }
    checked('real Prisma/Mongo active filters preserve missing and null fields and exclude trash from both libraries');

    const originalTrack = await db.collection('tracks').findOne({ _id: trackIds[0] });
    const originalVideo = await db.collection('videos').findOne({ _id: videoIds[0] });
    const originalCredit = await db.collection('credits').findOne({ _id: creditId });
    const originalAsset = await db.collection('audio_assets').findOne({ _id: assetId });
    assert.ok(originalTrack && originalVideo && originalCredit && originalAsset);
    const contextTrack = () => ({ params: Promise.resolve({ slug: 'trash-track-0' }) });
    const contextVideo = () => ({ params: Promise.resolve({ id: videoIds[0].toHexString() }) });
    async function trashTrack() { return trackRoute.DELETE(request('/api/tracks/trash-track-0', 'DELETE'), contextTrack()); }
    async function trashVideo() { return videoRoute.DELETE(request(`/api/videos/${videoIds[0]}`, 'DELETE'), contextVideo()); }
    async function restoreTrack() { return trackRestore.POST(request('/api/admin/trash/tracks/trash-track-0/restore', 'POST'), contextTrack()); }
    async function restoreVideo() { return videoRestore.POST(request(`/api/admin/trash/videos/${videoIds[0]}/restore`, 'POST'), contextVideo()); }
    for (const response of await Promise.all([trashTrack(), trashVideo()])) { assert.equal(response.status, 200); privateResponse(response); }
    const trashedTrack = await db.collection('tracks').findOne({ _id: trackIds[0] });
    const trashedVideo = await db.collection('videos').findOne({ _id: videoIds[0] });
    assert.ok(trashedTrack && trashedVideo);
    for (const row of [trashedTrack, trashedVideo]) { assert.equal(row.published, false); assert.ok(row.deletedAt instanceof Date); assert.equal(row.deletedBy, 'fixture_operator'); }
    assert.deepEqual(retained(trashedTrack), retained(originalTrack));
    assert.deepEqual(retained(trashedVideo), retained(originalVideo));
    assert.deepEqual(await db.collection('credits').findOne({ _id: creditId }), originalCredit);
    assert.deepEqual(await db.collection('audio_assets').findOne({ _id: assetId }), originalAsset);
    assert.equal((await trashTrack()).status, 200); assert.equal((await trashVideo()).status, 200);
    assert.deepEqual(await db.collection('tracks').findOne({ _id: trackIds[0] }), trashedTrack);
    assert.deepEqual(await db.collection('videos').findOne({ _id: videoIds[0] }), trashedVideo);
    checked('soft trash preserves full metadata, original/preview asset and credits; repeated deletes preserve timestamps');

    const trashResponse = await trashRoute.GET(request('/api/admin/trash'));
    assert.equal(trashResponse.status, 200); privateResponse(trashResponse);
    const trashBody = await trashResponse.json();
    assert.equal(trashBody.tracks.length, 2); assert.equal(trashBody.videos.length, 2);
    assert.equal(trashBody.tracks[0].id, trackIds[0].toHexString());
    assert.equal(trashBody.tracks[0].credits[0].id, creditId.toHexString());
    assert.equal((await trackRoute.GET(request('/api/tracks/trash-track-0?preview=true'), contextTrack())).status, 404);
    const titleResponse = await titleRoute.GET(request('/api/admin/track-title?title=Trash%20Track%200'));
    assert.equal(titleResponse.status, 409); assert.match((await titleResponse.json()).error, /in Trash/);
    checked('Trash is sorted and keeps credits, detail preview denies trash, and reserved slugs give restore guidance');

    assert.equal((await trackRoute.PUT(request('/api/tracks/trash-track-0', 'PUT', { published: true }), contextTrack())).status, 404);
    assert.equal((await videoRoute.PUT(request(`/api/videos/${videoIds[0]}`, 'PUT', { published: true }), contextVideo())).status, 404);
    for (const action of [
      () => prisma!.track.update({ where: { slug: 'trash-track-0', AND: [activeContentWhere()] }, data: { published: true } }),
      () => prisma!.video.update({ where: { id: videoIds[0].toHexString(), AND: [activeContentWhere()] }, data: { published: true } }),
    ]) {
      await assert.rejects(action, error => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025');
    }
    assert.equal((await db.collection('tracks').findOne({ _id: trackIds[0] }))?.published, false);
    assert.equal((await db.collection('videos').findOne({ _id: videoIds[0] }))?.published, false);
    checked('extended unique update predicates enforce the atomic active guard with real P2025 errors');

    for (const response of await Promise.all([restoreTrack(), restoreVideo()])) {
      assert.equal(response.status, 200); privateResponse(response);
      const row = await response.json(); assert.equal(row.published, false); assert.equal(row.deletedAt, null); assert.equal(row.deletedBy, null);
    }
    const restoredTrack = await db.collection('tracks').findOne({ _id: trackIds[0] });
    const restoredVideo = await db.collection('videos').findOne({ _id: videoIds[0] });
    assert.ok(restoredTrack && restoredVideo);
    assert.deepEqual(retained(restoredTrack), retained(originalTrack));
    assert.deepEqual(retained(restoredVideo), retained(originalVideo));
    assert.equal((await prisma.track.findUnique({ where: { slug: 'trash-track-0' }, include: { credits: true } }))?.credits[0].id, creditId.toHexString());
    checked('restore returns the same IDs, slug, audio, cover and credits as drafts');

    // An old request that read before trash/restore must still fail after the
    // item becomes active again. The timestamp makes the atomic predicate CAS.
    for (const action of [
      () => prisma!.track.update({ where: { slug: 'trash-track-0', updatedAt: timestamp, AND: [activeContentWhere()] }, data: { published: true } }),
      () => prisma!.video.update({ where: { id: videoIds[0].toHexString(), updatedAt: timestamp, AND: [activeContentWhere()] }, data: { published: true } }),
    ]) await assert.rejects(action, error => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025');
    assert.equal((await trackRoute.PUT(request('/api/tracks/trash-track-0', 'PUT', { published: true, expectedUpdatedAt: timestamp.toISOString() }), contextTrack())).status, 409);
    assert.equal((await videoRoute.PUT(request(`/api/videos/${videoIds[0]}`, 'PUT', { published: true, expectedUpdatedAt: timestamp.toISOString() }), contextVideo())).status, 409);
    assert.deepEqual(await db.collection('tracks').findOne({ _id: trackIds[0] }), restoredTrack);
    assert.deepEqual(await db.collection('videos').findOne({ _id: videoIds[0] }), restoredVideo);
    checked('timestamp CAS and editor expected revisions prevent stale publishing after trash-and-restore');

    assert.equal((await trackRoute.PUT(request('/api/tracks/trash-track-0', 'PUT', { published: true, expectedUpdatedAt: restoredTrack.updatedAt.toISOString(), reviewedPlaybackMode: 'full' }), contextTrack())).status, 200);
    assert.equal((await videoRoute.PUT(request(`/api/videos/${videoIds[0]}`, 'PUT', { published: true, expectedUpdatedAt: restoredVideo.updatedAt.toISOString() }), contextVideo())).status, 200);
    const republishedTrack = await db.collection('tracks').findOne({ _id: trackIds[0] });
    const republishedVideo = await db.collection('videos').findOne({ _id: videoIds[0] });
    for (const response of await Promise.all([restoreTrack(), restoreVideo()])) { assert.equal(response.status, 200); assert.equal((await response.json()).published, true); }
    assert.deepEqual(await db.collection('tracks').findOne({ _id: trackIds[0] }), republishedTrack);
    assert.deepEqual(await db.collection('videos').findOne({ _id: videoIds[0] }), republishedVideo);
    assert.deepEqual(await db.collection('audio_assets').findOne({ _id: assetId }), originalAsset);
    checked('repeated restore never unpublishes an already-live record or mutates retained audio');
    console.log(JSON.stringify({ ok: true, checks, isolatedDatabase: databaseName }));
  } finally {
    await prisma?.$disconnect();
    try {
      if (ownsDatabase) {
        assert.equal(db.databaseName, databaseName);
        assert.match(databaseName, /^monstajam_trash_test_[a-f0-9]{16}$/);
        const ownedCollections = [['credits', [creditId]], ['tracks', trackIds], ['videos', videoIds], ['audio_assets', [assetId]]] as const;
        for (const [collection, ids] of ownedCollections) {
          await db.collection(collection).deleteMany({ _id: { $in: [...ids] } });
          assert.equal(await db.collection(collection).countDocuments({ _id: { $in: [...ids] } }), 0);
          assert.equal(await db.collection(collection).countDocuments(), 0, 'Unexpected records remain; do not delete unowned data.');
        }
        console.log('Removed only this run\'s fixture records from the fresh isolated database.');
      }
    } finally { await mongo.close(); }
  }
}

main().catch(error => {
  // Database error messages can contain hostnames/URIs. Only safe diagnostics.
  console.error(JSON.stringify({ ok: false, name: error?.name, code: error?.code ?? null, assertion: error?.operator ?? null }));
  process.exitCode = 1;
});
