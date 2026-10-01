import { createAdminAccount, listAdminAccounts } from '@/lib/admin-accounts';
import { accountOperation, authJSON, readAuthJSON, requireMutationOrigin, requireOwner } from '@/lib/admin-account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return accountOperation(async () => authJSON(await listAdminAccounts(await requireOwner(request))));
}

export async function POST(request: Request) {
  return accountOperation(async () => {
    requireMutationOrigin(request);
    const actor = await requireOwner(request);
    return authJSON(await createAdminAccount(actor, await readAuthJSON(request)), 201);
  });
}
