/* Start the real local dashboard/API against memory-only records:
 * node scripts/tests/admin-save.fixture.cjs
 * The generated control.json path supports delayMs (0-10000),
 * failMutationGeneration/failReadGeneration (increment to fail once),
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
const origin = `http://localhost:${port}`;
const password = `local-admin-save-${randomUUID()}`;
const smokeOnly = process.argv.includes('--smoke-only');
let child;
let stopping = false;
let serverLog = '';
let controlPath;
let state = { delayMs: 0, failMutationGeneration: 0, failReadGeneration: 0, expireSession: false, resetGeneration: 0 };

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
  const headers = { ...options.headers, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}) };
  return fetch(base + route, { redirect: 'manual', ...options, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
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
  await setControls({ expireSession: false, resetGeneration: 1 });
  const relogin = await request('/api/auth/sign-in/username', { method: 'POST', body: { username: 'Dustin', password } });
  assert.equal(relogin.status, 200);
  cookie = relogin.headers.getSetCookie().find((value) => value.includes('monstajam_auth.session_token='))?.split(';')[0];
  assert.ok(cookie, 'Revoked fixture sessions must be replaced through a fresh sign-in');
  read = await request('/api/tracks/admin-save-live', { cookie });
  assert.equal((await read.json()).mood, 'Original fixture mood');
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
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
    MONSTAJAM_NAMED_AUTH_FIXTURES: '1', MONSTAJAM_NAMED_AUTH_CONTROL: controlPath,
    MONSTAJAM_NAMED_AUTH_PASSWORD: password, MONSTAJAM_NAMED_CONTENT_FIXTURE: 'admin-save',
    BLOB_READ_WRITE_TOKEN: 'disabled-local-admin-save-fixture',
    AUDIO_READ_WRITE_TOKEN: 'disabled-local-admin-save-fixture',
    DATABASE_URL: 'mongodb://127.0.0.1:27019/monstajam_admin_save_test?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000',
    MONSTAJAM_ADMIN_SAVE_FIXTURES: '1', MONSTAJAM_ADMIN_SAVE_CONTROL: controlPath,
    NODE_OPTIONS: `--require="${path.join(__dirname, 'fixtures/named-auth.cjs').replaceAll('\\', '/')}"`,
  });
  child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
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
  console.log('Use failMutationGeneration: 2 for the next failure (1 was consumed by startup smoke).');
  console.log('All database writes stay in process memory. No upload credentials are configured. Ctrl+C stops the server.');
  console.log('Fixture Live Track has a ready managed asset at 12.5 seconds; Fixture Draft Track uses the legacy Full Songs fallback. Actual audio streaming/conversion is not provided by this UI fixture.');
  await new Promise((resolve) => child.once('exit', resolve));
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
main().catch((error) => { console.error(error); console.error(serverLog); stop(); process.exitCode = 1; });
