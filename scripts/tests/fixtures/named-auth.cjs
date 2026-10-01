/* Opted-in local fixture: real Better Auth with in-memory identity/session data.
 * Content remains read-only through privacy-prisma.cjs. No application route or
 * production environment flag disables authentication.
 */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Node preload runs before the compiled Next server. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { require: tsRequire } = require('tsx/cjs/api');
const { memoryAdapter } = require('better-auth/adapters/memory');

const databaseURL = new URL(process.env.DATABASE_URL || 'file:///missing');
const controlPath = path.resolve(process.env.MONSTAJAM_NAMED_AUTH_CONTROL || '');
const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
const authURL = new URL(process.env.BETTER_AUTH_URL || 'file:///missing');
const contentFixture = process.env.MONSTAJAM_NAMED_CONTENT_FIXTURE || 'privacy';
const expectedDatabase = contentFixture === 'admin-save' ? '/monstajam_admin_save_test' : '/monstajam_privacy_test';
if (process.env.MONSTAJAM_NAMED_AUTH_FIXTURES !== '1' ||
    databaseURL.protocol !== 'mongodb:' || databaseURL.hostname !== '127.0.0.1' ||
    databaseURL.pathname !== expectedDatabase || databaseURL.username || databaseURL.password ||
    !controlPath.startsWith(temporaryRoot) || path.basename(controlPath) !== 'control.json' ||
    authURL.hostname !== 'localhost' || authURL.username || authURL.password) {
  throw new Error('Named-auth fixtures require explicit opt-in and isolated local configuration.');
}
if (contentFixture === 'admin-save') require('./admin-save-prisma.cjs');
else if (contentFixture === 'privacy') require('./privacy-prisma.cjs');
else throw new Error('Unsupported local content fixture.');
const { createAuthProvider } = tsRequire('../../../src/lib/auth-provider.ts', __filename);
const { createInternalAccountEmail } = tsRequire('../../../src/lib/auth-store.ts', __filename);
const db = Object.fromEntries(['auth_users', 'auth_sessions', 'auth_accounts', 'auth_verifications', 'auth_rate_limits', 'auth_audit'].map((name) => [name, []]));
let lastRevoke = 0;
function refreshControls() {
  const control = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
  for (const user of db.auth_users || []) {
    const state = control.users?.[user.username];
    if (state?.accessStatus) user.accessStatus = state.accessStatus;
    if (state?.role) user.role = state.role;
    if (typeof state?.authLocked === 'boolean') user.authLocked = state.authLocked;
  }
  if (Number(control.revokeGeneration || 0) > lastRevoke) {
    const user = db.auth_users?.find((entry) => entry.username === control.revokeUsername);
    if (user) db.auth_sessions = (db.auth_sessions || []).filter((session) => session.userId !== user.id);
    lastRevoke = Number(control.revokeGeneration);
  }
  if (control.expireSession) db.auth_sessions = [];
}
const provider = createAuthProvider({
  database: memoryAdapter(db), secret: process.env.BETTER_AUTH_SECRET,
  baseURL: authURL.origin,
  onPasswordReset: async (userId) => {
    const user = db.auth_users.find((entry) => entry.id === userId);
    if (!user || user.accessStatus === 'removed') throw new Error('Fixture account cannot activate.');
    user.accessStatus = 'active';
  },
});
const ready = (async () => {
  for (const [username, role, accessStatus] of [
    ['Dustin', 'owner', 'active'],
    ['admin', 'admin', 'active'],
    ['pending', 'admin', 'pending'],
  ]) {
    await provider.api.createUser({ body: {
      email: createInternalAccountEmail(), name: username + ' fixture', password: process.env.MONSTAJAM_NAMED_AUTH_PASSWORD,
      role, data: { accessStatus, username },
    } });
  }
})();
// Wait for seeding and apply fixture-only controls before the real provider
// performs its database-backed session lookup. No cookie acceptance is mocked.
globalThis.__monstajamAuthProvider = {
  ...provider,
  handler: async (request) => { await ready; refreshControls(); return provider.handler(request); },
  api: new Proxy(provider.api, {
    get(target, key) {
      if (typeof target[key] !== 'function') return target[key];
      return async (...args) => { await ready; refreshControls(); return target[key](...args); };
    },
  }),
};
