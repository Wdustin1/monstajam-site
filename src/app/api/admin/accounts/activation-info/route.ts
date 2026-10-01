import { z } from 'zod';
import { AdminAccountError, getActivationInfo, INVALID_SETUP_LINK, limitActivationProbe } from '@/lib/admin-accounts';
import { accountOperation, authJSON, readAuthJSON, requireMutationOrigin } from '@/lib/admin-account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return accountOperation(async () => {
    requireMutationOrigin(request);
    await limitActivationProbe(request);
    const parsed = z.object({ token: z.string() }).strict().safeParse(await readAuthJSON(request));
    if (!parsed.success) throw new AdminAccountError(410, INVALID_SETUP_LINK);
    return authJSON(await getActivationInfo(parsed.data.token));
  });
}
