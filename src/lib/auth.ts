import { NextRequest } from 'next/server';
import { getAdminIdentity, isAllowedMutationOrigin } from './auth-provider';

// Keep content authorization separate from identity storage. Tests can replace
// this dependency without bypass flags or authentication fallbacks in production.
export const adminAuthorization = { getIdentity: getAdminIdentity };

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isAllowedMutationOrigin(req)) return false;
  return Boolean(await adminAuthorization.getIdentity(req.headers));
}
