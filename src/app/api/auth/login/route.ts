import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminPassword,
} from '@/lib/auth';
import { getRequestAddress } from '@/lib/rateLimit';
import {
  clearSharedRateLimit,
  consumeSharedRateLimit,
  type SharedRateLimitResult,
} from '@/lib/sharedRateLimit';

type ConsumeRateLimit = (options: {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
}) => Promise<SharedRateLimitResult>;

type ClearRateLimit = (namespace: string, key: string) => Promise<void>;

function blockedLoginResponse(limit: SharedRateLimitResult) {
  return NextResponse.json(
    { error: 'Too many sign-in attempts. Try again later.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(limit.retryAfterSeconds),
      },
    },
  );
}

export function createLoginHandler({
  consume = consumeSharedRateLimit,
  clear = clearSharedRateLimit,
}: {
  consume?: ConsumeRateLimit;
  clear?: ClearRateLimit;
} = {}) {
  return async function POST(req: NextRequest) {
    if (!process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Admin sign-in is unavailable' }, { status: 503 });
    }

    const clientKey = getRequestAddress(req.headers);
    let clientLimit: SharedRateLimitResult;
    try {
      clientLimit = await consume({
        namespace: 'admin-login-client',
        key: clientKey,
        limit: 5,
        windowMs: 15 * 60 * 1000,
      });
    } catch (error) {
      console.error('Admin login rate limiter unavailable', error);
      return NextResponse.json(
        { error: 'Admin sign-in is temporarily unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!clientLimit.allowed) return blockedLoginResponse(clientLimit);

    let globalLimit: SharedRateLimitResult;
    try {
      globalLimit = await consume({
        namespace: 'admin-login-global',
        key: 'global',
        limit: 100,
        windowMs: 15 * 60 * 1000,
      });
    } catch (error) {
      console.error('Admin login rate limiter unavailable', error);
      return NextResponse.json(
        { error: 'Admin sign-in is temporarily unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!globalLimit.allowed) return blockedLoginResponse(globalLimit);

    let password: unknown;
    try {
      ({ password } = await req.json());
    } catch {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    try {
      await clear('admin-login-client', clientKey);
    } catch (error) {
      console.error('Unable to clear admin login limiter', error);
    }

    const res = NextResponse.json({ ok: true });
    res.headers.set('Cache-Control', 'no-store');
    res.cookies.set('admin_session', createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return res;
  };
}

export const POST = createLoginHandler();
