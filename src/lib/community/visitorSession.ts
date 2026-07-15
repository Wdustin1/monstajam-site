import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const COMMUNITY_VISITOR_COOKIE = 'monstajam_visitor';
const SESSION_VERSION = 'v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function configuredVisitorSecret() {
  const secret = process.env.COMMUNITY_VISITOR_SECRET || '';
  if (secret.length < 32) {
    throw new Error('COMMUNITY_VISITOR_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function signatureFor(encodedId: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`community-visitor.${SESSION_VERSION}.${encodedId}`)
    .digest('base64url');
}

export function createVisitorSessionToken(visitorId: string, secret = configuredVisitorSecret()) {
  if (!UUID_PATTERN.test(visitorId)) throw new Error('Visitor ID must be a UUID v4.');
  const encodedId = Buffer.from(visitorId, 'utf8').toString('base64url');
  return `${SESSION_VERSION}.${encodedId}.${signatureFor(encodedId, secret)}`;
}

export function verifyVisitorSessionToken(token: string | null | undefined, secret = configuredVisitorSecret()) {
  if (!token) return null;
  const [version, encodedId, providedSignature, extra] = token.split('.');
  if (extra !== undefined || version !== SESSION_VERSION) return null;
  if (!/^[A-Za-z0-9_-]{48}$/.test(encodedId)) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(providedSignature)) return null;

  let visitorId: string;
  let provided: Buffer;
  try {
    visitorId = Buffer.from(encodedId, 'base64url').toString('utf8');
    provided = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (Buffer.from(visitorId, 'utf8').toString('base64url') !== encodedId) return null;
  if (provided.toString('base64url') !== providedSignature) return null;
  if (!UUID_PATTERN.test(visitorId)) return null;

  const expected = Buffer.from(signatureFor(encodedId, secret), 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return visitorId;
}

export function getExistingVisitorSession(request: NextRequest) {
  return verifyVisitorSessionToken(request.cookies.get(COMMUNITY_VISITOR_COOKIE)?.value);
}

export function getOrCreateVisitorSession(request: NextRequest) {
  const existing = getExistingVisitorSession(request);
  if (existing) return { visitorId: existing, newToken: null };
  const visitorId = randomUUID();
  return { visitorId, newToken: createVisitorSessionToken(visitorId) };
}

export function attachVisitorSession(response: NextResponse, newToken: string | null) {
  if (!newToken) return response;
  response.cookies.set(COMMUNITY_VISITOR_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
