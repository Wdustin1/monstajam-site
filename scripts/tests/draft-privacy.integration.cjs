/* Run with node scripts/tests/draft-privacy.integration.cjs [--keep-alive] [--production].
 * Uses real Next HTTP routing and login with read-only, local Prisma fixtures.
 * It never connects to a database or uses an existing admin password.
 */
'use strict';

/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CJS runner, matching the Node --require fixture. */

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const port = 3310;
const base = `http://127.0.0.1:${port}`;
const password = `local-privacy-${randomUUID()}`;
const keepAlive = process.argv.includes('--keep-alive');
const production = process.argv.includes('--production');
const origin = `${production ? 'https' : 'http'}://localhost:${port}`;
const privateMarkers = ['PRIVATE_FIXTURE_TITLE_9d2a', 'PRIVATE_FIXTURE_STORY_7e3b', 'private-fixture-a8f4.mp3', 'private-fixture-cover-6c8a'];
let child;
let serverLog = '';
let stopping = false;

async function assertPortFree() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`${base} is already in use; refusing to test an unknown server.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function stop() {
  if (!child || stopping) return;
  stopping = true;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

async function request(route, options = {}) {
  const fetchOptions = {
    redirect: 'manual', ...options,
    headers: { ...(production ? { 'X-Forwarded-Proto': 'https' } : {}), ...(options.method === 'POST' ? { Origin: origin } : {}), ...options.headers },
    signal: AbortSignal.timeout(60000),
  };
  let response = await fetch(base + route, fetchOptions);
  if (options.headers?.RSC === '1' && response.status === 307 && response.headers.has('location')) {
    const corrected = new URL(response.headers.get('location'), origin);
    const original = new URL(route, origin);
    if (corrected.origin === origin && corrected.pathname === original.pathname && corrected.searchParams.has('_rsc')) {
      await response.body?.cancel();
      response = await fetch(base + corrected.pathname + corrected.search, fetchOptions);
    }
  }
  return response;
}

async function assertLoginRedirect(response, context) {
  const body = await response.text();
  if ([302, 303, 307, 308].includes(response.status)) {
    assert.equal(new URL(response.headers.get('location'), origin).pathname, '/upload/login');
  } else {
    assert.equal(response.status, 200, `${context} returned unexpected status`);
    assert.match(body, /NEXT_REDIRECT[^\n]*\/upload\/login/, `${context} must serialize the login redirect`);
  }
  assertPrivateAbsent(body, context);
}

function assertPrivateAbsent(body, context) {
  for (const marker of privateMarkers) assert.ok(!body.includes(marker), `${context} leaked ${marker}`);
}

async function assertNotFound(response, context) {
  // Next returns 200 once loading.tsx has started streaming a not-found page.
  // Check the actual not-found payload as well as the allowed HTTP statuses.
  assert.ok([200, 404].includes(response.status), `${context} returned unexpected status ${response.status}`);
  const body = await response.text();
  assert.match(body, /NEXT_HTTP_ERROR_FALLBACK;404/, `${context} must trigger the Next not-found boundary`);
  assertPrivateAbsent(body, context);
}

async function waitUntilReady() {
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`Next exited with ${child.exitCode}\n${serverLog}`);
    try {
      const result = await request('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'intentionally-wrong' }),
      });
      if (result.status === 401) return;
    } catch { /* Wait for the local process to start compiling. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local Next server did not become ready.\n' + serverLog);
}

async function runChecks() {
  const published = await request('/tracks/privacy-public-track', { headers: { 'User-Agent': 'Googlebot' } });
  assert.equal(published.status, 200, 'Published detail page must load');
  const publishedBody = await published.text();
  assert.match(publishedBody, /<title>PUBLIC_FIXTURE_TITLE/);
  assert.match(publishedBody, /PUBLIC_FIXTURE_STORY/);
  assertPrivateAbsent(publishedBody, 'Published page and its serialized player queue');
  const publishedRsc = await request('/tracks/privacy-public-track?_rsc=public-test', { headers: { RSC: '1' } });
  assert.equal(publishedRsc.status, 200);
  assert.match(publishedRsc.headers.get('content-type') || '', /text\/x-component/);
  const publishedRscBody = await publishedRsc.text();
  assert.match(publishedRscBody, /PUBLIC_FIXTURE_TITLE/);
  assertPrivateAbsent(publishedRscBody, 'Published React Server Component payload');
  console.log('PASS published page and metadata');

  const draft = await request('/tracks/privacy-draft-track', { headers: { 'User-Agent': 'Googlebot' } });
  await assertNotFound(draft, 'Public draft HTML and metadata');
  const browserDraft = await request('/tracks/privacy-draft-track');
  await assertNotFound(browserDraft, 'Streamed browser draft HTML');
  const rscDraft = await request('/tracks/privacy-draft-track?_rsc=privacy-test', { headers: { RSC: '1' } });
  assert.match(rscDraft.headers.get('content-type') || '', /text\/x-component/);
  assertPrivateAbsent(await rscDraft.text(), 'Public draft React Server Component payload');
  const prefetchDraft = await request('/tracks/privacy-draft-track?_rsc=prefetch-test', {
    headers: { RSC: '1', 'Next-Router-Prefetch': '1', 'Next-Url': '/' },
  });
  assertPrivateAbsent(await prefetchDraft.text(), 'Public draft RSC prefetch payload');
  console.log('PASS public draft HTML, metadata, and RSC privacy');

  const home = await request('/');
  assert.equal(home.status, 200);
  const homeBody = await home.text();
  assert.match(homeBody, /PUBLIC_FIXTURE_TITLE/);
  assertPrivateAbsent(homeBody, 'Public home listing');
  const listing = await request('/api/tracks');
  assert.equal(listing.status, 200);
  const tracks = await listing.json();
  assert.deepEqual(tracks.map((track) => track.slug), ['privacy-public-track']);
  console.log('PASS public page and API listings exclude draft');

  const previewPath = '/upload/preview/privacy-draft-track';
  for (const [description, headers] of [['signed out', {}], ['invalid cookie', { Cookie: 'admin_session=intentionally-wrong' }]]) {
    const result = await request(previewPath, { headers });
    await assertLoginRedirect(result, `${description} preview`);
  }
  console.log('PASS signed-out and invalid-cookie preview access');

  const login = await request('/api/auth/sign-in/username', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Dustin', password }),
  });
  assert.equal(login.status, 200, 'Normal login must accept the generated test password');
  const cookie = login.headers.getSetCookie().find((value) => value.includes('monstajam_auth.session_token='))?.split(';')[0];
  assert.ok(cookie, 'Login must issue an admin session cookie');
  const preview = await request(previewPath, { headers: { Cookie: cookie, 'User-Agent': 'Googlebot' } });
  assert.equal(preview.status, 200, 'Authenticated draft preview must load');
  const previewBody = await preview.text();
  for (const marker of privateMarkers) assert.ok(previewBody.includes(marker), `Preview is missing fixture field ${marker}`);
  assert.match(previewBody, /<meta\s+name="robots"\s+content="[^"]*noindex/);
  const previewRsc = await request(previewPath + '?_rsc=authorized-preview', { headers: { RSC: '1', Cookie: cookie } });
  assert.equal(previewRsc.status, 200);
  assert.match(previewRsc.headers.get('content-type') || '', /text\/x-component/);
  const previewRscBody = await previewRsc.text();
  for (const marker of privateMarkers) assert.ok(previewRscBody.includes(marker), `Preview RSC is missing ${marker}`);
  const previewCaching = preview.headers.get('cache-control') || '';
  // Next dev emits no-cache/must-revalidate. Require stronger private/no-store
  // headers from the compiled production server as well as request isolation.
  if (production) {
    assert.match(previewCaching, /private/);
    assert.match(previewCaching, /no-store/);
  } else assert.match(previewCaching, /(?:private|no-store|no-cache)/);
  console.log(`PASS authenticated preview content, noindex, and ${production ? 'production private/no-store caching' : 'development cache revalidation'}`);
  console.log(`Preview Cache-Control: ${previewCaching}`);

  const adminListing = await request('/api/tracks?all=true', { headers: { Cookie: cookie } });
  assert.equal(adminListing.status, 200);
  assert.deepEqual((await adminListing.json()).map((track) => track.slug), ['privacy-public-track', 'privacy-draft-track']);
  const signedOutListing = await request('/api/tracks?all=true');
  assert.equal(signedOutListing.status, 401);
  const signedOutTracks = await signedOutListing.json();
  assertPrivateAbsent(JSON.stringify(signedOutTracks), 'Signed-out admin listing after authenticated request');
  const publicListingAfterAdmin = await request('/api/tracks');
  assert.equal(publicListingAfterAdmin.status, 200);
  assert.deepEqual((await publicListingAfterAdmin.json()).map((track) => track.slug), ['privacy-public-track']);
  console.log('PASS authenticated/admin/public listing request isolation');

  const authenticatedPublic = await request('/tracks/privacy-draft-track', { headers: { Cookie: cookie, 'User-Agent': 'Googlebot' } });
  await assertNotFound(authenticatedPublic, 'Authenticated public draft route');
  const afterPreview = await request(previewPath);
  await assertLoginRedirect(afterPreview, 'Signed-out preview after authenticated render');
  const afterRsc = await request(previewPath + '?_rsc=after-auth', { headers: { RSC: '1' } });
  assertPrivateAbsent(await afterRsc.text(), 'Signed-out preview RSC after authenticated render');
  const afterPrefetch = await request(previewPath + '?_rsc=prefetch-after-auth', {
    headers: { RSC: '1', 'Next-Router-Prefetch': '1', 'Next-Url': '/upload' },
  });
  assertPrivateAbsent(await afterPrefetch.text(), 'Signed-out preview RSC prefetch after authenticated render');
  console.log('PASS subsequent public and signed-out requests remain private');
}

async function main() {
  await assertPortFree();
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'monstajam-draft-privacy-'));
  const controlPath = path.join(temporaryDirectory, 'control.json');
  await fs.writeFile(controlPath, '{}');
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/ADMIN_SECRET|DATABASE_URL|BLOB.*TOKEN|AUDIO.*TOKEN|SUPABASE|BETTER_AUTH|AUTH_SECRET|^NODE_OPTIONS$|^NODE_ENV$/.test(key)) delete env[key];
  }
  Object.assign(env, {
    NODE_ENV: production ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
    MONSTAJAM_LOCAL_PRIVACY_FIXTURES: '1',
    MONSTAJAM_NAMED_AUTH_FIXTURES: '1', MONSTAJAM_NAMED_AUTH_CONTROL: controlPath,
    MONSTAJAM_NAMED_AUTH_PASSWORD: password, BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
    MONSTAJAM_LOCAL_PRIVACY_PRODUCTION: production ? '1' : '0',
    BLOB_READ_WRITE_TOKEN: 'disabled-local-privacy-test',
    DATABASE_URL: 'mongodb://127.0.0.1:27019/monstajam_privacy_test?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000',
    NODE_OPTIONS: `--require="${path.join(__dirname, 'fixtures/named-auth.cjs').replaceAll('\\', '/')}"`,
  });
  const command = production ? ['start'] : ['dev', '--webpack'];
  child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...command, '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (data) => { serverLog = (serverLog + data.toString()).slice(-20000); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  await waitUntilReady();
  console.log(`Local ${production ? 'production' : 'development'} privacy fixture server ready: ${base} (Next PID ${child.pid})`);
  await runChecks();
  console.log('Draft privacy HTTP integration passed.');
  if (keepAlive) {
    console.log(`Server retained for browser smoke. URL: ${origin}/upload/login`);
    console.log('Local fixture username: Dustin');
    console.log(`Generated local-only password: ${password}`);
    console.log('All database writes are blocked by the fixture. Press Ctrl+C to stop.');
    await new Promise((resolve) => child.once('exit', resolve));
  } else stop();
}

process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });
main().catch((error) => { console.error(error); console.error(serverLog); stop(); process.exitCode = 1; });
