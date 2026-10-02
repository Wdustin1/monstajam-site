/* Actual account components in a virtual DOM with synthetic accounts. No
 * provider, database, browser, or external network is used. */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test and scoped Next component doubles. */
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach, after } = require('node:test');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/upload/admins' });
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'HTMLAnchorElement', 'HTMLInputElement', 'HTMLDialogElement', 'location', 'navigator']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
Object.defineProperty(dom.window, 'navigation', { configurable: true, value: new dom.window.EventTarget() });
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
let network, router, root, container;
const originals = new Map();
function replaceModule(name, exports) {
  const filename = require.resolve(name);
  originals.set(filename, require.cache[filename]);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
replaceModule('next/navigation', { useRouter: () => router });
replaceModule('next/image', { __esModule: true, default: (props) => React.createElement('img', props) });
replaceModule('next/link', { __esModule: true, default: (props) => React.createElement('a', props) });
const Login = require('../../src/app/upload/login/page').default;
const Activation = require('../../src/components/AdminActivation').default;
const Accounts = require('../../src/components/AdminAccounts').default;
const PasswordSettings = require('../../src/components/AdminPasswordSettings').default;
const Dashboard = require('../../src/components/UploadDashboard').default;
const originalFetch = globalThis.fetch;
const owner = { id: 'owner', name: 'Dustin', username: 'dustin', role: 'owner' };
const expiry = '2099-01-01T12:00:00.000Z';
const setupUrl = 'http://localhost/upload/activate#token=fixture-private-token';

function response(body, status = 200) { return Response.json(body, { status }); }
async function fakeFetch(input, init = {}) {
  assert.ok(typeof input === 'string' && input.startsWith('/api/'), 'Only relative API test doubles may be called');
  const call = { url: input, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined, init };
  network.calls.push(call);
  if (network.gate && call.method !== 'GET' && !input.endsWith('activation-info')) {
    const gate = network.gate;
    network.gate = null;
    await gate.promise;
  }
  if (network.handler) {
    const result = await network.handler(call);
    if (result) return result;
  }
  if (input === '/api/admin/accounts' && call.method === 'GET') return response({ accounts: structuredClone(network.accounts), currentUserId: owner.id });
  if (input === '/api/admin/accounts/activation-info') return response({ name: 'Invited Admin', username: 'invited.admin', status: 'pending', expiresAt: expiry });
  if (input === '/api/admin/accounts' && call.method === 'POST') {
    const record = { id: 'invited', ...call.body, role: 'admin', status: 'pending', linkExpiresAt: expiry, lastLoginAt: null, canRevoke: true };
    network.accounts = [...network.accounts.filter((item) => item.username !== record.username), record];
    return response({ account: record, activationUrl: setupUrl, expiresAt: expiry }, 201);
  }
  if (input.endsWith('/link')) return response({ activationUrl: setupUrl, expiresAt: expiry });
  if (call.method === 'DELETE') {
    network.accounts = network.accounts.map((item) => input.endsWith(`/${item.id}`) ? { ...item, status: 'removed', canRevoke: false } : item);
    return response({ ok: true });
  }
  if (input === '/api/tracks?all=true' || input === '/api/videos?all=true') return response([]);
  if (input.startsWith('/api/auth/')) return response({ status: true });
  assert.fail(`Unexpected fixture route: ${input}`);
}

function button(text, scope = container) {
  const result = [...scope.querySelectorAll('button')].find((item) => item.textContent.trim() === text);
  assert.ok(result, `Missing button: ${text}`);
  return result;
}
function row(name) {
  const result = [...container.querySelectorAll('article')].find((item) => item.querySelector('h3')?.textContent.startsWith(name));
  assert.ok(result, `Missing account: ${name}`);
  return result;
}
async function render(Component, props = { currentAdmin: owner }) {
  await act(async () => { root.render(React.createElement(Component, props)); });
}
async function change(id, value) {
  const input = container.querySelector(`#${id}`);
  assert.ok(input, `Missing input: ${id}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function click(element) { await act(async () => { element.click(); }); }
async function submit() { await act(async () => { container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); }
function writes(url) { return network.calls.filter((call) => call.method !== 'GET' && (!url || call.url === url)); }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  dom.reconfigure({ url: 'http://localhost/upload/admins' });
  router = { pushes: [], refreshes: 0, push(value) { this.pushes.push(value); }, refresh() { this.refreshes++; } };
  network = { calls: [], copies: [], handler: null, gate: null, accounts: [
    { ...owner, status: 'active', linkExpiresAt: null, lastLoginAt: null, canRevoke: false },
    { id: 'active', name: 'Active Admin', username: 'active.admin', role: 'admin', status: 'active', linkExpiresAt: null, lastLoginAt: '2026-01-01T00:00:00.000Z', canRevoke: true },
    { id: 'pending', name: 'Pending Admin', username: 'pending.admin', role: 'admin', status: 'pending', linkExpiresAt: '2020-01-01T00:00:00.000Z', lastLoginAt: null, canRevoke: true },
    { id: 'removed', name: 'Removed Admin', username: 'removed.admin', role: 'admin', status: 'removed', linkExpiresAt: null, lastLoginAt: null, canRevoke: false },
  ] };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { network.copies.push(text); } } });
  globalThis.fetch = fakeFetch;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => { root.unmount(); }); container.remove(); globalThis.fetch = originalFetch; });
after(() => {
  for (const [filename, previous] of originals) { if (previous) require.cache[filename] = previous; else delete require.cache[filename]; }
  dom.window.close();
});

test('username sign-in retains credentials after failure and prevents duplicate pending submissions', async () => {
  await render(Login);
  await change('username', 'Dustin'); await change('password', 'fixture-password-123');
  network.handler = (call) => call.url === '/api/auth/sign-in/username' ? response({ message: 'Invalid username or password' }, 401) : null;
  await submit();
  assert.match(container.textContent, /Invalid username or password/);
  assert.equal(container.querySelector('#username').value, 'Dustin');
  assert.equal(container.querySelector('#password').value, 'fixture-password-123');
  network.handler = null;
  const gate = deferred(); network.gate = gate;
  await submit(); await submit();
  assert.equal(writes('/api/auth/sign-in/username').length, 2);
  assert.ok(container.querySelector('fieldset').disabled);
  await act(async () => { gate.resolve(); });
  assert.deepEqual(router.pushes, ['/upload']);
  assert.equal(router.refreshes, 1);
  assert.deepEqual(writes('/api/auth/sign-in/username')[0].body, { username: 'Dustin', password: 'fixture-password-123' });
});

test('activation reads only the fragment token, validates matching passwords, then clears the token after success', async () => {
  dom.reconfigure({ url: setupUrl });
  await render(Activation);
  const infoCall = network.calls[0];
  assert.equal(infoCall.url, '/api/admin/accounts/activation-info');
  assert.deepEqual(infoCall.body, { token: 'fixture-private-token' });
  assert.match(container.textContent, /invited.admin/);
  await change('new-password', 'fixture-password-123'); await change('confirm-password', 'different-password-123');
  await submit();
  assert.match(container.textContent, /passwords do not match/);
  assert.equal(writes('/api/auth/reset-password').length, 0);
  await change('confirm-password', 'fixture-password-123');
  const gate = deferred(); network.gate = gate;
  await submit(); await submit();
  assert.equal(writes('/api/auth/reset-password').length, 1);
  assert.ok(container.querySelector('fieldset').disabled);
  await act(async () => { gate.resolve(); });
  assert.deepEqual(writes('/api/auth/reset-password')[0].body, { token: 'fixture-private-token', newPassword: 'fixture-password-123' });
  assert.equal(dom.window.location.hash, '');
  assert.equal(container.querySelector('input[type=password]'), null);
  assert.match(container.textContent, /Sign in with invited.admin/);
  assert.equal(writes('/api/auth/sign-in/username').length, 0, 'Activation must not silently create a login session');
});

test('invalid or already-used setup link exposes no password form or account details', async () => {
  dom.reconfigure({ url: setupUrl });
  network.handler = () => response({ error: 'This setup link is invalid or expired. Ask the owner for a new link.' }, 410);
  await render(Activation);
  assert.match(container.textContent, /invalid or expired/);
  assert.equal(container.querySelector('form'), null);
  assert.doesNotMatch(container.textContent, /invited.admin/);
});

test('an incomplete link makes no lookup and a failed password reset retains its inputs for correction', async () => {
  await render(Activation);
  assert.match(container.textContent, /link is incomplete/);
  assert.equal(network.calls.length, 0);
  await act(async () => { root.unmount(); }); root = createRoot(container);
  dom.reconfigure({ url: setupUrl });
  network.handler = (call) => call.url === '/api/auth/reset-password' ? response({ message: 'Setup link expired' }, 400) : null;
  await render(Activation);
  await change('new-password', 'fixture-password-123'); await change('confirm-password', 'fixture-password-123');
  await submit();
  assert.match(container.textContent, /Setup link expired/);
  assert.equal(container.querySelector('#new-password').value, 'fixture-password-123');
  assert.equal(dom.window.location.hash, '#token=fixture-private-token');
});

test('owner list shows all account states and cannot offer owner removal', async () => {
  await render(Accounts);
  assert.match(row('Pending Admin').textContent, /Pending activation.*Link expired/s);
  assert.match(row('Removed Admin').textContent, /Removed/);
  assert.ok(button('Remove access', row('Dustin')).disabled);
  assert.equal(row('Dustin').querySelectorAll('button').length, 1);
  await click(button('Remove access', row('Dustin')));
  assert.equal(container.querySelector('dialog'), null);
  assert.equal(writes().length, 0);
});

test('invite creates one request while pending and presents a manually copied, expiring setup link', async () => {
  await render(Accounts);
  await change('invite-name', ' New Admin '); await change('invite-username', 'new.admin');
  const gate = deferred(); network.gate = gate;
  await submit(); await submit();
  assert.equal(writes('/api/admin/accounts').length, 1);
  assert.ok(container.querySelector('fieldset').disabled);
  await act(async () => { gate.resolve(); });
  assert.deepEqual(writes('/api/admin/accounts')[0].body, { name: 'New Admin', username: 'new.admin' });
  assert.equal(container.querySelector('#invite-name').value, '');
  assert.equal(container.querySelector('#setup-link').value, setupUrl);
  assert.match(container.textContent, /Share this privately/);
  assert.match(container.textContent, /2099/);
  assert.deepEqual(network.copies, []);
  await click(button('Copy link'));
  assert.deepEqual(network.copies, [setupUrl]);
  await change('invite-name', 'Another Person');
  assert.equal(container.querySelector('#invite-username').value, 'another.person', 'Successful invite restores username suggestions for the next person');
});

test('username suggestion follows the name until explicitly edited and enforces the username format', async () => {
  await render(Accounts);
  await change('invite-name', 'Dustin');
  assert.equal(container.querySelector('#invite-username').value, 'dustin');
  await change('invite-name', 'Dustin Jones');
  assert.equal(container.querySelector('#invite-username').value, 'dustin.jones');
  await change('invite-username', 'Dustin.music');
  await change('invite-name', 'Dustin J');
  assert.equal(container.querySelector('#invite-username').value, 'Dustin.music', 'A chosen username must not be replaced by later display-name edits');
  assert.equal(button('Create activation link').disabled, false);
  for (const invalid of ['ab', 'has spaces', 'name@example.invalid', 'x'.repeat(31)]) {
    await change('invite-username', invalid);
    assert.ok(button('Create activation link').disabled);
  }
  assert.equal(writes().length, 0);
});

test('failed invite preserves entered details and failed refresh preserves the loaded account list', async () => {
  await render(Accounts);
  await change('invite-name', 'Pending Person'); await change('invite-username', 'pending.person');
  network.handler = (call) => call.method === 'POST' ? response({ error: 'An invitation already exists.' }, 409) : null;
  await submit();
  assert.match(container.textContent, /invitation already exists/);
  assert.equal(container.querySelector('#invite-name').value, 'Pending Person');
  assert.equal(container.querySelector('#invite-username').value, 'pending.person');
  assert.equal(container.querySelector('#setup-link'), null);
  network.handler = (call) => call.method === 'GET' ? response({ error: 'Temporarily unavailable.' }, 503) : null;
  await click(button('Refresh accounts'));
  assert.match(container.textContent, /Temporarily unavailable/);
  assert.ok(row('Active Admin'));
  assert.equal(container.querySelector('#invite-name').value, 'Pending Person');
});

test('canceling removal sends no mutation; confirming twice while delayed revokes only that admin once', async () => {
  await render(Accounts);
  await click(button('Remove access', row('Active Admin')));
  await click(button('Keep access', container.querySelector('dialog')));
  assert.equal(writes().length, 0);
  await click(button('Remove access', row('Active Admin')));
  const gate = deferred(); network.gate = gate;
  const confirmButton = button('Remove access', container.querySelector('dialog'));
  await click(confirmButton); await click(confirmButton);
  assert.equal(writes().length, 1);
  assert.equal(writes()[0].url, '/api/admin/accounts/active');
  assert.equal(writes()[0].method, 'DELETE');
  await act(async () => { gate.resolve(); });
  assert.equal(container.querySelector('dialog'), null);
  assert.match(row('Active Admin').textContent, /Removed/);
  assert.match(row('Pending Admin').textContent, /Pending activation/);
});

test('replacement reset/activation links and removed-account reinvites use their distinct contracts', async () => {
  await render(Accounts);
  await click(button('Password-reset link', row('Active Admin')));
  assert.deepEqual(writes('/api/admin/accounts/active/link')[0].body, { kind: 'reset' });
  assert.match(container.querySelector('[aria-label="Setup link"]').textContent, /Password-reset link for active/);
  await click(button('New activation link', row('Pending Admin')));
  assert.deepEqual(writes('/api/admin/accounts/pending/link')[0].body, { kind: 'activate' });
  await click(button('Reinvite', row('Removed Admin')));
  assert.deepEqual(writes('/api/admin/accounts')[0].body, { username: 'removed.admin', name: 'Removed Admin' });
  assert.match(row('Removed Admin').textContent, /Pending activation/);
});

for (const action of ['replace', 'revoke', 'reinvite', 'invite-form']) {
  test(`an uncertain ${action} clears the same-account setup link before the request finishes`, async () => {
    await render(Accounts);
    await click(button('Password-reset link', row('Active Admin')));
    assert.equal(container.querySelector('#setup-link').value, setupUrl);
    if (action === 'reinvite' || action === 'invite-form') {
      // Another owner session may remove the account while this page is open.
      network.accounts = network.accounts.map((account) => account.id === 'active' ? { ...account, status: 'removed', canRevoke: false } : account);
      await click(button('Refresh accounts'));
    }
    if (action === 'revoke') {
      await click(button('Remove access', row('Active Admin')));
      await click(button('Keep access', container.querySelector('dialog')));
      assert.equal(container.querySelector('#setup-link').value, setupUrl, 'Canceling confirmation does not invalidate a link');
      await click(button('Remove access', row('Active Admin')));
    }
    if (action === 'invite-form') {
      await change('invite-name', 'Active Admin');
      await change('invite-username', 'ACTIVE.ADMIN');
    }
    const gate = deferred(); network.gate = gate;
    network.handler = (call) => {
      if (call.method !== 'GET') throw new TypeError('Simulated response lost after server mutation');
      return null;
    };
    if (action === 'replace') await click(button('Password-reset link', row('Active Admin')));
    else if (action === 'revoke') await click(button('Remove access', container.querySelector('dialog')));
    else if (action === 'reinvite') await click(button('Reinvite', row('Active Admin')));
    else await submit();
    assert.equal(container.querySelector('#setup-link'), null, 'Hide the old link while its validity is uncertain');
    assert.equal([...container.querySelectorAll('button')].some((item) => item.textContent === 'Copy link'), false);
    await act(async () => { gate.resolve(); });
    assert.match(container.textContent, /connection was interrupted/);
    assert.equal(container.querySelector('#setup-link'), null, 'A failed response must not restore the old link');
    assert.deepEqual(network.copies, []);
    if (action === 'replace') {
      const replacement = 'http://localhost/upload/activate#token=replacement-fixture-token';
      network.handler = (call) => call.url.endsWith('/link') ? response({ activationUrl: replacement, expiresAt: expiry }) : null;
      await click(button('Password-reset link', row('Active Admin')));
      assert.equal(container.querySelector('#setup-link').value, replacement);
      await click(button('Copy link'));
      assert.deepEqual(network.copies, [replacement], 'Only the successfully issued replacement is copied');
    }
  });
}

test('a failed link request for another account preserves the displayed account link', async () => {
  await render(Accounts);
  await click(button('Password-reset link', row('Active Admin')));
  network.handler = (call) => call.url === '/api/admin/accounts/pending/link' ? response({ error: 'Link creation unavailable.' }, 503) : null;
  await click(button('New activation link', row('Pending Admin')));
  assert.match(container.textContent, /Link creation unavailable/);
  assert.equal(container.querySelector('#setup-link').value, setupUrl);
  assert.match(container.querySelector('[aria-label="Setup link"]').textContent, /active.admin/);
});

test('a failed removal remains visible inside its dialog without claiming the account was removed', async () => {
  await render(Accounts);
  network.handler = (call) => call.method === 'DELETE' ? response({ error: 'Account change temporarily unavailable.' }, 503) : null;
  await click(button('Remove access', row('Active Admin')));
  await click(button('Remove access', container.querySelector('dialog')));
  assert.match(container.querySelector('dialog [role="alert"]').textContent, /temporarily unavailable/);
  assert.match(row('Active Admin').textContent, /Admin · Active/);
  assert.equal(network.accounts.find((account) => account.id === 'active').status, 'active');
  await click(button('Keep access', container.querySelector('dialog')));
});

test('password change preserves values on failure, sends current/new passwords once, and clears after success', async () => {
  await render(PasswordSettings, { currentAdmin: { ...owner, role: 'admin' } });
  await change('current-password', 'old-fixture-password'); await change('new-password', 'new-fixture-password'); await change('confirm-password', 'new-fixture-password');
  network.handler = () => response({ message: 'Current password is incorrect' }, 400);
  await submit();
  assert.match(container.textContent, /Current password is incorrect/);
  assert.equal(container.querySelector('#new-password').value, 'new-fixture-password');
  network.handler = null;
  const gate = deferred(); network.gate = gate;
  await submit(); await submit();
  assert.equal(writes('/api/auth/change-password').length, 2);
  await act(async () => { gate.resolve(); });
  assert.deepEqual(writes('/api/auth/change-password')[1].body, { currentPassword: 'old-fixture-password', newPassword: 'new-fixture-password', revokeOtherSessions: true });
  assert.equal(container.querySelector('#current-password').value, '');
  assert.equal(container.querySelector('#new-password').value, '');
  assert.match(container.textContent, /Password updated/);
});

test('dashboard identity links expose account settings to admins and access management only to the owner', async () => {
  let authenticatedUser = { ...owner, role: 'admin' };
  network.handler = (call) => call.url === '/api/auth/get-session'
    ? response({ user: { ...authenticatedUser, accessStatus: 'active', authLocked: false }, session: { expiresAt: expiry } })
    : null;
  await render(Dashboard, { currentAdmin: { ...owner, role: 'admin', email: 'internal-alias@example.invalid' } });
  assert.ok(container.querySelector('a[href="/upload/account"]'));
  assert.equal(container.querySelector('a[href="/upload/admins"]'), null);
  assert.match(container.textContent, /Signed in as Dustin \(dustin\) · Admin/);
  assert.doesNotMatch(container.textContent, /internal-alias/);
  authenticatedUser = owner;
  await render(Dashboard, { currentAdmin: owner });
  await click(button('Reload'));
  assert.ok(container.querySelector('a[href="/upload/admins"]'));
});
