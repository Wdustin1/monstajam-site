/* node scripts/tests/named-auth.integration.cjs [--development] [--keep-alive]
 * Exercises compiled Next by default, behind a simulated local TLS terminator.
 * Only fixture users/sessions and read-only content exist in this child process.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test runner. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const production = !process.argv.includes('--development');
const keepAlive = process.argv.includes('--keep-alive');
const port = 3312;
const transport = `http://127.0.0.1:${port}`;
const origin = `${production ? 'https' : 'http'}://localhost:${port}`;
const password = `fixture-${randomUUID()}`;
const privateMarkers = ['PRIVATE_FIXTURE_TITLE_9d2a', 'PRIVATE_FIXTURE_STORY_7e3b', 'private-fixture-a8f4.mp3'];
let child;
let log = '';
let stopping = false;
let controls = {};
let directory;
let controlPath;

async function setControls(next) {
  controls = { ...controls, ...next };
  await fs.writeFile(controlPath, JSON.stringify(controls));
}
function stop() {
  if (!child || stopping) return;
  stopping = true;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
}
async function request(route, { cookie, body, ...options } = {}) {
  const headers = {
    ...(production ? { 'X-Forwarded-Proto': 'https' } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
    ...options.headers,
  };
  const fetchOptions = {
    ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(60_000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  let response = await fetch(transport + route, fetchOptions);
  // Patched Next canonicalizes an RSC cache key that does not match its request
  // headers. Follow only that same-route repair, never an authentication redirect.
  if (headers.RSC === '1' && response.status === 307 && response.headers.has('location')) {
    const corrected = new URL(response.headers.get('location'), origin);
    const original = new URL(route, origin);
    if (corrected.origin === origin && corrected.pathname === original.pathname && corrected.searchParams.has('_rsc')) {
      await response.body?.cancel();
      response = await fetch(transport + corrected.pathname + corrected.search, fetchOptions);
    }
  }
  return response;
}
function assertPrivateAbsent(text, description) {
  for (const marker of privateMarkers) assert.ok(!text.includes(marker), `${description} leaked ${marker}`);
}
function assertHiddenAliasesAbsent(body, label) {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  assert.ok(!serialized.includes('@accounts.monstajam.invalid'), label + ' leaked an internal account alias');
  if (typeof body !== 'string') assert.doesNotMatch(serialized, /"(?:email|emailVerified|token|resetNonce|credentialLockVersion)"\s*:/);
}
function assertNoStore(response) { assert.match(response.headers.get('cache-control') || '', /no-store/); }
async function login(username) {
  const response = await request('/api/auth/sign-in/username', { method: 'POST', body: { username, password } });
  assert.equal(response.status, 200, `Login failed for local fixture ${username}`);
  assertNoStore(response);
  const body = await response.json();
  assert.equal(body.user.username, username.trim().toLowerCase());
  assertHiddenAliasesAbsent(body, 'Sign-in response');
  const setCookies = response.headers.getSetCookie();
  const session = setCookies.find((value) => value.includes('monstajam_auth.session_token='));
  assert.ok(session, 'Named login must issue the real signed session cookie');
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=Lax/i);
  if (production) assert.match(session, /Secure/i);
  return session.split(';')[0];
}
async function assertDenied(cookie, label) {
  const list = await request('/api/tracks?all=true', { cookie });
  assert.equal(list.status, 401);
  assertPrivateAbsent(JSON.stringify(await list.json()), label + ' API listing');
  const save = await request('/api/tracks/privacy-public-track', { method: 'PUT', cookie, body: { mood: 'Unauthorized fixture write' } });
  assert.equal(save.status, 401, `${label} must be rejected before any content mutation`);
  for (const route of ['/upload', '/upload/preview/privacy-draft-track']) {
    const page = await request(route, { cookie, headers: { 'User-Agent': 'Googlebot' } });
    const body = await page.text();
    if ([302, 303, 307, 308].includes(page.status)) {
      assert.equal(new URL(page.headers.get('location'), origin).pathname, '/upload/login');
    } else {
      assert.equal(page.status, 200, `${label} ${route} returned an unexpected status`);
      assert.match(body, /NEXT_REDIRECT[^\n]*\/upload\/login/, `${label} streamed HTML must contain the server login redirect`);
      assert.ok(!body.includes('currentAdmin'), 'Denied HTML must not serialize dashboard identity/props');
    }
    assertPrivateAbsent(body, label + ' HTML');
  }
  const rsc = await request('/upload/preview/privacy-draft-track?_rsc=fixture', { cookie, headers: { RSC: '1', 'Next-Router-Prefetch': '1' } });
  assertPrivateAbsent(await rsc.text(), label + ' prefetched RSC');
}
async function checks() {
  await assertDenied(undefined, 'Signed out');
  await assertDenied('admin_session=old-shared-cookie', 'Legacy cookie');
  const oldLogin = await request('/api/auth/login', { method: 'POST', body: { password } });
  assert.equal(oldLogin.status, 401);
  assert.equal(oldLogin.headers.has('set-cookie'), false);
  for (const endpoint of ['/sign-in/email', '/sign-up/email', '/is-username-available', '/request-password-reset', '/admin/create-user', '/admin/set-role', '/admin/impersonate-user']) {
    const response = await request('/api/auth' + endpoint, { method: 'POST', body: {} });
    assert.ok([403, 404].includes(response.status), `${endpoint} must be unavailable over HTTP, got ${response.status}`);
  }
  const crossOrigin = await request('/api/auth/sign-in/username', { method: 'POST', body: { username: 'Dustin', password }, headers: { Origin: 'https://untrusted.invalid' } });
  assert.equal(crossOrigin.status, 403);
  const pending = await request('/api/auth/sign-in/username', { method: 'POST', body: { username: 'pending', password } });
  assert.equal(pending.status, 401);
  console.log('PASS signup/admin endpoint closure, origin enforcement, inactive account and obsolete login rejection');

  const ownerCookie = await login('DuStIn');
  const adminCookie = await login('ADMIN');
  const session = await request('/api/auth/get-session', { cookie: ownerCookie });
  assertNoStore(session);
  assertHiddenAliasesAbsent(await session.json(), 'Session response');
  const listing = await request('/api/tracks?all=true', { cookie: adminCookie });
  assertNoStore(listing);
  assert.equal((await listing.json()).length, 2);
  const preview = await request('/upload/preview/privacy-draft-track', { cookie: adminCookie, headers: { 'User-Agent': 'Googlebot' } });
  assert.equal(preview.status, 200);
  if (production) assertNoStore(preview);
  const previewBody = await preview.text();
  assertHiddenAliasesAbsent(previewBody, 'Authenticated page');
  assert.match(previewBody, /PRIVATE_FIXTURE_TITLE_9d2a/);
  assert.match(previewBody, /name="robots"[^>]*noindex/);
  const previewRSC = await request('/upload/preview/privacy-draft-track?_rsc=fixture-auth', { cookie: adminCookie, headers: { RSC: '1' } });
  assert.equal(previewRSC.status, 200, `Authenticated RSC: ${previewRSC.status} ${previewRSC.headers.get('location')}`);
  assert.match(await previewRSC.text(), /PRIVATE_FIXTURE_TITLE_9d2a/);
  const publicDraft = await request('/tracks/privacy-draft-track', { cookie: ownerCookie, headers: { 'User-Agent': 'Googlebot' } });
  assertPrivateAbsent(await publicDraft.text(), 'Authenticated public draft route');
  await assertDenied(undefined, 'Signed out after authenticated render');
  console.log('PASS named sessions, draft HTML/RSC/noindex/no-store, and request/cache isolation');

  await setControls({ users: { admin: { accessStatus: 'removed' } } });
  await assertDenied(adminCookie, 'Removed admin with unchanged signed cookie');
  await setControls({ users: { admin: { accessStatus: 'active' } }, revokeGeneration: 1, revokeUsername: 'admin' });
  await assertDenied(adminCookie, 'Revoked backing session');
  const ownerStillValid = await request('/api/tracks?all=true', { cookie: ownerCookie });
  assert.equal((await ownerStillValid.json()).length, 2, 'Removing one admin must preserve the owner session');
  const logout = await request('/api/auth/logout', { method: 'POST', cookie: ownerCookie, body: {} });
  assert.equal(logout.status, 200);
  assertNoStore(logout);
  await assertDenied(ownerCookie, 'Logged-out signed cookie replay');
  console.log('PASS immediate access removal, database session revocation, owner isolation and logout replay rejection');
}
async function main() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('Port 3312 is in use; refusing to test an unknown server.')));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'monstajam-named-auth-'));
  controlPath = path.join(directory, 'control.json');
  await setControls({});
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/ADMIN_SECRET|DATABASE_URL|BLOB.*TOKEN|AUDIO.*TOKEN|SUPABASE|BETTER_AUTH|AUTH_SECRET|^NODE_OPTIONS$|^NODE_ENV$/.test(key)) delete env[key];
  Object.assign(env, {
    NODE_ENV: production ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
    MONSTAJAM_LOCAL_PRIVACY_FIXTURES: '1', MONSTAJAM_LOCAL_PRIVACY_PRODUCTION: production ? '1' : '0',
    MONSTAJAM_NAMED_AUTH_FIXTURES: '1', MONSTAJAM_NAMED_AUTH_CONTROL: controlPath,
    MONSTAJAM_NAMED_AUTH_PASSWORD: password, BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
    DATABASE_URL: 'mongodb://127.0.0.1:27019/monstajam_privacy_test?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000',
    BLOB_READ_WRITE_TOKEN: 'disabled-local-fixture', AUDIO_READ_WRITE_TOKEN: 'disabled-local-fixture',
    NODE_OPTIONS: `--require="${path.join(__dirname, 'fixtures/named-auth.cjs').replaceAll('\\', '/')}"`,
  });
  child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...(production ? ['start'] : ['dev', '--webpack']), '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (chunk) => { log = (log + chunk.toString()).slice(-16_000); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Fixture server exited: ${child.exitCode}`);
    try { const response = await request('/api/auth/login', { method: 'POST', body: {} }); if (response.status === 401) { ready = true; break; } } catch { /* Wait for this fixture's local server. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Fixture server did not become ready');
  await checks();
  console.log(`Named-auth ${production ? 'compiled-production' : 'development'} HTTP integration passed.`);
  if (keepAlive) {
    console.log(`Local HTTP fixture retained at ${transport}; browser mode uses --development. Credentials in ${path.join(directory, 'browser.json')}`);
    await fs.writeFile(path.join(directory, 'browser.json'), JSON.stringify({ url: origin, username: 'Dustin', password }));
    await new Promise((resolve) => child.once('exit', resolve));
  } else stop();
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
main().catch((error) => { console.error(error); console.error(log); stop(); process.exitCode = 1; });
