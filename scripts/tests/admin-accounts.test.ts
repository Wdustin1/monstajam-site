import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { NextRequest } from 'next/server';
import {
  createAuthProvider, getAdminIdentity, isAllowedMutationOrigin,
  setupLinkDelivery, type AuthProvider,
} from '../../src/lib/auth-provider';
import { AUTH_COLLECTIONS, resetIdentifier } from '../../src/lib/auth-store';
import { isAdminRequest } from '../../src/lib/auth';

const baseURL = 'http://localhost:3312';
const password = 'local-fixture-password-12';
const replacementPassword = 'different-fixture-password-34';
const globals = globalThis as typeof globalThis & { __monstajamAuthProvider?: AuthProvider };
const originalProvider = globals.__monstajamAuthProvider;
const originalURL = process.env.BETTER_AUTH_URL;
let db: MemoryDB;
let auth: AuthProvider;

beforeEach(() => {
  process.env.BETTER_AUTH_URL = baseURL;
  db = Object.fromEntries(Object.values(AUTH_COLLECTIONS).map((name) => [name, []]));
  auth = createAuthProvider({
    database: memoryAdapter(db), baseURL, secret: randomBytes(48).toString('base64url'),
    onPasswordReset: async (userId) => {
      const user = db[AUTH_COLLECTIONS.users].find((row) => row.id === userId);
      assert.ok(user);
      if (user.accessStatus === 'removed') throw new Error('Removed account cannot activate.');
      user.accessStatus = 'active';
    },
  });
  globals.__monstajamAuthProvider = auth;
});
afterEach(() => {
  if (originalProvider) globals.__monstajamAuthProvider = originalProvider;
  else delete globals.__monstajamAuthProvider;
  if (originalURL === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = originalURL;
});

async function seed(role: 'owner' | 'admin' = 'admin', accessStatus = 'active', username = `${role}_${randomBytes(5).toString('hex')}`) {
  const email = `${randomBytes(16).toString('hex')}@fixture.invalid`;
  const user = (await auth.api.createUser({ body: { email, name: 'Local fixture', password, role, data: { accessStatus, username } } })).user;
  assert.ok('username' in user && typeof user.username === 'string');
  return { ...user, username: user.username };
}
async function signIn(username: string, attemptedPassword = password) {
  return auth.api.signInUsername({ body: { username, password: attemptedPassword }, asResponse: true });
}
async function cookieFor(username: string) {
  const response = await signIn(username);
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().find((value) => value.includes('monstajam_auth.session_token='))?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

function assertHiddenAliasAbsent(body: unknown, alias: string) {
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes(alias), 'Internal alias must never leave an HTTP auth response');
  assert.doesNotMatch(serialized, /"(?:email|emailVerified|token|resetNonce|credentialLockVersion)"\s*:/);
}

test('username plugin normalizes mixed case, supports dots/underscores, and accepts case-insensitive sign-in', async () => {
  const user = await seed('owner', 'active', 'Dustin.Test_1');
  assert.equal(user.username, 'dustin.test_1');
  const cookie = await cookieFor('DUSTIN.TEST_1');
  assert.deepEqual(await getAdminIdentity(headersFor(cookie)), {
    id: user.id, name: user.name, username: 'dustin.test_1', role: 'owner',
  });
});

function headersFor(cookie: string) { return new Headers({ Cookie: cookie }); }
async function setupToken(userId: string, email: string) {
  const delivery: { userId: string; token?: string } = { userId };
  await setupLinkDelivery.run(delivery, () => auth.api.requestPasswordReset({ body: { email } }));
  assert.ok(delivery.token);
  return delivery.token;
}

test('real signed sessions return only active named owner/admin identity; legacy and forged cookies fail', async () => {
  for (const role of ['owner', 'admin'] as const) {
    const user = await seed(role);
    const cookie = await cookieFor(user.username);
    const identity = await getAdminIdentity(headersFor(cookie));
    assert.deepEqual(identity, { id: user.id, name: user.name, username: user.username, role });
    assert.equal(await isAdminRequest(new NextRequest(baseURL + '/api/tracks', { headers: { Cookie: cookie } })), true);
  }
  assert.equal(await getAdminIdentity(new Headers()), null);
  assert.equal(await getAdminIdentity(headersFor('admin_session=obsolete-shared-secret')), null);
  assert.equal(await getAdminIdentity(headersFor('monstajam_auth.session_token=forged.unsigned')), null);
});

test('pending/removed/locked accounts cannot create sessions even with the correct password', async () => {
  for (const accessStatus of ['pending', 'removed']) {
    const user = await seed('admin', accessStatus);
    assert.equal((await signIn(user.username)).status, 403);
  }
  const user = await seed();
  db[AUTH_COLLECTIONS.users].find((row) => row.id === user.id)!.authLocked = true;
  assert.equal((await signIn(user.username)).status, 403);
  assert.equal((db[AUTH_COLLECTIONS.sessions] || []).length, 0);
});

test('current user status and role are authoritative immediately, without waiting for cookie expiry', async () => {
  const user = await seed();
  const cookie = await cookieFor(user.username);
  const stored = db[AUTH_COLLECTIONS.users].find((row) => row.id === user.id)!;
  for (const change of [{ accessStatus: 'removed' }, { authLocked: true }, { banned: true }, { role: 'user' }]) {
    Object.assign(stored, { accessStatus: 'active', authLocked: false, banned: false, role: 'admin' }, change);
    assert.equal(await getAdminIdentity(headersFor(cookie)), null);
  }
  Object.assign(stored, { accessStatus: 'active', authLocked: false, banned: false, role: 'admin' });
  assert.equal((await getAdminIdentity(headersFor(cookie)))?.id, user.id);
  db[AUTH_COLLECTIONS.sessions] = [];
  assert.equal(await getAdminIdentity(headersFor(cookie)), null, 'Deleting backing sessions must revoke unchanged signed cookies');
});

test('logout revokes only that session and an old signed cookie cannot be replayed', async () => {
  const user = await seed();
  const first = await cookieFor(user.username);
  const second = await cookieFor(user.username);
  await auth.api.signOut({ headers: headersFor(first) });
  assert.equal(await getAdminIdentity(headersFor(first)), null);
  assert.equal((await getAdminIdentity(headersFor(second)))?.id, user.id);
});

test('mutations require the configured same origin as well as a valid session', async () => {
  const user = await seed();
  const cookie = await cookieFor(user.username);
  const origins: Record<string, string>[] = [{}, { Origin: 'https://untrusted.invalid' }, { Origin: baseURL, 'Sec-Fetch-Site': 'cross-site' }];
  for (const extra of origins) {
    const request = new NextRequest(baseURL + '/api/tracks', { method: 'POST', headers: { Cookie: cookie, ...extra } });
    assert.equal(isAllowedMutationOrigin(request), false);
    assert.equal(await isAdminRequest(request), false);
  }
  const allowed = new NextRequest(baseURL + '/api/tracks', { method: 'POST', headers: { Cookie: cookie, Origin: baseURL } });
  assert.equal(await isAdminRequest(allowed), true);
});

test('reset tokens are hashed at rest, one use, activate pending accounts and revoke old sessions', async () => {
  const user = await seed();
  const cookie = await cookieFor(user.username);
  const token = await setupToken(user.id, user.email);
  const verification = db[AUTH_COLLECTIONS.verifications].find((row) => row.identifier === resetIdentifier(token));
  assert.ok(verification, 'The stored identifier must match the supported SHA-256 hasher');
  assert.ok(!JSON.stringify(db[AUTH_COLLECTIONS.verifications]).includes(token), 'Plain token must never be stored');
  assert.ok(new Date(verification.expiresAt).getTime() <= Date.now() + 3_600_000);
  const reset = await auth.api.resetPassword({ body: { token, newPassword: replacementPassword }, asResponse: true });
  assert.equal(reset.status, 200);
  assert.equal(await getAdminIdentity(headersFor(cookie)), null);
  assert.equal((await auth.api.resetPassword({ body: { token, newPassword: password }, asResponse: true })).status, 400);
  assert.equal((await signIn(user.username)).status, 401);
  assert.equal((await signIn(user.username, replacementPassword)).status, 200);

  const pending = await seed('admin', 'pending');
  const activation = await setupToken(pending.id, pending.email);
  assert.equal((await auth.api.resetPassword({ body: { token: activation, newPassword: replacementPassword }, asResponse: true })).status, 200);
  assert.equal((await signIn(pending.username, replacementPassword)).status, 200);
});

test('expired links fail, invalid short passwords preserve a valid link, and concurrent redemption has one winner', async () => {
  const user = await seed('admin', 'pending');
  const expired = await setupToken(user.id, user.email);
  db[AUTH_COLLECTIONS.verifications].find((row) => row.identifier === resetIdentifier(expired))!.expiresAt = new Date(Date.now() - 1_000);
  assert.equal((await auth.api.resetPassword({ body: { token: expired, newPassword: replacementPassword }, asResponse: true })).status, 400);
  const token = await setupToken(user.id, user.email);
  assert.equal((await auth.api.resetPassword({ body: { token, newPassword: 'short' }, asResponse: true })).status, 400);
  const attempts = await Promise.all([
    auth.api.resetPassword({ body: { token, newPassword: replacementPassword }, asResponse: true }),
    auth.api.resetPassword({ body: { token, newPassword: password }, asResponse: true }),
  ]);
  assert.deepEqual(attempts.map((response) => response.status).sort(), [200, 400]);
});

test('HTTP signup is disabled and reset links are exposed only to their server-side delivery context', async () => {
  const response = await auth.handler(new Request(baseURL + '/api/auth/sign-up/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
    body: JSON.stringify({ email: 'unexpected@fixture.invalid', password, name: 'Unexpected' }),
  }));
  assert.equal(response.status, 400);
  const user = await seed();
  const delivery: { userId: string; token?: string } = { userId: user.id };
  const result = await setupLinkDelivery.run(delivery, () => auth.api.requestPasswordReset({ body: { email: user.email } }));
  assert.ok(delivery.token);
  assert.ok(!JSON.stringify(result).includes(delivery.token), 'The reset response cannot expose the token');
});

