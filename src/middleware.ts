import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Guard all /upload routes except the login page itself
  if (pathname.startsWith('/upload') && !pathname.startsWith('/upload/login')) {
    const cookie = req.cookies.get('admin_session')?.value;
    const isValid = !!cookie && cookie === process.env.ADMIN_SECRET;

    if (!isValid) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/upload/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/upload/:path*'],
};
