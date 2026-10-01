import { z } from 'zod';
import { getAdminIdentity, getAuth, passwordResetContext, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/auth-provider';
import { AdminAccountError, claimPasswordChange, claimPasswordReset, claimPasswordSignIn, limitActivationProbe, releasePasswordReset } from '@/lib/admin-accounts';
import { accountOperation, authJSON, readAuthJSON, requireMutationOrigin } from '@/lib/admin-account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const newPassword = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
const invalidLogin = () => authJSON({ error: 'Email or password is incorrect, or this account is not active.' }, 401);

function authPath(request: Request) { return new URL(request.url).pathname.replace(/^\/api\/auth/, ''); }

export async function GET(request: Request) {
  return accountOperation(async () => {
    if (authPath(request) !== '/get-session') return authJSON({ error: 'Not found.' }, 404);
    return getAuth().handler(request);
  });
}

export async function POST(request: Request) {
  return accountOperation(async () => {
    const path = authPath(request);
    if (!['/sign-in/email', '/sign-out', '/reset-password', '/change-password'].includes(path)) return authJSON({ error: 'Not found.' }, 404);
    requireMutationOrigin(request);
    if (path === '/sign-in/email') {
      await limitActivationProbe(request, 'sign-in', 5);
      const parsed = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(PASSWORD_MAX_LENGTH), rememberMe: z.boolean().optional() }).strict()
        .safeParse(await readAuthJSON(request.clone()));
      if (!parsed.success) throw new AdminAccountError(422, 'Enter your email address and password.');
      let claim: Awaited<ReturnType<typeof claimPasswordSignIn>>;
      try { claim = await claimPasswordSignIn(parsed.data.email); }
      catch (error) {
        if (!(error instanceof AdminAccountError) || ![401, 409].includes(error.status)) throw error;
        // Keep the public result and password work comparable for unknown,
        // inactive, locked, and incorrect-password accounts.
        await (await getAuth().$context).password.hash(parsed.data.password);
        return invalidLogin();
      }
      try {
        const response = await getAuth().handler(request);
        return [400, 401, 403].includes(response.status) ? invalidLogin() : response;
      }
      finally { await releasePasswordReset(claim); }
    }
    if (path === '/reset-password') {
      await limitActivationProbe(request);
      const parsed = z.object({ token: z.string(), newPassword }).strict().safeParse(await readAuthJSON(request.clone()));
      if (!parsed.success) throw new AdminAccountError(422, 'Use a valid setup link and a password between 12 and 128 characters.');
      const claim = await claimPasswordReset(parsed.data.token);
      try { return await passwordResetContext.run(claim, () => getAuth().handler(request)); }
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
        return await getAuth().handler(new Request(request.url, { method: 'POST', headers, body: JSON.stringify({ ...parsed.data, revokeOtherSessions: true }) }));
      } finally { await releasePasswordReset(claim); }
    }
    return getAuth().handler(request);
  });
}