test('actual auth route allowlist blocks provider admin/signup/reset-delivery endpoints even for a signed-in owner', async () => {
  const { GET, POST } = await import('../../src/app/api/auth/[...all]/route');
  const user = await seed('owner');
  const cookie = await cookieFor(user.username);
  for (const endpoint of ['/sign-in/email', '/sign-up/email', '/is-username-available', '/request-password-reset', '/admin/create-user', '/admin/set-role', '/admin/impersonate-user', '/update-user']) {
    const request = new Request(baseURL + '/api/auth' + endpoint, {
      method: 'POST', headers: { Cookie: cookie, Origin: baseURL, 'Content-Type': 'application/json' }, body: '{}',
    });
    const response = await POST(request);
    assert.equal(response.status, 404, endpoint);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
  }
  const callback = await GET(new Request(baseURL + '/api/auth/reset-password/guessed-token'));
  assert.equal(callback.status, 404);
  const foreignOrigin = await POST(new Request(baseURL + '/api/auth/sign-in/username', {
    method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, password }),
  }));
  assert.equal(foreignOrigin.status, 403);
  const session = await GET(new Request(baseURL + '/api/auth/get-session', { headers: { Cookie: cookie } }));
  assert.equal(session.status, 200);
  const sessionBody = await session.json();
  assert.equal(sessionBody.user.id, user.id);
  assert.equal(sessionBody.user.username, user.username);
  assertHiddenAliasAbsent(sessionBody, user.email);
  assert.match(session.headers.get('cache-control') || '', /no-store/);
});

