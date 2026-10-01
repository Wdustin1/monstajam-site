import { randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';
import { z } from 'zod';
import { getAuth } from '../src/lib/auth-provider';
import { issueAccountLink } from '../src/lib/admin-accounts';
import { AUTH_COLLECTIONS, ensureAuthIndexes, getAuthDatabase, getAuthMongoClient, type AdminUserDocument } from '../src/lib/auth-store';
import { adminOperatorArguments, privateAdminOutput } from './lib/admin-operator';

// This offline command is the only way to create an owner. It never replaces an
// existing owner's credentials or links, and never sends an email.
async function main() {
  const options = adminOperatorArguments();
  const email = z.string().trim().email().max(254).parse(process.env.OWNER_EMAIL).toLowerCase();
  const name = z.string().trim().min(1).max(100).parse(process.env.OWNER_NAME ?? 'Site owner');
  setServers(['1.1.1.1', '8.8.8.8']);
  const db = getAuthDatabase();
  if (db.databaseName !== options.database) throw new Error('The database does not match --expect-database.');
  const users = db.collection<AdminUserDocument>(AUTH_COLLECTIONS.users);
  const owners = await users.find({ role: 'owner' }).limit(2).toArray();
  if (owners.length) {
    if (owners.length !== 1 || owners[0].email !== email) throw new Error('A different or inconsistent owner already exists. No changes were made.');
    process.stdout.write('Owner already configured. No account, password, or setup link was changed.\n');
    return;
  }
  if (await users.findOne({ email })) throw new Error('This email already belongs to an account. No changes were made.');
  if (!options.apply) {
    process.stdout.write('Dry run passed. No owner exists; creation requires --apply and a private --output file.\n');
    return;
  }
  // Reserve and secure the output before the first account write. Never replace
  // an existing file that might contain a still-valid setup link.
  const output = await privateAdminOutput(options.output!);
  try {
    await ensureAuthIndexes();
    const created = await getAuth().api.createUser({ body: {
      name, email, role: 'owner', password: randomBytes(48).toString('base64url'),
      data: { accessStatus: 'pending', authLocked: false },
    } });
    const identity = { id: created.user.id, name, email, role: 'owner' as const };
    const link = await issueAccountLink(identity, identity.id, 'activate');
    await output.writeFile(JSON.stringify({ ownerEmail: email, ownerId: identity.id, ...link }, null, 2) + '\n');
    await output.sync();
    process.stdout.write('Owner created. The one-use setup link was saved to the private output file and expires in one hour.\n');
  } finally { await output.close(); }
}

main().catch(() => {
  // Driver and provider errors can contain connection details. Keep CLI output
  // generic; operators can inspect the account state without printing secrets.
  process.stderr.write('Owner setup failed. No credentials or links were printed. Check the exact database, owner email, auth configuration, and unused private output path. An existing owner is never reset automatically.\n');
  process.exitCode = 1;
}).finally(async () => {
  if ((globalThis as typeof globalThis & { __monstajamAuthMongoClient?: unknown }).__monstajamAuthMongoClient) await getAuthMongoClient().close();
});
