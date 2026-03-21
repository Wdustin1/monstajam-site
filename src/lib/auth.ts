import { NextRequest } from 'next/server';

/**
 * Validates the admin session cookie server-side.
 * Never exposes ADMIN_SECRET to the client.
 */
export function isAdminRequest(req: NextRequest): boolean {
  const cookie = req.cookies.get('admin_session')?.value;
  return !!cookie && cookie === process.env.ADMIN_SECRET;
}
