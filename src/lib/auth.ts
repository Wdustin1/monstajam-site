import { NextRequest } from 'next/server';

/**
 * Validates the admin session cookie server-side.
 * Never exposes ADMIN_SECRET to the client.
 */
export function isAdminRequest(req: NextRequest): boolean {
  return isAdminSession(req.cookies.get('admin_session')?.value);
}

export function isAdminSession(cookie: string | undefined): boolean {
  return !!cookie && !!process.env.ADMIN_SECRET && cookie === process.env.ADMIN_SECRET;
}
