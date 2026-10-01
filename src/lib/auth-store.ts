import { createHash } from 'node:crypto';
import { MongoClient, ObjectId, type Document } from 'mongodb';

export const AUTH_COLLECTIONS = {
  users: 'auth_users', sessions: 'auth_sessions', accounts: 'auth_accounts',
  verifications: 'auth_verifications', rates: 'auth_rate_limits', audit: 'auth_audit',
} as const;

export type AdminRole = 'owner' | 'admin';
export type AccessStatus = 'pending' | 'active' | 'removed';
export type AdminUserDocument = Document & {
  _id: ObjectId; name: string; email: string; role: AdminRole; accessStatus: AccessStatus;
  authLocked?: boolean; currentLinkHash?: string | null; linkExpiresAt?: Date | null;
  resetNonce?: string | null; lastLoginAt?: Date | null;
};

const globals = globalThis as typeof globalThis & { __monstajamAuthMongoClient?: MongoClient };

export function getAuthMongoClient(): MongoClient {
  if (!globals.__monstajamAuthMongoClient) {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error('Authentication database is not configured.');
    globals.__monstajamAuthMongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15_000, connectTimeoutMS: 15_000, maxPoolSize: 10,
    });
  }
  return globals.__monstajamAuthMongoClient;
}

export function getAuthDatabase() { return getAuthMongoClient().db(); }

// This is Better Auth's supported custom verification identifier hasher. Keeping
// the same function in configuration and queries avoids depending on internals.
export function hashVerificationIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('base64url');
}

export function resetIdentifier(token: string): string {
  return hashVerificationIdentifier(`reset-password:${token}`);
}

export function validResetToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-zA-Z0-9_-]{24,128}$/.test(token);
}

export async function ensureAuthIndexes() {
  const db = getAuthDatabase();
  await Promise.all([
    db.collection(AUTH_COLLECTIONS.users).createIndex({ email: 1 }, { name: 'auth_users_email_uidx', unique: true }),
    db.collection(AUTH_COLLECTIONS.users).createIndex({ role: 1 }, {
      name: 'one_immutable_owner', unique: true, partialFilterExpression: { role: 'owner' },
    }),
    db.collection(AUTH_COLLECTIONS.sessions).createIndex({ userId: 1 }, { name: 'auth_sessions_userId_idx' }),
    db.collection(AUTH_COLLECTIONS.sessions).createIndex({ token: 1 }, { name: 'auth_sessions_token_uidx', unique: true }),
    db.collection(AUTH_COLLECTIONS.sessions).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(AUTH_COLLECTIONS.accounts).createIndex({ userId: 1 }, { name: 'auth_accounts_userId_idx' }),
    db.collection(AUTH_COLLECTIONS.accounts).createIndex({ providerId: 1, accountId: 1 }),
    db.collection(AUTH_COLLECTIONS.verifications).createIndex({ identifier: 1 }, { name: 'auth_verifications_identifier_idx' }),
    db.collection(AUTH_COLLECTIONS.verifications).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(AUTH_COLLECTIONS.verifications).createIndex({ value: 1 }),
    db.collection(AUTH_COLLECTIONS.rates).createIndex({ key: 1 }, { name: 'auth_rate_limits_key_uidx', unique: true }),
    db.collection(AUTH_COLLECTIONS.rates).createIndex({ lastRequest: 1 }),
  ]);
}
