import { AsyncLocalStorage } from 'node:async_hooks';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { admin } from 'better-auth/plugins/admin';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import { AUTH_COLLECTIONS, getAuthDatabase, getAuthMongoClient, hashVerificationIdentifier, type AdminRole } from './auth-store';

export type AdminIdentity = { id: string; name: string; email: string; role: AdminRole };
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const SETUP_LINK_SECONDS = 60 * 60;

type LinkDelivery = { userId: string; token?: string };
type PasswordResetClaim = { userId: string; nonce: string };
// Next can bundle the account route and auth route separately. The cached auth
// provider's callbacks must see the same async context as either route bundle.
const asyncContexts = globalThis as typeof globalThis & {
  __monstajamSetupLinkDelivery?: AsyncLocalStorage<LinkDelivery>;
  __monstajamPasswordResetContext?: AsyncLocalStorage<PasswordResetClaim>;
};
export const setupLinkDelivery = asyncContexts.__monstajamSetupLinkDelivery ??= new AsyncLocalStorage<LinkDelivery>();
export const passwordResetContext = asyncContexts.__monstajamPasswordResetContext ??= new AsyncLocalStorage<PasswordResetClaim>();

export function authBaseURL(): string {
  const configured = process.env.BETTER_AUTH_URL;
  if (!configured) throw new Error('Authentication URL is not configured.');
  const url = new URL(configured);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('Authentication URL is invalid.');
  }
  return url.origin;
}

export function isAllowedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return origin === authBaseURL(); }
  catch { return false; }
}

export function createAuthProvider(config: {
  database: BetterAuthOptions['database']; secret: string; baseURL: string;
  onPasswordReset?: (userId: string) => Promise<void>;
}) {
  return betterAuth({
    appName: 'MonstaJam Admin', database: config.database, secret: config.secret,
    baseURL: config.baseURL, trustedOrigins: [config.baseURL],
    emailAndPassword: {
      enabled: true, disableSignUp: true, minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH, resetPasswordTokenExpiresIn: SETUP_LINK_SECONDS,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, token }) {
        const delivery = setupLinkDelivery.getStore();
        if (!delivery || delivery.userId !== user.id) throw new Error('Setup links require an owner request.');
        delivery.token = token;
      },
      async onPasswordReset({ user }) {
        if (!config.onPasswordReset) throw new Error('Password reset completion is unavailable.');
        await config.onPasswordReset(user.id);
      },
    },
    user: {
      modelName: AUTH_COLLECTIONS.users,
      additionalFields: {
        accessStatus: { type: 'string', required: true, defaultValue: 'pending', input: false },
        authLocked: { type: 'boolean', required: false, defaultValue: false, input: false },
        lastLoginAt: { type: 'date', required: false, input: false },
        resetNonce: { type: 'string', required: false, defaultValue: null, input: false, returned: false },
        credentialLockVersion: { type: 'number', required: false, defaultValue: 0, input: false, returned: false },
      },
    },
    session: {
      modelName: AUTH_COLLECTIONS.sessions, expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60, cookieCache: { enabled: false },
    },
    account: { modelName: AUTH_COLLECTIONS.accounts },
    verification: {
      modelName: AUTH_COLLECTIONS.verifications,
      storeIdentifier: { hash: async (identifier) => hashVerificationIdentifier(identifier) },
    },
    rateLimit: {
      enabled: true, storage: 'database', modelName: AUTH_COLLECTIONS.rates,
      window: 60, max: 60,
      // The reset wrapper applies a database limit before it claims a one-use
      // link. A second limiter after that claim could strand a valid account.
      customRules: { '/sign-in/email': { window: 60, max: 5 }, '/reset-password': false },
    },
    plugins: [admin({ defaultRole: 'admin', adminRoles: ['owner'], roles: { owner: adminAc, admin: userAc } })],
    databaseHooks: {
      session: {
        create: {
          async before(session, context) {
            const user = await context?.context.internalAdapter.findUserById(session.userId) as ({ accessStatus?: string; authLocked?: boolean; role?: string } | null | undefined);
            if (!user || user.accessStatus !== 'active' || user.authLocked || !['owner', 'admin'].includes(String(user.role))) {
              throw new APIError('FORBIDDEN', { message: 'This account does not have active admin access.' });
            }
          },
          async after(session, context) {
            await context?.context.internalAdapter.updateUser(session.userId, { lastLoginAt: new Date() });
          },
        },
      },
    },
    advanced: { cookiePrefix: 'monstajam_auth', defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' } },
    telemetry: { enabled: false },
  });
}

export type AuthProvider = ReturnType<typeof createAuthProvider>;
const globals = globalThis as typeof globalThis & { __monstajamAuthProvider?: AuthProvider };

export function getAuth(): AuthProvider {
  if (!globals.__monstajamAuthProvider) {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret || secret.length < 32) throw new Error('Authentication secret is not configured.');
    globals.__monstajamAuthProvider = createAuthProvider({
      database: mongodbAdapter(getAuthDatabase(), { client: getAuthMongoClient(), transaction: true }),
      secret, baseURL: authBaseURL(),
      async onPasswordReset(userId) {
        const { finishPasswordReset } = await import('./admin-accounts');
        await finishPasswordReset(userId);
      },
    });
  }
  return globals.__monstajamAuthProvider;
}

export async function getAdminIdentity(headers: Headers): Promise<AdminIdentity | null> {
  if (!/(?:^|;\s*)(?:__Secure-)?monstajam_auth\.session_token=/.test(headers.get('cookie') ?? '')) return null;
  const session = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  const user = session?.user;
  if (!user || user.accessStatus !== 'active' || user.authLocked || user.banned || (user.role !== 'owner' && user.role !== 'admin')) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
