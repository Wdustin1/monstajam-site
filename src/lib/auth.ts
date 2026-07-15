import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

const SESSION_VERSION = 'v1';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function configuredSecret(secret = process.env.ADMIN_SECRET): string | null {
  return secret && secret.length >= 16 ? secret : null;
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyAdminPassword(candidate: unknown, secret = process.env.ADMIN_SECRET): boolean {
  const configured = configuredSecret(secret);
  if (typeof candidate !== 'string' || !configured) return false;

  const candidateHash = createHash('sha256').update(candidate).digest();
  const expectedHash = createHash('sha256').update(configured).digest();
  return safeEqual(candidateHash, expectedHash);
}

export function createAdminSessionToken(
  secret = process.env.ADMIN_SECRET,
  nowMilliseconds = Date.now(),
): string {
  const configured = configuredSecret(secret);
  if (!configured) throw new Error('ADMIN_SECRET must be configured with at least 16 characters.');

  const expiresAt = Math.floor(nowMilliseconds / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const nonce = randomBytes(18).toString('base64url');
  const payload = `${SESSION_VERSION}.${expiresAt}.${nonce}`;
  const signature = createHmac('sha256', configured).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  secret = process.env.ADMIN_SECRET,
  nowMilliseconds = Date.now(),
): boolean {
  const configured = configuredSecret(secret);
  if (!token || !configured) return false;

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== SESSION_VERSION) return false;

  const [version, expiresText, nonce, providedSignature] = parts;
  const expiresAt = Number(expiresText);
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  if (expiresAt > nowSeconds + ADMIN_SESSION_MAX_AGE_SECONDS + 60) return false;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(nonce)) return false;

  if (!/^[A-Za-z0-9_-]{43}$/.test(providedSignature)) return false;

  const payload = `${version}.${expiresText}.${nonce}`;
  const expectedSignature = createHmac('sha256', configured).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(providedSignature, 'base64url');
  } catch {
    return false;
  }

  if (provided.toString('base64url') !== providedSignature) return false;
  return safeEqual(provided, expectedSignature);
}

/** Validates the signed admin session cookie server-side. */
export function isAdminRequest(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value);
}
