import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';

export function proxy(req: NextRequest) {
  if (!isAdminRequest(req)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/upload/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/upload', '/upload/community'],
};
