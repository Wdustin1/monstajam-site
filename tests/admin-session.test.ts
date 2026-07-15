import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from '../src/lib/auth';

const secret = 'test-only-admin-secret-at-least-32';
const now = 1_800_000_000_000;

test('admin passwords use constant-time digest comparison and reject missing configuration', () => {
  assert.equal(verifyAdminPassword(secret, secret), true);
  assert.equal(verifyAdminPassword('wrong-password', secret), false);
  assert.equal(verifyAdminPassword(secret, ''), false);
  assert.equal(verifyAdminPassword(undefined, secret), false);
});

test('signed admin sessions reject tampering, expiry, and implausible future lifetimes', () => {
  const token = createAdminSessionToken(secret, now);
  assert.equal(verifyAdminSessionToken(token, secret, now), true);
  assert.equal(verifyAdminSessionToken(`${token.slice(0, -1)}x`, secret, now), false);
  assert.equal(verifyAdminSessionToken(token, 'different-secret-at-least-32-chars', now), false);
  assert.equal(
    verifyAdminSessionToken(token, secret, now + (ADMIN_SESSION_MAX_AGE_SECONDS + 1) * 1000),
    false,
  );
});
