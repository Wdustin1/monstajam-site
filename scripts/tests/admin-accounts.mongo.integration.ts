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
  async function signIn(username: string, password: string) {
    const response = await request('/api/auth/sign-in/username', { username, password });
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
  async function operatorResult(script: string, args: string[], environment: Record<string, string | undefined> = {}) {
    return promisify(execFile)(process.execPath, ['--import', 'tsx', script, '--expect-database', databaseName, ...args], {
      env: { ...process.env, OWNER_INITIAL_PASSWORD: undefined, OWNER_USERNAME: 'fixture_owner', OWNER_NAME: 'Integration owner', ...environment }, windowsHide: true, timeout: 60_000,
    });
  }
  async function operator(script: string, args: string[]) {
    return (await operatorResult(script, args)).stdout;
  }
  async function clearOwnedAuthData() {
    assert.ok(ownsDatabase, 'Only the newly created fixture database may be cleared');
    assert.equal(client.db().databaseName, databaseName);
    assert.ok(/^monstajam_auth_test_[a-f0-9]{16}$/.test(databaseName));
    for (const name of [...Object.values(store.AUTH_COLLECTIONS), 'auth_link_probe_limits']) await db.collection(name).deleteMany({});
  }
  try {
    assert.equal((await db.listCollections().toArray()).length, 0, 'Refuse to reuse an existing database');
    ownsDatabase = true;
    await store.ensureAuthIndexes();
    const auth = provider.getAuth();

    // Exercise the explicit short initial-owner password path in the same
    // verified-empty fixture DB, then remove only these owned auth documents so
    // the ordinary one-use-link bootstrap coverage below remains unchanged.
    const shortInitialPassword = randomBytes(8).toString('base64url').slice(0, 5);
    let replacementPassword = randomBytes(8).toString('base64url').slice(0, 5);
    while (replacementPassword === shortInitialPassword) replacementPassword = randomBytes(8).toString('base64url').slice(0, 5);
    const initialEnvironment = { OWNER_USERNAME: 'Short.Owner', OWNER_NAME: 'Short password owner', OWNER_INITIAL_PASSWORD: shortInitialPassword };
    const initialFile = path.join(privateDirectory, 'owner-initial-password.json');
    const initialDryRun = await operatorResult('scripts/bootstrap-admin.ts', [], initialEnvironment);
    assert.ok(initialDryRun.stdout.includes('Dry run passed'));
    assert.equal(await db.collection(store.AUTH_COLLECTIONS.users).countDocuments(), 0);
    const initialResult = await operatorResult('scripts/bootstrap-admin.ts', ['--apply', '--output', initialFile], initialEnvironment);
    const confirmationText = await readFile(initialFile, 'utf8');
    const confirmation = JSON.parse(confirmationText) as { ownerUsername: string; ownerId: string; status: string; initialPasswordConfigured: boolean; activationUrl?: string };
    assert.equal(confirmation.ownerUsername, 'short.owner');
    assert.equal(confirmation.status, 'active');
    assert.equal(confirmation.initialPasswordConfigured, true);
    assert.equal(confirmation.activationUrl, undefined, 'Initial-password mode must not also issue an activation link');
    assert.equal(await db.collection(store.AUTH_COLLECTIONS.verifications).countDocuments(), 0);
    const initialUser = await db.collection<import('../../src/lib/auth-store').AdminUserDocument>(store.AUTH_COLLECTIONS.users).findOne({ username: 'short.owner' });
    assert.ok(initialUser);
    assert.equal(initialUser._id.toHexString(), confirmation.ownerId);
    assert.equal(initialUser.name, initialEnvironment.OWNER_NAME);
    assert.equal(initialUser.role, 'owner');
    assert.equal(initialUser.accessStatus, 'active');
    const credentialBefore = await db.collection(store.AUTH_COLLECTIONS.accounts).findOne({ userId: initialUser._id, providerId: 'credential' });
    assert.ok(credentialBefore && typeof credentialBefore.password === 'string');
    assert.ok(credentialBefore.password !== shortInitialPassword, 'Only a password hash may be stored');
    assert.ok(await (await auth.$context).password.verify({ hash: credentialBefore.password, password: shortInitialPassword }));
    const initialCookie = await signIn(' sHoRt.OwNeR ', shortInitialPassword);
    assert.deepEqual(await identity(initialCookie), { id: confirmation.ownerId, name: initialEnvironment.OWNER_NAME, username: 'short.owner', role: 'owner' });
    const publicSession = await route.GET(new NextRequest(process.env.BETTER_AUTH_URL + '/api/auth/get-session', { headers: { Cookie: initialCookie } }));
    const publicSessionText = await publicSession.text();
    assert.equal(publicSession.status, 200);
    assert.ok(!publicSessionText.includes(initialUser.email), 'Internal email aliases must not leave the auth endpoint');
    assert.ok(!publicSessionText.includes('"email"'));
    assert.equal((await request('/api/auth/sign-in/email', { email: initialUser.email, password: shortInitialPassword })).status, 404);
    checked('explicit short initial-owner password is hashed, activates only the new owner, and supports mixed-case username login');

    const repeatedResult = await operatorResult('scripts/bootstrap-admin.ts', ['--apply', '--output', initialFile], { ...initialEnvironment, OWNER_INITIAL_PASSWORD: replacementPassword });
    assert.ok(repeatedResult.stdout.includes('already configured'));
    assert.equal(await readFile(initialFile, 'utf8'), confirmationText, 'A repeat bootstrap must not rewrite its confirmation');
    const credentialAfter = await db.collection(store.AUTH_COLLECTIONS.accounts).findOne({ userId: initialUser._id, providerId: 'credential' });
    assert.ok(credentialAfter?.password === credentialBefore.password, 'A repeat bootstrap must not replace the credential');
    assert.equal(await db.collection(store.AUTH_COLLECTIONS.users).countDocuments(), 1);
    assert.equal((await identity(initialCookie))?.id, confirmation.ownerId, 'A repeat bootstrap must preserve existing sessions');
    await signIn('SHORT.OWNER', shortInitialPassword);
    assert.equal((await request('/api/auth/sign-in/username', { username: 'short.owner', password: replacementPassword })).status, 401);
    for (const output of [initialDryRun.stdout, initialDryRun.stderr, initialResult.stdout, initialResult.stderr, repeatedResult.stdout, repeatedResult.stderr, confirmationText, publicSessionText]) {
      assert.ok(!output.includes(shortInitialPassword), 'The supplied initial password must never appear in output');
      assert.ok(!output.includes(replacementPassword), 'A repeat bootstrap password must never appear in output');
    }
    checked('repeat bootstrap is a no-op, rejects a replacement password at login, and prints or stores no plaintext password');

    const shortOwner = { id: confirmation.ownerId, name: initialUser.name, username: initialUser.username, role: 'owner' as const };
    assert.equal((await request('/api/auth/change-password', { currentPassword: shortInitialPassword, newPassword: replacementPassword }, initialCookie)).status, 422);
    const strongReset = await service.issueAccountLink(shortOwner, shortOwner.id, 'reset');
    assert.equal((await request('/api/auth/reset-password', { token: token(strongReset), newPassword: replacementPassword })).status, 422);
    assert.equal((await service.getActivationInfo(token(strongReset))).status, 'active');
    checked('short-password exception is confined to initial bootstrap; normal password change/reset still require twelve characters');
    await clearOwnedAuthData();
    assert.equal(await identity(initialCookie), null, 'Fixture cleanup must revoke the first owner session');

    assert.ok((await operator('scripts/bootstrap-admin.ts', [])).includes('Dry run passed'));
    assert.equal(await db.collection(store.AUTH_COLLECTIONS.users).countDocuments(), 0);
    const setupFile = path.join(privateDirectory, 'owner-setup.json');
    await operator('scripts/bootstrap-admin.ts', ['--apply', '--output', setupFile]);
    const setup = JSON.parse(await readFile(setupFile, 'utf8')) as { ownerId: string; activationUrl: string };
    assert.equal((await request('/api/auth/reset-password', { token: token(setup), newPassword: ownerPassword })).status, 200);
    const actor = { id: setup.ownerId, name: 'Integration owner', username: 'fixture_owner', role: 'owner' as const };
    assert.ok((await operator('scripts/bootstrap-admin.ts', ['--apply', '--output', setupFile])).includes('already configured'));
    const ownerCookie = await signIn(actor.username, ownerPassword);
    assert.equal((await identity(ownerCookie))?.role, 'owner');
    await assert.rejects(() => auth.api.createUser({ body: {
      email: 'second-owner@fixture.invalid', name: 'Forbidden owner', password: ownerPassword, role: 'owner', data: { username: 'second_owner', accessStatus: 'active' },
    } }));
    checked('offline owner setup dry-run, private-file activation, idempotency and unique owner index work');

    const invited = await service.createAdminAccount(actor, { name: 'Integration admin', username: 'Fixture_Admin' });
    const id = invited.account.id;
    const firstToken = token(invited);
    assert.equal(invited.account.status, 'pending');
    assert.equal(invited.account.username, 'fixture_admin');
    assert.equal((await service.getActivationInfo(firstToken)).status, 'pending');
    assert.ok(!JSON.stringify(await db.collection(store.AUTH_COLLECTIONS.verifications).find().toArray()).includes(firstToken));
    await expectStatus(() => service.createAdminAccount(actor, { name: 'Duplicate', username: 'fixture_admin' }), 409);
    await expectStatus(() => service.listAdminAccounts({ ...actor, role: 'admin' }), 403);
    checked('invites are pending, unique, owner-only, and tokens are hashed at rest');

    const replaced = await service.issueAccountLink(actor, id, 'activate');
    await expectStatus(() => service.getActivationInfo(firstToken), 410);
    const activationToken = token(replaced);
    assert.equal((await request('/api/auth/reset-password', { token: activationToken, newPassword: 'short' })).status, 422);
    assert.equal((await service.getActivationInfo(activationToken)).status, 'pending');
    assert.equal((await request('/api/auth/reset-password', { token: activationToken, newPassword: firstPassword })).status, 200);
    assert.equal((await request('/api/auth/reset-password', { token: activationToken, newPassword: firstPassword })).status, 410);
    const adminCookie = await signIn('fixture_admin', firstPassword);
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
    const resetCookie = await signIn('fixture_admin', nextPassword);
    checked('concurrent redemption has one winner and reset revokes existing sessions');

    const pendingReset = await service.issueAccountLink(actor, id, 'reset');
    await service.revokeAdminAccount(actor, id);
    assert.equal(await identity(resetCookie), null);
    await expectStatus(() => service.getActivationInfo(token(pendingReset)), 410);
    assert.notEqual((await request('/api/auth/sign-in/username', { username: 'fixture_admin', password: nextPassword })).status, 200);
    await expectStatus(() => service.revokeAdminAccount(actor, actor.id), 409);
    const reinvited = await service.createAdminAccount(actor, { name: 'Integration admin', username: 'fixture_admin' });
    assert.equal(reinvited.account.status, 'pending');
    assert.notEqual((await request('/api/auth/sign-in/username', { username: 'fixture_admin', password: nextPassword })).status, 200);
    await expectStatus(() => service.getActivationInfo(token(pendingReset)), 410);
    assert.equal((await request('/api/auth/reset-password', { token: token(reinvited), newPassword: firstPassword })).status, 200);
    await signIn('fixture_admin', firstPassword);
    checked('removal revokes sessions/links, owner is protected, and reinvites require fresh activation');

    const otherSession = await signIn(actor.username, ownerPassword);
    assert.equal((await request('/api/auth/change-password', { currentPassword: ownerPassword, newPassword: nextPassword, revokeOtherSessions: false }, ownerCookie)).status, 200);
    assert.equal(await identity(otherSession), null);
    await signIn(actor.username, nextPassword);
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
    await signIn(actor.username, ownerPassword);
    checked('explicit offline owner recovery writes a working private one-use link');
    for (const message of await runCredentialRaceChecks(actor)) checked(message);
    console.log(JSON.stringify({ ok: true, checks, isolatedDatabase: databaseName }));
  } finally {
    try {
      if (ownsDatabase) {
        // The application database role permits document operations but not
        // dropDatabase. Leave empty indexed collections; remove all test data.
        await clearOwnedAuthData();
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
