import { revokeAdminAccount } from '@/lib/admin-accounts';
import { accountOperation, authJSON, requireMutationOrigin, requireOwner } from '@/lib/admin-account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return accountOperation(async () => {
    requireMutationOrigin(request);
    const actor = await requireOwner(request);
    return authJSON(await revokeAdminAccount(actor, (await context.params).id));
  });
}
