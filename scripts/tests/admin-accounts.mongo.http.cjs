/* Run after starting admin-accounts.mongo.fixture.ts:
 * node scripts/tests/admin-accounts.mongo.http.cjs --local-fixture
 * Every operation uses real HTTP. This script never reads a database URI and
 * can only reach the fixed loopback fixture with its explicit local-only login.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone HTTP regression runner. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const origin = 'http://localhost:3399';
const transport = 'http://127.0.0.1:3399';
const ownerUsername = 'Dustin';
const ownerPassword = 'local-browser-fixture-2026!';
const username = `http_${randomBytes(8).toString('hex')}`;
const password = randomBytes(30).toString('base64url');
let ownerCookie;
let createdId;
let removed = false;
let checks = 0;

function checked(label) { checks++; console.log('PASS ' + label); }
async function request(route, { method = 'GET', cookie, body } = {}) {
  assert.ok(route.startsWith('/api/'), 'Only local API routes are allowed');
  return fetch(transport + route, {
    method, redirect: 'manual', signal: AbortSignal.timeout(60_000),
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function json(response, status, label) {
  assert.equal(response.status, status, `${label}: unexpected HTTP status`);
  assert.match(response.headers.get('cache-control') || '', /no-store/, `${label} must not cache`);
  const body = await response.json();
  assert.doesNotMatch(JSON.stringify(body), /@accounts\.monstajam\.invalid|"(?:email|emailVerified|token|resetNonce|credentialLockVersion)"\s*:/, label + ' leaked internal account data');
  return body;
}
function cookie(response) {
  const value = response.headers.getSetCookie().find((entry) => entry.includes('monstajam_auth.session_token='));
  assert.ok(value, 'Real HTTP sign-in must set a named session cookie');
  assert.match(value, /HttpOnly/i);
  assert.match(value, /SameSite=Lax/i);
  return value.split(';')[0];
}
function token(link) {
  const url = new URL(link.activationUrl);
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, '/upload/activate');
  assert.equal(url.search, '', 'Activation secret must not be in query parameters');
  const value = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.ok(value);
  return value;
}
async function signIn(loginUsername, loginPassword) {
  const response = await request('/api/auth/sign-in/username', { method: 'POST', body: { username: loginUsername, password: loginPassword } });
  const data = await json(response, 200, 'Named sign-in');
  assert.equal(data.user.username, loginUsername.trim().toLowerCase());
  return { cookie: cookie(response), user: data.user };
}

async function main() {
  assert.ok(process.argv.includes('--local-fixture'), 'Pass --local-fixture to use this test-only server.');
  try {
    const owner = await signIn(ownerUsername.toUpperCase(), ownerPassword);
    assert.equal(owner.user.name, 'Local fixture owner', 'Refuse to mutate an unknown local server');
    assert.equal(owner.user.role, 'owner');
    ownerCookie = owner.cookie;
    const list = await json(await request('/api/admin/accounts', { cookie: ownerCookie }), 200, 'Owner account list');
    assert.equal(list.currentUserId, owner.user.id);
    await json(await request('/api/auth/sign-in/email', { method: 'POST', body: { email: 'unused@fixture.invalid', password: ownerPassword } }), 404, 'Email sign-in remains closed');
    checked('owner signs in and accesses the account list through real Next HTTP');

    const invite = await json(await request('/api/admin/accounts', {
      method: 'POST', cookie: ownerCookie, body: { name: 'HTTP regression admin', username: username.toUpperCase() },
    }), 201, 'Owner invitation');
    createdId = invite.account.id;
    assert.equal(invite.account.status, 'pending');
    assert.equal(invite.account.username, username);
    await json(await request('/api/admin/accounts', {
      method: 'POST', cookie: ownerCookie, body: { name: 'Duplicate name attempt', username },
    }), 409, 'Case-insensitive duplicate username');
    const activationToken = token(invite);
    assert.ok(Date.parse(invite.expiresAt) > Date.now());
    const info = await json(await request('/api/admin/accounts/activation-info', {
      method: 'POST', body: { token: activationToken },
    }), 200, 'Activation information');
    assert.equal(info.username, username);
    assert.equal(info.status, 'pending');
    checked('owner invitation crosses route bundles and returns a usable one-hour fragment link');

    await json(await request('/api/auth/reset-password', {
      method: 'POST', body: { token: activationToken, newPassword: password },
    }), 200, 'Account activation');
    await json(await request('/api/auth/reset-password', {
      method: 'POST', body: { token: activationToken, newPassword: password },
    }), 410, 'Consumed activation replay');
    const firstAdmin = await signIn(username.toUpperCase(), password);
    assert.equal(firstAdmin.user.role, 'admin');
    await json(await request('/api/tracks?all=true', { cookie: firstAdmin.cookie }), 200, 'Admin content access');
    await json(await request('/api/admin/accounts', { cookie: firstAdmin.cookie }), 403, 'Admin cannot manage accounts');
    checked('activation crosses route bundles, is single-use, and grants content access without owner privileges');

    await json(await request('/api/auth/logout', { method: 'POST', cookie: firstAdmin.cookie, body: {} }), 200, 'Admin logout');
    await json(await request('/api/tracks?all=true', { cookie: firstAdmin.cookie }), 401, 'Logged-out cookie replay');
    const secondAdmin = await signIn(username.toUpperCase(), password);
    const resetLink = await json(await request(`/api/admin/accounts/${createdId}/link`, {
      method: 'POST', cookie: ownerCookie, body: { kind: 'reset' },
    }), 200, 'Owner reset link');
    const resetToken = token(resetLink);
    await json(await request(`/api/admin/accounts/${createdId}`, { method: 'DELETE', cookie: ownerCookie }), 200, 'Owner removal');
    removed = true;
    await json(await request('/api/tracks?all=true', { cookie: secondAdmin.cookie }), 401, 'Removed admin cookie replay');
    await json(await request('/api/admin/accounts/activation-info', { method: 'POST', body: { token: resetToken } }), 410, 'Removed account reset link');
    await json(await request('/api/auth/reset-password', { method: 'POST', body: { token: resetToken, newPassword: password } }), 410, 'Removed account password reset');
    await json(await request('/api/tracks?all=true', { cookie: ownerCookie }), 200, 'Owner remains signed in');
    checked('logout and removal immediately reject old cookies and copied reset links while preserving the owner');
    console.log(JSON.stringify({ ok: true, checks, transport: 'real HTTP', fixture: origin }));
  } finally {
    // Leave this test account revoked even when a later check fails. The owning
    // fixture removes all isolated auth documents when its stop file is created.
    if (createdId && ownerCookie && !removed) {
      const response = await request(`/api/admin/accounts/${createdId}`, { method: 'DELETE', cookie: ownerCookie });
      assert.equal(response.status, 200, 'Failed HTTP test account cleanup must revoke its own created identity');
    }
    if (ownerCookie) await request('/api/auth/logout', { method: 'POST', cookie: ownerCookie, body: {} });
  }
}
main().catch((error) => {
  // Never print response bodies, activation URLs, tokens, or passwords.
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'Local HTTP regression failed.');
  process.exitCode = 1;
});
