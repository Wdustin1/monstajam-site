// Explicit network integration test. The supplied connection is rewritten to a
// fresh test database BEFORE any client is constructed. No production database
// is read or written. The test cleans only that exact, newly created database.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextRequest } from 'next/server';

async function main() {
  if (!process.argv.includes('--isolated-database')) throw new Error('Pass --isolated-database to run the Mongo integration test.');
  if (!process.env.DATABASE_URL) throw new Error('Supply DATABASE_URL through the environment.');
  const uri = new URL(process.env.DATABASE_URL);
  if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)) throw new Error('MongoDB connection required.');
  const databaseName = `monstajam_auth_test_${randomBytes(8).toString('hex')}`;
  uri.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = uri.toString();
  process.env.BETTER_AUTH_URL = 'http://localhost:3399';
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
  Object.assign(process.env, { NODE_ENV: 'test' });
  setServers(['1.1.1.1', '8.8.8.8']);
  const store = await import('../../src/lib/auth-store');
  const provider = await import('../../src/lib/auth-provider');
  const service = await import('../../src/lib/admin-accounts');
  const { runCredentialRaceChecks } = await import('./admin-credential-races');
  const route = await import('../../src/app/api/auth/[...all]/route');
  const db = store.getAuthDatabase();
  const client = store.getAuthMongoClient();
  assert.equal(db.databaseName, databaseName);
  let ownsDatabase = false;
  const privateDirectory = await mkdtemp(path.join(tmpdir(), 'monstajam-auth-operator-test-'));
  let checks = 0;
  function checked(message: string) { checks++; console.log(`PASS ${message}`); }
  async function expectStatus(action: () => Promise<unknown>, status: number) {
    await assert.rejects(action, (error: unknown) => error instanceof service.AdminAccountError && error.status === status);
  }
  async function request(path: string, body: Record<string, unknown>, cookie?: string) {
    // Each scenario tests authorization independently of the login throttle.
    await db.collection(store.AUTH_COLLECTIONS.rates).deleteMany({});
    return route.POST(new NextRequest(process.env.BETTER_AUTH_URL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: process.env.BETTER_AUTH_URL!, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    }));
  }
  async function signIn(email: string, password: string) {
    const response = await request('/api/auth/sign-in/email', { email, password });
    assert.equal(response.status, 200, 'Named sign-in must succeed');
    const cookie = response.headers.getSetCookie().find(value => value.includes('monstajam_auth.session_token='))?.split(';')[0];
    assert.ok(cookie, 'Real signed session cookie must be set');
    return cookie;
  }
  function token(link: { activationUrl: string }) {
    const value = new URLSearchParams(new URL(link.activationUrl).hash.slice(1)).get('token');
    assert.ok(value, 'Activation link must have a fragment token');
    assert.equal(new URL(link.activationUrl).search, '');
    return value;
  }
  async function identity(cookie: string) { return provider.getAdminIdentity(new Headers({ Cookie: cookie })); }
  const ownerPassword = randomBytes(30).toString('base64url');
  const firstPassword = randomBytes(30).toString('base64url');
  const nextPassword = randomBytes(30).toString('base64url');
  async function operator(script: string, args: string[]) {
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', script, '--expect-database', databaseName, ...args], {
      env: { ...process.env, OWNER_EMAIL: 'owner@fixture.invalid', OWNER_NAME: 'Integration owner' }, windowsHide: true, timeout: 60_000,
    });
    return result.stdout;
  }
  try {
    assert.equal((await db.listCollections().toArray()).length, 0, 'Refuse to reuse an existing database');
    ownsDatabase = true;
    await store.ensureAuthIndexes();
    const auth = provider.getAuth();
    assert.ok((await operator('scripts/bootstrap-admin.ts', [])).includes('Dry run passed'));
    assert.equal(await db.collection(store.AUTH_COLLECTIONS.users).countDocuments(), 0);
    const setupFile = path.join(privateDirectory, 'owner-setup.json');
    await operator('scripts/bootstrap-admin.ts', ['--apply', '--output', setupFile]);
    const setup = JSON.parse(await readFile(setupFile, 'utf8')) as { ownerId: string; activationUrl: string };
    assert.equal((await request('/api/auth/reset-password', { token: token(setup), newPassword: ownerPassword })).status, 200);
    const actor = { id: setup.ownerId, name: 'Integration owner', email: 'owner@fixture.invalid', role: 'owner' as const };
    assert.ok((await operator('scripts/bootstrap-admin.ts', ['--apply', '--output', setupFile])).includes('already configured'));
    const ownerCookie = await signIn(actor.email, ownerPassword);
    assert.equal((await identity(ownerCookie))?.role, 'owner');
    await assert.rejects(() => auth.api.createUser({ body: {
      email: 'second-owner@fixture.invalid', name: 'Forbidden owner', password: ownerPassword, role: 'owner', data: { accessStatus: 'active' },
    } }));
    checked('offline owner setup dry-run, private-file activation, idempotency and unique owner index work');

    const invited = await service.createAdminAccount(actor, { name: 'Integration admin', email: 'ADMIN@fixture.invalid' });
    const id = invited.account.id;
    const firstToken = token(invited);
    assert.equal(invited.account.status, 'pending');
    assert.equal(invited.account.email, 'admin@fixture.invalid');
    assert.equal((await service.getActivationInfo(firstToken)).status, 'pending');
    assert.ok(!JSON.stringify(await db.collection(store.AUTH_COLLECTIONS.verifications).find().toArray()).includes(firstToken));
    await expectStatus(() => service.createAdminAccount(actor, { name: 'Duplicate', email: 'admin@fixture.invalid' }), 409);
    await expectStatus(() => service.listAdminAccounts({ ...actor, role: 'admin' }), 403);
    checked('invites are pending, unique, owner-only, and tokens are hashed at rest');

    const replaced = await service.issueAccountLink(actor, id, 'activate');
    await expectStatus(() => service.getActivationInfo(firstToken), 410);
    const activationToken = token(replaced);
    assert.equal((await request('/api/auth/reset-password', { token: activationToken, newPassword: 'short' })).status, 422);
    assert.equal((await service.getActivationInfo(activationToken)).status, 'pending');
    assert.equal((await request('/api/auth/reset-password', { token: activationToken, newPassword: firstPassword })).status, 200);
    assert.equal((await request('/api/auth/reset-password', { token: activationToken, newPassword: firstPassword })).status, 410);
    const adminCookie = await signIn('admin@fixture.invalid', firstPassword);
    assert.equal((await identity(adminCookie))?.id, id);
    checked('replaced links and replays fail; valid activation enables the named admin');

    const reset = await service.issueAccountLink(actor, id, 'reset');
    const resetToken = token(reset);
    const results = await Promise.all([
      request('/api/auth/reset-password', { token: resetToken, newPassword: nextPassword }),
      request('/api/auth/reset-password', { token: resetToken, newPassword: nextPassword }),
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 410]);
    assert.equal(await identity(adminCookie), null);
    const resetCookie = await signIn('admin@fixture.invalid', nextPassword);
    checked('concurrent redemption has one winner and reset revokes existing sessions');

    const pendingReset = await service.issueAccountLink(actor, id, 'reset');
    await service.revokeAdminAccount(actor, id);
    assert.equal(await identity(resetCookie), null);
    await expectStatus(() => service.getActivationInfo(token(pendingReset)), 410);
    assert.notEqual((await request('/api/auth/sign-in/email', { email: 'admin@fixture.invalid', password: nextPassword })).status, 200);
    await expectStatus(() => service.revokeAdminAccount(actor, actor.id), 409);
    const reinvited = await service.createAdminAccount(actor, { name: 'Integration admin', email: 'admin@fixture.invalid' });
    assert.equal(reinvited.account.status, 'pending');
    assert.notEqual((await request('/api/auth/sign-in/email', { email: 'admin@fixture.invalid', password: nextPassword })).status, 200);
    await expectStatus(() => service.getActivationInfo(token(pendingReset)), 410);
    assert.equal((await request('/api/auth/reset-password', { token: token(reinvited), newPassword: firstPassword })).status, 200);
    await signIn('admin@fixture.invalid', firstPassword);
    checked('removal revokes sessions/links, owner is protected, and reinvites require fresh activation');

    const otherSession = await signIn(actor.email, ownerPassword);
    assert.equal((await request('/api/auth/change-password', { currentPassword: ownerPassword, newPassword: nextPassword, revokeOtherSessions: false }, ownerCookie)).status, 200);
    assert.equal(await identity(otherSession), null);
    await signIn(actor.email, nextPassword);
    checked('password changes enforce revocation of other sessions even when the client opts out');

    const list = await service.listAdminAccounts(actor);
    assert.equal(list.accounts.filter(account => account.role === 'owner').length, 1);
    assert.ok(list.accounts.every(account => !('password' in account) && !('currentLinkHash' in account)));
    assert.ok(await db.collection(store.AUTH_COLLECTIONS.audit).countDocuments() > 0);
    checked('account views exclude credentials and access changes leave audit records');
    const recoveryFile = path.join(privateDirectory, 'owner-recovery.json');
    assert.ok((await operator('scripts/recover-admin-owner.ts', [])).includes('Dry run passed'));
    await operator('scripts/recover-admin-owner.ts', ['--apply', '--output', recoveryFile]);
    const recovery = JSON.parse(await readFile(recoveryFile, 'utf8')) as { activationUrl: string };
    assert.equal((await request('/api/auth/reset-password', { token: token(recovery), newPassword: ownerPassword })).status, 200);
    await signIn(actor.email, ownerPassword);
    checked('explicit offline owner recovery writes a working private one-use link');
    for (const message of await runCredentialRaceChecks(actor)) checked(message);
    console.log(JSON.stringify({ ok: true, checks, isolatedDatabase: databaseName }));
  } finally {
    try {
      if (ownsDatabase) {
        assert.equal(client.db().databaseName, databaseName);
        assert.ok(/^monstajam_auth_test_[a-f0-9]{16}$/.test(databaseName));
        // The application database role permits document operations but not
        // dropDatabase. Leave empty indexed collections; remove all test data.
        for (const name of [...Object.values(store.AUTH_COLLECTIONS), 'auth_link_probe_limits']) {
          await db.collection(name).deleteMany({});
        }
        console.log('Removed all data from the isolated integration-test database.');
      }
    } finally {
      await client.close();
      // Exact mkdtemp result is owned by this test; remove its private links.
      await rm(privateDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  // Do not print HTTP bodies, credentials, connection URIs, or activation links.
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'Integration test failed.');
  process.exitCode = 1;
});
