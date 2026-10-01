// Called only from the isolated real-Mongo auth integration harness. These
// barriers live in the test process; production auth code has no test bypass.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { POST } from '../../src/app/api/auth/[...all]/route';
import { authBaseURL, getAdminIdentity, getAuth, type AdminIdentity } from '../../src/lib/auth-provider';
import { AUTH_COLLECTIONS, getAuthDatabase } from '../../src/lib/auth-store';
import { AdminAccountError, createAdminAccount, getActivationInfo, issueAccountLink, revokeAdminAccount } from '../../src/lib/admin-accounts';

export async function runCredentialRaceChecks(actor: AdminIdentity): Promise<string[]> {
  const db = getAuthDatabase();
  const base = authBaseURL();
  assert.match(db.databaseName, /^monstajam_auth_test_[a-f0-9]{16}$/);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const auth = getAuth();
  const context = await auth.$context;
  const messages: string[] = [];
  const email = `credential-race-${randomBytes(6).toString('hex')}@fixture.invalid`;
  const passwords = Array.from({ length: 4 }, () => randomBytes(30).toString('base64url'));
  let phase = 'fixture account creation';

  async function request(path: string, body: object, cookie?: string) {
    // Isolate authorization/race assertions from unrelated login throttling.
    await db.collection(AUTH_COLLECTIONS.rates).deleteMany({});
    return POST(new Request(base + '/api/auth' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    }));
  }
  function cookieFrom(response: Response) {
    assert.equal(response.status, 200, 'Named sign-in must succeed');
    const cookie = response.headers.getSetCookie().find(value => value.includes('monstajam_auth.session_token='))?.split(';')[0];
    assert.ok(cookie, 'Named session cookie is required');
    return cookie;
  }
  const signIn = async (password: string) => cookieFrom(await request('/sign-in/email', { email, password }));
  const identity = (cookie: string) => getAdminIdentity(new Headers({ Cookie: cookie }));
  function token(link: { activationUrl: string }) {
    const value = new URLSearchParams(new URL(link.activationUrl).hash.slice(1)).get('token');
    assert.ok(value, 'Setup token is required');
    return value;
  }
  async function expectServiceStatus(action: () => Promise<unknown>, status: number) {
    await assert.rejects(action, (error: unknown) => error instanceof AdminAccountError && error.status === status);
  }

  async function duringVerifiedSignIn(password: string, work: (finish: () => Promise<Response>) => Promise<void>) {
    const verify = context.password.verify;
    let signalEntered!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(resolve => { signalEntered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    let paused = false;
    context.password.verify = async (input) => {
      const valid = await verify(input);
      if (!paused && valid && input.password === password) {
        paused = true;
        signalEntered();
        await gate;
      }
      return valid;
    };
    const pending = request('/sign-in/email', { email, password });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        entered,
        pending.then(() => { throw new Error('Sign-in returned before the verification barrier'); }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Verification barrier timed out')), 15_000); }),
      ]);
      await work(async () => { release(); return pending; });
    } finally {
      if (timer) clearTimeout(timer);
      release();
      context.password.verify = verify;
      await pending.catch(() => undefined);
    }
  }

  try {
    const user = (await auth.api.createUser({ body: {
      email, name: 'Credential race fixture', password: passwords[0], role: 'admin', data: { accessStatus: 'active' },
    } })).user;
    let cookie = await signIn(passwords[0]);
    let setup = await issueAccountLink(actor, user.id, 'reset');
    const firstToken = token(setup);

    phase = 'in-flight sign-in excludes reset and password change';
    let lateCookie = '';
    await duringVerifiedSignIn(passwords[0], async (finish) => {
      const reset = await request('/reset-password', { token: firstToken, newPassword: passwords[1] });
      assert.ok([409, 410].includes(reset.status), 'Reset must not overtake verified sign-in');
      const change = await request('/change-password', { currentPassword: passwords[0], newPassword: passwords[1] }, cookie);
      assert.equal(change.status, 409, 'Password change must not overtake verified sign-in');
      assert.equal((await getActivationInfo(firstToken)).status, 'active', 'A blocked reset must preserve its valid link');
      lateCookie = cookieFrom(await finish());
      assert.equal((await identity(lateCookie))?.id, user.id);
    });
    assert.equal((await request('/reset-password', { token: firstToken, newPassword: passwords[1] })).status, 200);
    assert.equal(await identity(lateCookie), null, 'Completed reset must revoke the earlier sign-in');
    assert.equal(await identity(cookie), null);
    assert.equal((await request('/sign-in/email', { email, password: passwords[0] })).status, 401);
    cookie = await signIn(passwords[1]);
    messages.push('HTTP sign-in cannot be overtaken by reset/change; completed reset revokes the earlier session');

    phase = 'password change invalidates outstanding setup links';
    setup = await issueAccountLink(actor, user.id, 'reset');
    const staleToken = token(setup);
    assert.equal((await request('/change-password', { currentPassword: passwords[1], newPassword: passwords[2] }, cookie)).status, 200);
    await expectServiceStatus(() => getActivationInfo(staleToken), 410);
    assert.equal((await request('/reset-password', { token: staleToken, newPassword: passwords[3] })).status, 410);
    assert.equal(await identity(cookie), null);
    cookie = await signIn(passwords[2]);
    messages.push('Changing a password invalidates outstanding reset links and the previous session');

    phase = 'revoke and reinvite cannot resurrect an in-flight sign-in';
    await duringVerifiedSignIn(passwords[2], async (finish) => {
      await revokeAdminAccount(actor, user.id);
      assert.equal(await identity(cookie), null);
      await expectServiceStatus(() => createAdminAccount(actor, { email, name: 'Credential race fixture' }), 409);
      const result = await finish();
      assert.notEqual(result.status, 200, 'Removed account must not finish signing in');
    });
    const reinvited = await createAdminAccount(actor, { email, name: 'Credential race fixture' });
    assert.equal(reinvited.account.status, 'pending');
    assert.notEqual((await request('/sign-in/email', { email, password: passwords[2] })).status, 200);
    assert.equal((await request('/reset-password', { token: token(reinvited), newPassword: passwords[3] })).status, 200);
    const restoredCookie = await signIn(passwords[3]);
    assert.equal((await identity(restoredCookie))?.id, user.id);
    assert.equal(await identity(cookie), null);
    messages.push('Removal blocks an in-flight login; reinvitation waits and requires a fresh activation');

    phase = 'invalid-login responses do not reveal account state';
    const failures = [
      await request('/sign-in/email', { email, password: passwords[0] }),
      await request('/sign-in/email', { email: `missing-${randomBytes(6).toString('hex')}@fixture.invalid`, password: passwords[0] }),
    ];
    await revokeAdminAccount(actor, user.id);
    failures.push(await request('/sign-in/email', { email, password: passwords[3] }));
    await createAdminAccount(actor, { email, name: 'Credential race fixture' });
    failures.push(await request('/sign-in/email', { email, password: passwords[3] }));
    assert.ok(failures.every(response => response.status === 401));
    const bodies = await Promise.all(failures.map(response => response.json()));
    for (const body of bodies) assert.deepEqual(body, bodies[0]);
    assert.equal((await db.collection(AUTH_COLLECTIONS.users).findOne({ email }))?.resetNonce, null);
    messages.push('Unknown, removed, pending and incorrect-password logins return the same generic response');
    return messages;
  } catch {
    // Never include credential values, response bodies, tokens, or connection
    // details in assertions surfaced by the integration harness.
    throw new Error(`Credential race regression failed at: ${phase}.`);
  }
}
