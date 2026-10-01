import { z } from 'zod';
import { AdminAccountError, issueAccountLink } from '@/lib/admin-accounts';
import { accountOperation, authJSON, readAuthJSON, requireMutationOrigin, requireOwner } from '@/lib/admin-account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return accountOperation(async () => {
    requireMutationOrigin(request);
    const actor = await requireOwner(request);
    const parsed = z.object({ kind: z.enum(['activate', 'reset']) }).strict().safeParse(await readAuthJSON(request));
    if (!parsed.success) throw new AdminAccountError(422, 'Choose an activation or password reset link.');
    return authJSON(await issueAccountLink(actor, (await context.params).id, parsed.data.kind));
  });
}
