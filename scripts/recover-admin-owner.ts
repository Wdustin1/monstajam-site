import { setServers } from 'node:dns';
import { issueAccountLink, usernameInputSchema } from '../src/lib/admin-accounts';
import { AUTH_COLLECTIONS, getAuthDatabase, getAuthMongoClient, type AdminUserDocument } from '../src/lib/auth-store';
import { adminOperatorArguments, privateAdminOutput } from './lib/admin-operator';

// Explicit operator recovery is separate from idempotent bootstrap. This can
// replace an expired setup link or issue a forgotten-password link, but cannot
// bypass an in-flight credential operation or create/change the owner identity.
async function main() {
  const options = adminOperatorArguments();
  const username = usernameInputSchema.parse(process.env.OWNER_USERNAME);
  setServers(['1.1.1.1', '8.8.8.8']);
  const db = getAuthDatabase();
  if (db.databaseName !== options.database) throw new Error('The database does not match --expect-database.');
  const owners = await db.collection<AdminUserDocument>(AUTH_COLLECTIONS.users).find({ role: 'owner' }).limit(2).toArray();
  const owner = owners[0];
  if (owners.length !== 1 || owner.username !== username || !['pending', 'active'].includes(owner.accessStatus) || owner.banned) {
    throw new Error('The expected owner was not found.');
  }
  if (owner.resetNonce) throw new Error('A credential operation is still locked. Controlled operator intervention is required; this command will not clear it.');
  if (!options.apply) {
    process.stdout.write('Dry run passed. The expected owner can receive a new one-use link. Use --apply and a private --output file to replace the previous link.\n');
    return;
  }
  const output = await privateAdminOutput(options.output!);
  try {
    const actor = { id: owner._id.toHexString(), name: owner.name, username: owner.username, role: 'owner' as const };
    const link = await issueAccountLink(actor, actor.id, owner.accessStatus === 'pending' ? 'activate' : 'reset');
    await output.writeFile(JSON.stringify({ ownerUsername: username, ownerId: actor.id, ...link }, null, 2) + '\n');
    await output.sync();
    process.stdout.write('The replacement owner link was saved to the private output file. The previous link is invalid; the new link expires in one hour.\n');
  } finally { await output.close(); }
}

main().catch(() => {
  process.stderr.write('Owner recovery failed. No credentials or links were printed. Confirm the exact existing owner, database, auth configuration, unused private output path, and absence of an in-flight credential lock. This command never clears that lock.\n');
  process.exitCode = 1;
}).finally(async () => {
  if ((globalThis as typeof globalThis & { __monstajamAuthMongoClient?: unknown }).__monstajamAuthMongoClient) await getAuthMongoClient().close();
});
