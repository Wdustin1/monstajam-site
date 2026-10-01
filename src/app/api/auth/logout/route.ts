import { NextRequest, NextResponse } from 'next/server';
import { getAuth, isAllowedMutationOrigin } from '@/lib/auth-provider';

export async function POST(req: NextRequest) {
  if (!isAllowedMutationOrigin(req)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const url = new URL(req.url);
  url.pathname = '/api/auth/sign-out';
  const headers = new Headers(req.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  const result = await getAuth().handler(new Request(url, { method: 'POST', headers, body: '{}' }));
  const res = new NextResponse(result.body, { status: result.status, headers: result.headers });
  res.headers.set('Cache-Control', 'private, no-store');
  // Expire any obsolete shared-password cookie as well as the revoked named session.
  res.cookies.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
