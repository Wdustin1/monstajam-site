import { AdminAccountError } from './admin-accounts';
import { getAdminIdentity, isAllowedMutationOrigin } from './auth-provider';

export function privateAuthResponse(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export function authJSON(data: unknown, status = 200) {
  return privateAuthResponse(Response.json(data, { status }));
}

export async function accountOperation(work: () => Promise<Response>) {
  try { return privateAuthResponse(await work()); }
  catch (error) {
    if (error instanceof AdminAccountError) return authJSON({ error: error.message }, error.status);
    return authJSON({ error: 'Account access is temporarily unavailable. Please try again.' }, 503);
  }
}

export function requireMutationOrigin(request: Request) {
  if (!isAllowedMutationOrigin(request)) throw new AdminAccountError(403, 'This request must come from the admin site.');
}

export async function requireOwner(request: Request) {
  const identity = await getAdminIdentity(request.headers);
  if (!identity) throw new AdminAccountError(401, 'Please sign in to continue.');
  if (identity.role !== 'owner') throw new AdminAccountError(403, 'Only the owner can manage admin access.');
  return identity;
}

export async function readAuthJSON(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AdminAccountError(400, 'Send a JSON request.');
  }
  const text = await request.text();
  if (text.length > 8192) throw new AdminAccountError(413, 'The request is too large.');
  try { return JSON.parse(text); }
  catch { throw new AdminAccountError(400, 'Send a valid JSON request.'); }
}
