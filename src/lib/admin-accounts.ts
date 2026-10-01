import { randomBytes } from 'node:crypto';
import { ObjectId, type ClientSession } from 'mongodb';
import { z } from 'zod';
import { authBaseURL, getAuth, passwordResetContext, setupLinkDelivery, SETUP_LINK_SECONDS, type AdminIdentity } from './auth-provider';
import { AUTH_COLLECTIONS, ensureAuthIndexes, getAuthDatabase, getAuthMongoClient, resetIdentifier, validResetToken, type AdminUserDocument } from './auth-store';

export const INVALID_SETUP_LINK = 'This setup link is invalid or expired. Ask the owner for a new link.';
export class AdminAccountError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export const accountInputSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(100),
}).strict();

function userId(value: string): ObjectId {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) throw new AdminAccountError(404, 'Account not found.');
  return new ObjectId(value);
}

function ownerOnly(actor: AdminIdentity) {
  if (actor.role !== 'owner') throw new AdminAccountError(403, 'Only the owner can manage admin access.');
}

function accountView(user: AdminUserDocument, actorId: string) {
  return {
    id: user._id.toHexString(), name: user.name, email: user.email, role: user.role,
    status: user.accessStatus,
    linkExpiresAt: user.linkExpiresAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    canRevoke: user.role !== 'owner' && user._id.toHexString() !== actorId && user.accessStatus !== 'removed',
  };
}

async function audit(actorId: string, action: string, targetId: string, session?: ClientSession) {
  await getAuthDatabase().collection(AUTH_COLLECTIONS.audit).insertOne({
    actorId, action, targetId, at: new Date(),
  }, { session });
}

export async function listAdminAccounts(actor: AdminIdentity) {
  ownerOnly(actor);
  const users = await getAuthDatabase().collection<AdminUserDocument>(AUTH_COLLECTIONS.users)
    .find({ role: { $in: ['owner', 'admin'] } }).sort({ createdAt: 1 }).limit(250).toArray();
  return { accounts: users.map((user) => accountView(user, actor.id)), currentUserId: actor.id };
}

