import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { attachVisitorSession, getOrCreateVisitorSession } from '@/lib/community/visitorSession';

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/community') {
    const session = getOrCreateVisitorSession(req);
    return attachVisitorSession(NextResponse.next(), session.newToken);
  }

  if (!isAdminRequest(req)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/upload/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/community', '/upload', '/upload/community'],
};
