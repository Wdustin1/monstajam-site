import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminPassword,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Admin sign-in is unavailable' }, { status: 503 });
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
