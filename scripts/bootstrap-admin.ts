import { randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getAuth, PASSWORD_MAX_LENGTH } from '../src/lib/auth-provider';
import { issueAccountLink, usernameInputSchema } from '../src/lib/admin-accounts';
import { AUTH_COLLECTIONS, createInternalAccountEmail, ensureAuthIndexes, getAuthDatabase, getAuthMongoClient, type AdminUserDocument } from '../src/lib/auth-store';
import { adminOperatorArguments, privateAdminOutput } from './lib/admin-operator';

// This offline command is the only way to create an owner. It never replaces an
// existing owner's credentials or links, and never sends an email.
async function main() {
  const options = adminOperatorArguments();
  const username = usernameInputSchema.parse(process.env.OWNER_USERNAME);
  const name = z.string().trim().min(1).max(100).parse(process.env.OWNER_NAME ?? process.env.OWNER_USERNAME);
  // Only this explicit offline initial-owner path permits a supplied short
  // password. Ordinary activation, reset and change keep the normal policy.
  const initialPassword = process.env.OWNER_INITIAL_PASSWORD === undefined ? undefined : z.string().min(1).max(PASSWORD_MAX_LENGTH).parse(process.env.OWNER_INITIAL_PASSWORD);
  setServers(['1.1.1.1', '8.8.8.8']);
  const db = getAuthDatabase();
  if (db.databaseName !== options.database) throw new Error('The database does not match --expect-database.');
  const users = db.collection<AdminUserDocument>(AUTH_COLLECTIONS.users);
  const owners = await users.find({ role: 'owner' }).limit(2).toArray();
  if (owners.length) {
    if (owners.length !== 1 || owners[0].username !== username) throw new Error('A different or inconsistent owner already exists. No changes were made.');
    process.stdout.write('Owner already configured. No account, password, or setup link was changed.\n');
    return;
  }
  if (await users.findOne({ username })) throw new Error('This username already belongs to an account. No changes were made.');
  if (!options.apply) {
    process.stdout.write('Dry run passed. No owner exists; creation requires --apply and a private --output file.\n');
    return;
  }
  // Reserve and secure the output before the first account write. Never replace
  // an existing file that might contain a still-valid setup link.
  const output = await privateAdminOutput(options.output!);
  try {
    await ensureAuthIndexes();
    const initialHash = initialPassword === undefined ? undefined : await (await getAuth().$context).password.hash(initialPassword);
    const created = await getAuth().api.createUser({ body: {
      name, email: createInternalAccountEmail(), role: 'owner', password: randomBytes(48).toString('base64url'),
      data: { username, accessStatus: 'pending', authLocked: false },
    } });
    const identity = { id: created.user.id, name, username, role: 'owner' as const };
    let result: object;
    if (initialHash) {
      const session = getAuthMongoClient().startSession();
      try {
        await session.withTransaction(async () => {
          const _id = new ObjectId(identity.id);
          const activated = await users.updateOne({ _id, username, role: 'owner', accessStatus: 'pending', resetNonce: null }, {
            $set: { accessStatus: 'active', authLocked: false, updatedAt: new Date() },
          }, { session });
          if (activated.matchedCount !== 1) throw new Error('The new owner changed during initialization.');
          const credential = await db.collection(AUTH_COLLECTIONS.accounts).updateOne({ userId: _id, providerId: 'credential' }, {
            $set: { password: initialHash, updatedAt: new Date() },
          }, { session });
          if (credential.matchedCount !== 1) throw new Error('The new owner credential was not found.');
          await db.collection(AUTH_COLLECTIONS.audit).insertOne({ actorId: identity.id, targetId: identity.id, action: 'account.owner-initialized', at: new Date() }, { session });
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      } finally { await session.endSession(); }
      result = { status: 'active', initialPasswordConfigured: true };
    } else result = await issueAccountLink(identity, identity.id, 'activate');
    await output.writeFile(JSON.stringify({ ownerUsername: username, ownerId: identity.id, ...result }, null, 2) + '\n');
    await output.sync();
    process.stdout.write(initialHash ? 'Owner created with the explicitly supplied initial password. The private output file contains setup confirmation only.\n' : 'Owner created. The one-use setup link was saved to the private output file and expires in one hour.\n');
  } finally { await output.close(); }
}

main().catch(() => {
  // Driver and provider errors can contain connection details. Keep CLI output
  // generic; operators can inspect the account state without printing secrets.
  process.stderr.write('Owner setup failed. No credentials or links were printed. Check the exact database, owner username, auth configuration, and unused private output path. An existing owner is never reset automatically.\n');
  process.exitCode = 1;
}).finally(async () => {
  if ((globalThis as typeof globalThis & { __monstajamAuthMongoClient?: unknown }).__monstajamAuthMongoClient) await getAuthMongoClient().close();
});