test('actual sign-in wrapper uses the atomic credential lock, releases failures, and enforces its database throttle', async () => {
  const { POST } = await import('../../src/app/api/auth/[...all]/route');
  const user = await seed();
  const stored = db[AUTH_COLLECTIONS.users].find((row) => row.id === user.id)!;
  const request = (attemptedPassword: string) => POST(new Request(baseURL + '/api/auth/sign-in/username', {
    method: 'POST', headers: { Origin: baseURL, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, password: attemptedPassword }),
  }));
  const failed = await request('wrong-fixture-password');
  assert.equal(failed.status, 401);
  assert.equal(stored.resetNonce, null, 'Failed credentials must release the claim');
  const success = await request(password);
  assert.equal(success.status, 200);
  assert.ok(success.headers.getSetCookie().some((value) => value.includes('session_token=')));
  assert.equal(stored.resetNonce, null);
  assertHiddenAliasAbsent(await success.json(), user.email);
  stored.resetNonce = 'another-credential-operation';
  assert.equal((await request(password)).status, 401);
  assert.equal(stored.resetNonce, 'another-credential-operation', 'A conflicting request cannot release another operation');
  stored.resetNonce = null;
  await request('wrong-fixture-password');
  await request('wrong-fixture-password');
  assert.equal((await request(password)).status, 429);
});
