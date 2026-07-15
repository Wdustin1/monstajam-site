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

test('signed admin sessions reject tampering, non-canonical signatures, expiry, and implausible future lifetimes', () => {
  const token = createAdminSessionToken(secret, now);
  assert.equal(verifyAdminSessionToken(token, secret, now), true);

  const parts = token.split('.');
  const signature = parts.at(-1)!;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const lastIndex = alphabet.indexOf(signature.at(-1)!);
  const equivalentLastCharacter = alphabet[(lastIndex & 0b111100) | ((lastIndex + 1) & 0b11)];
  const nonCanonicalSignature = `${signature.slice(0, -1)}${equivalentLastCharacter}`;
  assert.notEqual(nonCanonicalSignature, signature);
  assert.equal(
    Buffer.from(nonCanonicalSignature, 'base64url').equals(Buffer.from(signature, 'base64url')),
    true,
    'test fixture must decode to the same HMAC bytes',
  );
  assert.equal(
    verifyAdminSessionToken([...parts.slice(0, -1), nonCanonicalSignature].join('.'), secret, now),
    false,
  );

  const firstSignatureCharacter = signature[0] === 'A' ? 'B' : 'A';
  const significantTamper = [...parts.slice(0, -1), `${firstSignatureCharacter}${signature.slice(1)}`].join('.');
  assert.equal(verifyAdminSessionToken(significantTamper, secret, now), false);
  assert.equal(verifyAdminSessionToken(token, 'different-secret-at-least-32-chars', now), false);
  assert.equal(
    verifyAdminSessionToken(token, secret, now + (ADMIN_SESSION_MAX_AGE_SECONDS + 1) * 1000),
    false,
  );
});
