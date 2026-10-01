import { z } from 'zod';
import { getAdminIdentity, getAuth, passwordResetContext, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/auth-provider';
import { AdminAccountError, claimPasswordChange, claimPasswordReset, claimPasswordSignIn, limitActivationProbe, releasePasswordReset, usernameInputSchema } from '@/lib/admin-accounts';
import { accountOperation, authJSON, readAuthJSON, requireMutationOrigin } from '@/lib/admin-account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const newPassword = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
const invalidLogin = () => authJSON({ error: 'Username or password is incorrect, or this account is not active.' }, 401);

const privateFields = new Set(['email', 'emailVerified', 'token', 'ipAddress', 'userAgent', 'resetNonce', 'credentialLockVersion']);
function publicAuthData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicAuthData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFields.has(key)).map(([key, item]) => [key, publicAuthData(item)]));
  if (typeof value === 'string' && value.includes('@accounts.monstajam.invalid')) return '[internal account]';
  return value;
}

async function providerResponse(request: Request) {
  const response = await getAuth().handler(request);
  if (!response.headers.get('content-type')?.includes('application/json')) return authJSON({ error: 'Account access is temporarily unavailable. Please try again.' }, 503);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(publicAuthData(await response.json())), { status: response.status, headers });
}

function authPath(request: Request) { return new URL(request.url).pathname.replace(/^\/api\/auth/, ''); }

export async function GET(request: Request) {
  return accountOperation(async () => {
    if (authPath(request) !== '/get-session') return authJSON({ error: 'Not found.' }, 404);
    return providerResponse(request);
  });
}

export async function POST(request: Request) {
  return accountOperation(async () => {
    const path = authPath(request);
    if (!['/sign-in/username', '/sign-out', '/reset-password', '/change-password'].includes(path)) return authJSON({ error: 'Not found.' }, 404);
    requireMutationOrigin(request);
    if (path === '/sign-in/username') {
      await limitActivationProbe(request, 'sign-in', 5);
      const parsed = z.object({ username: usernameInputSchema, password: z.string().min(1).max(PASSWORD_MAX_LENGTH), rememberMe: z.boolean().optional() }).strict()
        .safeParse(await readAuthJSON(request.clone()));
      if (!parsed.success) throw new AdminAccountError(422, 'Enter your username and password.');
      let claim: Awaited<ReturnType<typeof claimPasswordSignIn>>;
      try { claim = await claimPasswordSignIn(parsed.data.username); }
      catch (error) {
        if (!(error instanceof AdminAccountError) || ![401, 409].includes(error.status)) throw error;
        // Keep the public result and password work comparable for unknown,
        // inactive, locked, and incorrect-password accounts.
        await (await getAuth().$context).password.hash(parsed.data.password);
        return invalidLogin();
      }
      try {
        const headers = new Headers(request.headers);
        headers.delete('content-length');
        const response = await providerResponse(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(parsed.data) }));
        return [400, 401, 403].includes(response.status) ? invalidLogin() : response;
      }
      finally { await releasePasswordReset(claim); }
    }
    if (path === '/reset-password') {
      await limitActivationProbe(request);
      const parsed = z.object({ token: z.string(), newPassword }).strict().safeParse(await readAuthJSON(request.clone()));
      if (!parsed.success) throw new AdminAccountError(422, 'Use a valid setup link and a password between 12 and 128 characters.');
      const claim = await claimPasswordReset(parsed.data.token);
      try { return await passwordResetContext.run(claim, () => providerResponse(request)); }
      finally { await releasePasswordReset(claim); }
    }
    if (path === '/change-password') {
      const identity = await getAdminIdentity(request.headers);
      if (!identity) throw new AdminAccountError(401, 'Please sign in to continue.');
      const parsed = z.object({ currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH), newPassword, revokeOtherSessions: z.boolean().optional() }).strict()
        .safeParse(await readAuthJSON(request.clone()));
      if (!parsed.success) throw new AdminAccountError(422, 'Use a password between 12 and 128 characters.');
      const claim = await claimPasswordChange(identity);
      try {
        const headers = new Headers(request.headers);
        headers.delete('content-length');
        return await providerResponse(new Request(request.url, { method: 'POST', headers, body: JSON.stringify({ ...parsed.data, revokeOtherSessions: true }) }));
      } finally { await releasePasswordReset(claim); }
    }
    return providerResponse(request);
  });
}