export async function createAdminAccount(actor: AdminIdentity, input: unknown) {
  ownerOnly(actor);
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) throw new AdminAccountError(422, 'Enter a valid name and email address.');
  await ensureAuthIndexes();
  const collection = getAuthDatabase().collection<AdminUserDocument>(AUTH_COLLECTIONS.users);
  const existing = await collection.findOne({ email: parsed.data.email });
  if (existing) {
    if (existing.role !== 'admin' || existing.accessStatus !== 'removed') {
      throw new AdminAccountError(409, 'An account with that email already exists. Use its existing access controls.');
    }
    const session = getAuthMongoClient().startSession();
    try {
      await session.withTransaction(async () => {
        const restored = await collection.updateOne({ _id: existing._id, role: 'admin', accessStatus: 'removed', resetNonce: null }, {
          $set: { name: parsed.data.name, accessStatus: 'pending', banned: false, authLocked: true, currentLinkHash: null, linkExpiresAt: null, updatedAt: new Date() },
          $unset: { issuingNonce: '', issuingUntil: '' },
        }, { session });
        if (restored.matchedCount !== 1) throw new AdminAccountError(409, 'A password operation is still finishing. Try again shortly.');
        await getAuthDatabase().collection(AUTH_COLLECTIONS.sessions).deleteMany({ userId: existing._id }, { session });
        await getAuthDatabase().collection(AUTH_COLLECTIONS.verifications).deleteMany({ value: existing._id.toHexString() }, { session });
        await audit(actor.id, 'account.reinvited', existing._id.toHexString(), session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } finally { await session.endSession(); }
    const link = await issueAccountLink(actor, existing._id.toHexString(), 'activate');
    const user = await collection.findOne({ _id: existing._id });
    if (!user) throw new AdminAccountError(503, 'The account could not be loaded. Refresh the account list.');
    return { account: accountView(user, actor.id), ...link };
  }
  let id: string;
  try {
    const result = await getAuth().api.createUser({ body: {
      ...parsed.data, password: randomBytes(48).toString('base64url'), role: 'admin',
      data: { accessStatus: 'pending', authLocked: false },
    } });
    id = result.user.id;
  } catch (error) {
    if (await collection.findOne({ email: parsed.data.email })) {
      throw new AdminAccountError(409, 'An account with that email already exists.');
    }
    throw error;
  }
  await audit(actor.id, 'account.invited', id);
  const link = await issueAccountLink(actor, id, 'activate');
  const user = await collection.findOne({ _id: userId(id) });
  if (!user) throw new AdminAccountError(503, 'The account could not be loaded. Refresh the account list.');
  return { account: accountView(user, actor.id), ...link };
}

// Only this server wrapper may retrieve a reset token from Better Auth's delivery
// callback. Each concurrent owner request has its own AsyncLocalStorage scope.
export async function issueAccountLink(actor: AdminIdentity, id: string, kind: 'activate' | 'reset') {
  ownerOnly(actor);
  const _id = userId(id);
  const db = getAuthDatabase();
  const users = db.collection<AdminUserDocument>(AUTH_COLLECTIONS.users);
  const expectedStatus = kind === 'activate' ? 'pending' : 'active';
  const nonce = randomBytes(24).toString('base64url');
  // Claim issuance and clear the current link first. A failure cannot leave an
  // older copied link valid. Expired issuance leases can be safely replaced.
  const user = await users.findOneAndUpdate({
    _id, accessStatus: expectedStatus, resetNonce: null,
    $or: [{ issuingUntil: { $exists: false } }, { issuingUntil: null }, { issuingUntil: { $lt: new Date() } }],
  }, { $set: {
    issuingNonce: nonce, issuingUntil: new Date(Date.now() + 60_000), currentLinkHash: null,
    linkExpiresAt: null, updatedAt: new Date(),
  } }, { returnDocument: 'after' });
  if (!user) throw new AdminAccountError(409, 'This account cannot receive that link now. Refresh and try again.');
  await db.collection(AUTH_COLLECTIONS.verifications).deleteMany({ value: id });
  const delivery: { userId: string; token?: string } = { userId: id };
  try {
    await setupLinkDelivery.run(delivery, () => getAuth().api.requestPasswordReset({ body: { email: user.email } }));
    if (!validResetToken(delivery.token)) throw new Error('The setup link was not generated.');
    const identifier = resetIdentifier(delivery.token);
    const verification = await db.collection(AUTH_COLLECTIONS.verifications).findOne({ identifier, value: id });
    if (!verification || !(verification.expiresAt instanceof Date)) throw new Error('The setup link was not stored.');
    const result = await users.updateOne({ _id, issuingNonce: nonce, accessStatus: expectedStatus }, {
      $set: { currentLinkHash: identifier, linkExpiresAt: verification.expiresAt, updatedAt: new Date() },
      $unset: { issuingNonce: '', issuingUntil: '' },
    });
    if (result.matchedCount !== 1) {
      await db.collection(AUTH_COLLECTIONS.verifications).deleteMany({ identifier });
      throw new AdminAccountError(409, 'The account changed while the link was being created. Refresh and try again.');
    }
    await audit(actor.id, kind === 'activate' ? 'account.activation-link' : 'account.reset-link', id);
    return { activationUrl: `${authBaseURL()}/upload/activate#token=${encodeURIComponent(delivery.token)}`, expiresAt: verification.expiresAt.toISOString() };
  } finally {
    await users.updateOne({ _id, issuingNonce: nonce }, { $unset: { issuingNonce: '', issuingUntil: '' } });
  }
}

export async function revokeAdminAccount(actor: AdminIdentity, id: string) {
  ownerOnly(actor);
  if (actor.id === id) throw new AdminAccountError(409, 'The owner cannot remove their own access.');
  const _id = userId(id);
  const db = getAuthDatabase();
  const session = getAuthMongoClient().startSession();
  try {
    await session.withTransaction(async () => {
      const user = await db.collection<AdminUserDocument>(AUTH_COLLECTIONS.users).findOne({ _id }, { session });
      if (!user) throw new AdminAccountError(404, 'Account not found.');
      if (user.role === 'owner') throw new AdminAccountError(409, 'The owner account cannot be removed.');
      await db.collection(AUTH_COLLECTIONS.users).updateOne({ _id, role: 'admin' }, {
        $set: { accessStatus: 'removed', banned: true, authLocked: true, currentLinkHash: null, linkExpiresAt: null, updatedAt: new Date() },
        $unset: { issuingNonce: '', issuingUntil: '' },
      }, { session });
      await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({ userId: _id }, { session });
      await db.collection(AUTH_COLLECTIONS.verifications).deleteMany({ value: id }, { session });
      await audit(actor.id, 'account.removed', id, session);
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  return { ok: true };
}

export async function getActivationInfo(token: unknown) {
  if (!validResetToken(token)) throw new AdminAccountError(410, INVALID_SETUP_LINK);
  const identifier = resetIdentifier(token);
  const db = getAuthDatabase();
  const verification = await db.collection(AUTH_COLLECTIONS.verifications).findOne({ identifier, expiresAt: { $gt: new Date() } });
  if (!verification || typeof verification.value !== 'string' || !/^[a-fA-F0-9]{24}$/.test(verification.value)) throw new AdminAccountError(410, INVALID_SETUP_LINK);
  const user = await db.collection<AdminUserDocument>(AUTH_COLLECTIONS.users).findOne({
    _id: new ObjectId(verification.value), currentLinkHash: identifier,
    accessStatus: { $in: ['pending', 'active'] }, linkExpiresAt: { $gt: new Date() },
  });
  if (!user || user.banned) throw new AdminAccountError(410, INVALID_SETUP_LINK);
  return { name: user.name, email: user.email, status: user.accessStatus as 'pending' | 'active', expiresAt: verification.expiresAt.toISOString() };
}

// A single atomic claim both invalidates every other copied link and stops all
// existing sessions before Better Auth consumes the token and hashes a password.
// If a later step fails, the account stays locked until a fresh owner-issued link
// completes; a removed account can never be unlocked by a stale reset request.
export async function claimPasswordReset(token: unknown) {
  if (!validResetToken(token)) throw new AdminAccountError(410, INVALID_SETUP_LINK);
  const identifier = resetIdentifier(token);
  const db = getAuthDatabase();
  const session = getAuthMongoClient().startSession();
  const nonce = randomBytes(24).toString('base64url');
  let id: string | undefined;
  try {
    await session.withTransaction(async () => {
      const verification = await db.collection(AUTH_COLLECTIONS.verifications).findOne({ identifier, expiresAt: { $gt: new Date() } }, { session });
      if (!verification || typeof verification.value !== 'string' || !/^[a-fA-F0-9]{24}$/.test(verification.value)) throw new AdminAccountError(410, INVALID_SETUP_LINK);
      id = verification.value;
      const _id = new ObjectId(id);
      const result = await db.collection(AUTH_COLLECTIONS.users).updateOne({
        _id, currentLinkHash: identifier, resetNonce: null, accessStatus: { $in: ['pending', 'active'] },
        banned: { $ne: true }, linkExpiresAt: { $gt: new Date() },
      }, { $set: { authLocked: true, resetNonce: nonce, currentLinkHash: null, linkExpiresAt: null, updatedAt: new Date() } }, { session });
      if (result.matchedCount !== 1) throw new AdminAccountError(410, INVALID_SETUP_LINK);
      await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({ userId: _id }, { session });
      await db.collection(AUTH_COLLECTIONS.verifications).deleteMany({ value: id, identifier: { $ne: identifier } }, { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  if (!id) throw new AdminAccountError(410, INVALID_SETUP_LINK);
  return { userId: id, nonce };
}

export async function finishPasswordReset(id: string) {
  const context = passwordResetContext.getStore();
  if (!context || context.userId !== id) throw new AdminAccountError(410, INVALID_SETUP_LINK);
  const db = getAuthDatabase();
  const session = getAuthMongoClient().startSession();
  try {
    await session.withTransaction(async () => {
      const _id = userId(id);
      const result = await db.collection(AUTH_COLLECTIONS.users).updateOne({
        _id, resetNonce: context.nonce, accessStatus: { $in: ['pending', 'active'] }, banned: { $ne: true },
      }, { $set: { accessStatus: 'active', authLocked: false, currentLinkHash: null, linkExpiresAt: null, updatedAt: new Date() } }, { session });
      if (result.matchedCount !== 1) throw new AdminAccountError(410, INVALID_SETUP_LINK);
      await db.collection(AUTH_COLLECTIONS.sessions).deleteMany({ userId: _id }, { session });
      await db.collection(AUTH_COLLECTIONS.verifications).deleteMany({ value: id }, { session });
      await audit(id, 'account.password-set', id, session);
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
}

let lastProbeCleanupMinute = -1;

export async function limitActivationProbe(request: Request, scope = 'setup', maximum = 30) {
  const minute = Math.floor(Date.now() / 60_000);
  const ip = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const key = resetIdentifier(`probe:${scope}:${ip.slice(0, 200)}:${minute}`);
  const adapter = (await getAuth().$context).adapter;
  if (lastProbeCleanupMinute !== minute) {
    lastProbeCleanupMinute = minute;
    // Invalid-account traffic does not reach Better Auth's ordinary pruning.
    // Bound maintenance work and recheck age when deleting so a concurrently
    // renewed provider bucket cannot be removed by an old read snapshot.
    try {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const expired = await adapter.findMany<{ id: string }>({ model: 'rateLimit', where: [{ field: 'lastRequest', operator: 'lt', value: cutoff }], limit: 100 });
      if (expired.length) await adapter.deleteMany({ model: 'rateLimit', where: [
        { field: 'id', operator: 'in', value: expired.map((entry) => entry.id) },
        { field: 'lastRequest', operator: 'lt', value: cutoff },
      ] });
    } catch { /* Retention maintenance must not weaken or replace the limit. */ }
  }
  if (!await adapter.findOne({ model: 'rateLimit', where: [{ field: 'key', value: key }] })) {
    try { await adapter.create({ model: 'rateLimit', data: { key, count: 0, lastRequest: Date.now() } }); }
    catch (error) {
      if (!await adapter.findOne({ model: 'rateLimit', where: [{ field: 'key', value: key }] })) throw error;
    }
  }
  const entry = await adapter.incrementOne({
    model: 'rateLimit', where: [{ field: 'key', value: key }, { field: 'count', value: maximum, operator: 'lt' }],
    increment: { count: 1 }, set: { lastRequest: Date.now() },
  });
  if (!entry) throw new AdminAccountError(429, 'Too many attempts. Please wait a minute and try again.');
}

// Never expire this lock while a password write might still be running. The
// request wrapper releases it only after Better Auth has completely returned.
export async function releasePasswordReset(claim: { userId: string; nonce: string }) {
  await (await getAuth().$context).adapter.incrementOne({
    model: 'user', where: [{ field: 'id', value: claim.userId }, { field: 'resetNonce', value: claim.nonce }],
    increment: { credentialLockVersion: 1 }, set: { resetNonce: null, updatedAt: new Date() },
  });
}

export async function claimPasswordChange(actor: AdminIdentity) {
  const nonce = randomBytes(24).toString('base64url');
  const session = getAuthMongoClient().startSession();
  try {
    await session.withTransaction(async () => {
      const result = await getAuthDatabase().collection(AUTH_COLLECTIONS.users).updateOne({
        _id: userId(actor.id), accessStatus: 'active', authLocked: { $ne: true }, banned: { $ne: true }, resetNonce: null,
      }, { $set: { resetNonce: nonce, currentLinkHash: null, linkExpiresAt: null, updatedAt: new Date() } }, { session });
      if (result.matchedCount !== 1) throw new AdminAccountError(409, 'Another password operation is in progress. Try again shortly.');
      await getAuthDatabase().collection(AUTH_COLLECTIONS.verifications).deleteMany({ value: actor.id }, { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  return { userId: actor.id, nonce };
}

// Hold the same lock before credential verification begins. Otherwise an old
// password already verified by a concurrent sign-in could mint a new session
// after a password reset had deleted all previous sessions.
export async function claimPasswordSignIn(email: string) {
  const adapter = (await getAuth().$context).adapter;
  const user = await adapter.findOne<{ id: string; role: string; accessStatus: string; authLocked?: boolean; banned?: boolean }>({
    model: 'user', where: [{ field: 'email', value: email.trim().toLowerCase() }],
  });
  if (!user || user.accessStatus !== 'active' || user.authLocked || user.banned || !['owner', 'admin'].includes(user.role)) {
    throw new AdminAccountError(401, 'Email or password is incorrect, or this account is not active.');
  }
  const nonce = randomBytes(24).toString('base64url');
  // incrementOne is the adapter's documented atomic guarded-write primitive;
  // update() alone need not preserve non-unique guards in every adapter.
  const result = await adapter.incrementOne({
    model: 'user', where: [
      { field: 'id', value: user.id }, { field: 'accessStatus', value: 'active' },
      { field: 'authLocked', value: true, operator: 'ne' }, { field: 'banned', value: true, operator: 'ne' },
      { field: 'resetNonce', value: null },
    ], increment: { credentialLockVersion: 1 }, set: { resetNonce: nonce, updatedAt: new Date() },
  });
  if (!result) throw new AdminAccountError(409, 'Another sign-in or password operation is in progress. Try again shortly.');
  return { userId: user.id, nonce };
}

export const setupLinkLifetimeSeconds = SETUP_LINK_SECONDS;
