/* Start the real local dashboard/API against memory-only records:
 * node scripts/tests/admin-save.fixture.cjs
 * Add --production for a compiled-server smoke that stops after its checks.
 * The generated control.json path supports delayMs (0-10000),
 * failMutationGeneration/failReadGeneration (increment to fail once),
 * failTrackReads/failVideoReads (persistent, independent library failures),
 * expireSession (boolean), and resetGeneration (increment to restore fixtures).
 * Changes affect only this opted-in local fixture process, never the app source.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS Node fixture runner. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const port = 3311;
const base = `http://127.0.0.1:${port}`;
const production = process.argv.includes('--production');
const origin = `${production ? 'https' : 'http'}://localhost:${port}`;
const password = `local-admin-save-${randomUUID()}`;
const smokeOnly = production || process.argv.includes('--smoke-only');
let child;
let stopping = false;
let serverLog = '';
let controlPath;
let state = { delayMs: 0, failMutationGeneration: 0, failReadGeneration: 0, failTrackReads: false, failVideoReads: false, expireSession: false, resetGeneration: 0 };

async function setControls(values) {
  state = { ...state, ...values };
  await fs.writeFile(controlPath, JSON.stringify(state, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 250));
}

function stop() {
  if (!child || stopping) return;
  stopping = true;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
}

async function request(route, { cookie, body, ...options } = {}) {
  const headers = { ...(production ? { 'X-Forwarded-Proto': 'https' } : {}), ...options.headers, ...(cookie ? { Cookie: cookie } : {}),
    ...(!['GET', 'HEAD'].includes(options.method || 'GET') ? { Origin: origin } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}) };
  return fetch(base + route, { redirect: 'manual', ...options, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
}

async function trashSmoke(cookie) {
  const savedTrack = (await (await request('/api/tracks?all=true', { cookie })).json())[0];
  const savedVideo = (await (await request('/api/videos?all=true', { cookie })).json())[0];
  assert.equal((await request('/api/admin/trash')).status, 401);
  assert.equal((await request('/api/tracks/admin-save-live', { method: 'DELETE' })).status, 401);
  for (const route of ['/api/tracks/admin-save-live', '/api/videos/000000000000000000000003']) {
    assert.equal((await request(route, { method: 'DELETE', cookie })).status, 200);
    assert.equal((await request(route, { method: 'DELETE', cookie })).status, 200, 'Repeating trash must be safe');
  }
  assert.equal((await (await request('/api/tracks?all=true', { cookie })).json()).length, 1);
  assert.equal((await (await request('/api/videos?all=true', { cookie })).json()).length, 0);
  const trashed = await (await request('/api/admin/trash', { cookie })).json();
  assert.equal(trashed.tracks.length, 1);
  assert.equal(trashed.videos.length, 1);
  for (const record of [...trashed.tracks, ...trashed.videos]) {
    assert.equal(record.published, false);
    assert.ok(Number.isFinite(Date.parse(record.deletedAt)));
    assert.equal(record.deletedBy, 'dustin');
  }
  assert.equal(trashed.tracks[0].audioAssetId, savedTrack.audioAssetId);
  assert.equal(trashed.tracks[0].story, savedTrack.story);
  assert.equal(trashed.videos[0].youtubeUrl, savedVideo.youtubeUrl);
  assert.equal((await request('/api/tracks/admin-save-live')).status, 404);
  assert.equal((await request('/api/tracks/admin-save-live?preview=true', { cookie })).status, 404);
  assert.equal((await request('/api/admin/track-title?title=Admin%20save%20live', { cookie })).status, 409);
  assert.equal((await request('/api/tracks/admin-save-live', { method: 'PUT', cookie, body: { published: true } })).status, 404);

  const trackRestore = '/api/admin/trash/tracks/admin-save-live/restore';
  const videoRestore = '/api/admin/trash/videos/000000000000000000000003/restore';
  assert.equal((await request(trackRestore, { method: 'POST', body: {} })).status, 401);
  await setControls({ failMutationGeneration: 2 });
  assert.equal((await request(trackRestore, { method: 'POST', cookie, body: {} })).status, 503);
  assert.equal((await (await request('/api/admin/trash', { cookie })).json()).tracks.length, 1, 'Failed restore must keep the recoverable record');
  for (const route of [trackRestore, videoRestore]) {
    const response = await request(route, { method: 'POST', cookie, body: {} });
    assert.equal(response.status, 200);
    const restored = await response.json();
    assert.equal(restored.published, false, 'Restoring never automatically republishes an item');
    assert.equal(restored.deletedAt, null);
    assert.equal(restored.deletedBy, null);
  }
  const restoredTracks = await (await request('/api/tracks?all=true', { cookie })).json();
  assert.equal(restoredTracks.find((track) => track.slug === savedTrack.slug).audioAssetId, savedTrack.audioAssetId);
  for (const [route, revision] of [
    ['/api/tracks/admin-save-live', savedTrack.updatedAt],
    ['/api/videos/000000000000000000000003', savedVideo.updatedAt],
  ]) {
    assert.equal((await request(route, { method: 'PUT', cookie, body: { published: true, expectedUpdatedAt: revision, ...(route.includes('/tracks/') ? { reviewedPlaybackMode: 'preview' } : {}) } })).status, 409,
      'A stale form saved after trash/restore must not silently republish the recovered draft');
  }
  assert.deepEqual(await (await request('/api/admin/trash', { cookie })).json(), { tracks: [], videos: [] });
  const review = await (await request('/api/admin/publishing/tracks/admin-save-live', { cookie })).json();
  assert.equal(review.canPublish, true);
  assert.equal((await request('/api/tracks/admin-save-live', { method: 'PUT', cookie, body: { published: true, expectedUpdatedAt: review.expectedUpdatedAt, reviewedPlaybackMode: review.playbackMode } })).status, 200);
  assert.equal((await (await request(trackRestore, { method: 'POST', cookie, body: {} })).json()).published, true, 'Replaying restore cannot unpublish an already active item');
  await setControls({ resetGeneration: 2 });
  assert.equal((await (await request('/api/tracks?all=true', { cookie })).json()).length, 2);
  console.log('PASS authenticated trash, preserved media/metadata, hidden active/public records, safe retry and restore-as-draft through real HTTP.');
}

async function publishingSmoke(cookie) {
  const trackRoute = '/api/tracks/admin-save-live';
  const videoRoute = '/api/videos/000000000000000000000003';
  const reviewRoute = '/api/admin/publishing/tracks/admin-save-live';
  assert.equal((await request(reviewRoute)).status, 401);
  for (const route of [trackRoute, videoRoute]) assert.equal((await request(route, { method: 'PUT', cookie, body: { published: false } })).status, 200);
  const publishBody = (review) => ({ published: true, expectedUpdatedAt: review.expectedUpdatedAt, reviewedPlaybackMode: review.playbackMode });
  let review = await (await request(reviewRoute, { cookie })).json();
  assert.equal(review.canPublish, true);
  assert.equal(review.playbackMode, 'preview');
  assert.equal(review.audio.previewDuration, 45);
  assert.equal('originalPath' in review.audio, false);
  assert.equal('previewPath' in review.audio, false);
  assert.ok(review.checks.some((check) => check.status === 'warning'), 'Missing artwork must remain a review warning');
  assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: { published: true } })).status, 422);
  assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: { ...publishBody(review), mood: 'Mixed unchecked metadata' } })).status, 422);
  for (const audioStatus of ['missing', 'processing', 'failed']) {
    await setControls({ audioStatus });
    const blocked = await (await request(reviewRoute, { cookie })).json();
    assert.equal(blocked.canPublish, false, `${audioStatus} audio cannot be published`);
    assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: publishBody(blocked) })).status, 422);
  }
  await setControls({ audioStatus: 'ready', previewDuration: 0 });
  assert.equal((await (await request(reviewRoute, { cookie })).json()).canPublish, false);
  await setControls({ previewDuration: 45 });
  assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: { mood: 'Updated after review' } })).status, 200);
  assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: publishBody(review) })).status, 409);
  review = await (await request(reviewRoute, { cookie })).json();
  await setControls({ failMutationGeneration: 3 });
  assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: publishBody(review) })).status, 500);
  assert.equal((await (await request(reviewRoute, { cookie })).json()).track.published, false);
  assert.equal((await request(trackRoute, { method: 'PUT', cookie, body: publishBody(review) })).status, 200);
  assert.equal((await (await request('/api/tracks/admin-save-live')).json()).published, true);
  const videoReview = await (await request('/api/admin/publishing/videos/000000000000000000000003', { cookie })).json();
  assert.equal(videoReview.canPublish, true);
  assert.equal((await request(videoRoute, { method: 'PUT', cookie, body: { published: true, expectedUpdatedAt: videoReview.expectedUpdatedAt } })).status, 200);
  const videoInput = { title: 'New video draft', youtubeUrl: 'https://www.youtube.com/watch?v=LOCAL000002', youtubeId: 'LOCAL000002' };
  assert.equal((await request('/api/videos', { method: 'POST', cookie, body: { ...videoInput, published: true } })).status, 422);
  const newVideo = await request('/api/videos', { method: 'POST', cookie, body: videoInput });
  assert.equal(newVideo.status, 201);
  assert.equal((await newVideo.json()).published, false);
  assert.equal((await request('/api/tracks', { method: 'POST', cookie, body: { slug: 'new-draft-check', title: 'New draft check', artist: 'Fixture', number: 3, published: true } })).status, 422);
  await setControls({ resetGeneration: 3, audioStatus: null, previewDuration: 45 });
  console.log('PASS saved publishing review, draft-only creation, managed-audio readiness, mode/revision confirmation, failed publication retry and explicit track/video publication through real HTTP.');
}

async function smoke() {
  const login = await request('/api/auth/sign-in/username', { method: 'POST', body: { username: 'Dustin', password } });
  assert.equal(login.status, 200);
  let cookie = login.headers.getSetCookie().find((value) => value.includes('monstajam_auth.session_token='))?.split(';')[0];
  assert.ok(cookie);
  const list = await request('/api/tracks?all=true', { cookie });
  assert.equal((await list.json()).length, 2);
  const asset = await request('/api/audio-assets/000000000000000000000004', { cookie });
  assert.equal(asset.status, 200);
  assert.equal((await asset.json()).previewStart, 12.5);
  const titlePath = '/api/admin/track-title?title=Brand%20new%20fixture%20title';
  assert.equal((await request(titlePath)).status, 401, 'Title lookup must require a named admin session');
  const availableTitle = await request(titlePath, { cookie });
  assert.equal(availableTitle.status, 200);
  assert.deepEqual(await availableTitle.json(), { available: true, slug: 'brand-new-fixture-title' });
  for (const title of ['ADMIN save LIVE!!', 'Admin save draft']) {
    const collision = await request('/api/admin/track-title?title=' + encodeURIComponent(title), { cookie });
    assert.equal(collision.status, 409, 'Published and draft URLs must both reserve their title-derived slug');
    assert.ok((await collision.json()).details.title[0]);
  }
  await setControls({ failReadGeneration: 1 });
  assert.equal((await request(titlePath, { cookie })).status, 503, 'Unavailable storage must never promise a free title');
  assert.equal((await request(titlePath, { cookie })).status, 200, 'A failed title lookup must be retryable');
  await setControls({ failTrackReads: true });
  assert.equal((await request('/api/tracks?all=true', { cookie })).status, 500);
  assert.equal((await request('/api/tracks?all=true', { cookie })).status, 500, 'Track failure must remain until explicitly restored');
  assert.equal((await request('/api/videos?all=true', { cookie })).status, 200);
  await setControls({ failTrackReads: false, failVideoReads: true });
  assert.equal((await request('/api/tracks?all=true', { cookie })).status, 200);
  assert.equal((await request('/api/videos?all=true', { cookie })).status, 500);
  assert.equal((await request('/api/videos?all=true', { cookie })).status, 500, 'Video failure must remain until explicitly restored');
  await setControls({ failVideoReads: false });
  let save = await request('/api/tracks/admin-save-live', { method: 'PUT', cookie, body: { mood: 'Fixture read-after-write success' } });
  assert.equal(save.status, 200);
  let read = await request('/api/tracks/admin-save-live', { cookie });
  assert.equal((await read.json()).mood, 'Fixture read-after-write success');

  await setControls({ failMutationGeneration: 1 });
  save = await request('/api/tracks/admin-save-live', { method: 'PUT', cookie, body: { mood: 'Failure retry succeeded' } });
  assert.equal(save.status, 500);
  read = await request('/api/tracks/admin-save-live', { cookie });
  assert.equal((await read.json()).mood, 'Fixture read-after-write success');
  save = await request('/api/tracks/admin-save-live', { method: 'PUT', cookie, body: { mood: 'Failure retry succeeded' } });
  assert.equal(save.status, 200);

  await setControls({ delayMs: 800 });
  const started = Date.now();
  save = await request('/api/videos/000000000000000000000003', { method: 'PUT', cookie, body: { duration: '4:00' } });
  assert.equal(save.status, 200);
  assert.ok(Date.now() - started >= 750, 'Fixture save delay did not apply');
  const videos = await request('/api/videos?all=true', { cookie });
  assert.equal((await videos.json())[0].duration, '4:00');

  await setControls({ delayMs: 0, expireSession: true });
  save = await request('/api/tracks/admin-save-live', { method: 'PUT', cookie, body: { mood: 'Must not persist' } });
  assert.equal(save.status, 401);
  const expiredSession = await request('/api/auth/get-session', { cookie });
  assert.equal(expiredSession.status, 200);
  assert.equal(await expiredSession.json(), null, 'Expired fixture must revoke the real backing session');
  await setControls({ expireSession: false, resetGeneration: 1 });
  const relogin = await request('/api/auth/sign-in/username', { method: 'POST', body: { username: 'Dustin', password } });
  assert.equal(relogin.status, 200);
  cookie = relogin.headers.getSetCookie().find((value) => value.includes('monstajam_auth.session_token='))?.split(';')[0];
  assert.ok(cookie, 'Revoked fixture sessions must be replaced through a fresh sign-in');
  const restoredSession = await request('/api/auth/get-session', { cookie });
  assert.equal(restoredSession.status, 200);
  assert.equal((await restoredSession.json()).user.username, 'dustin');
  read = await request('/api/tracks/admin-save-live', { cookie });
  assert.equal((await read.json()).mood, 'Original fixture mood');
  await trashSmoke(cookie);
  await publishingSmoke(cookie);
  console.log('PASS normal login, title availability/conflict/retry, actual API read-after-write, failed-save retention/retry, delay, session expiry 401, and fixture reset.');
}

async function main() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`${base} is already in use; refusing to reuse an unknown server.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'monstajam-admin-save-'));
  controlPath = path.join(temporaryDirectory, 'control.json');
  await setControls({});
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/ADMIN_SECRET|DATABASE_URL|BLOB.*TOKEN|AUDIO.*TOKEN|SUPABASE|BETTER_AUTH|AUTH_SECRET|^NODE_OPTIONS$|^NODE_ENV$/.test(key)) delete env[key];
  Object.assign(env, {
    NODE_ENV: production ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
    BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
    MONSTAJAM_NAMED_AUTH_FIXTURES: '1', MONSTAJAM_NAMED_AUTH_CONTROL: controlPath,
    MONSTAJAM_NAMED_AUTH_PASSWORD: password, MONSTAJAM_NAMED_CONTENT_FIXTURE: 'admin-save',
    BLOB_READ_WRITE_TOKEN: 'disabled-local-admin-save-fixture',
    AUDIO_READ_WRITE_TOKEN: 'disabled-local-admin-save-fixture',
    DATABASE_URL: 'mongodb://127.0.0.1:27019/monstajam_admin_save_test?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000',
    MONSTAJAM_ADMIN_SAVE_FIXTURES: '1', MONSTAJAM_ADMIN_SAVE_CONTROL: controlPath,
    MONSTAJAM_ADMIN_SAVE_PRODUCTION: production ? '1' : '0',
    NODE_OPTIONS: `--require="${path.join(__dirname, 'fixtures/named-auth.cjs').replaceAll('\\', '/')}"`,
  });
  child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...(production ? ['start'] : ['dev', '--webpack']), '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (data) => { serverLog = (serverLog + data.toString()).slice(-20000); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Next fixture server exited.\n' + serverLog);
    try {
      const response = await request('/api/auth/login', { method: 'POST', body: { password: 'wrong-fixture-password' } });
      if (response.status === 401) { ready = true; break; }
    } catch { /* Startup or compilation is pending. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Next fixture server startup timed out.\n' + serverLog);
  await smoke();
  if (smokeOnly) { stop(); return; }
  const credentialsPath = path.join(temporaryDirectory, 'browser.json');
  await fs.writeFile(credentialsPath, JSON.stringify({ url: origin + '/upload/login', username: 'Dustin', password }));
  console.log(`Dashboard fixture ready: ${origin}/upload/login`);
  console.log('Local fixture username: Dustin');
  console.log(`Local fixture credentials: ${credentialsPath}`);
  console.log(`Control file: ${controlPath}`);
  console.log(`Next PID: ${child.pid}`);
  console.log('Use failMutationGeneration: 4 for the next failure (1, 2 and 3 were consumed by startup smoke).');
  console.log('Use failTrackReads/failVideoReads: true for persistent independent load errors; set false to recover. expireSession: true revokes the real local sessions; set false then sign in again.');
  console.log('All database writes stay in process memory. No upload credentials are configured. Ctrl+C stops the server.');
  console.log('Fixture Live Track has a ready managed asset at 12.5 seconds; Fixture Draft Track uses the legacy Full Songs fallback. Actual audio streaming/conversion is not provided by this UI fixture.');
  await new Promise((resolve) => child.once('exit', resolve));
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
main().catch((error) => { console.error(error); console.error(serverLog); stop(); process.exitCode = 1; });
