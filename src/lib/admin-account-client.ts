export type AdminIdentity = { id: string; name: string; email: string; role: 'owner' | 'admin' };

export type AdminAccount = AdminIdentity & {
  status: 'pending' | 'active' | 'removed';
  linkExpiresAt: string | null;
  lastLoginAt: string | null;
  canRevoke: boolean;
};

export const accountInputClass = 'w-full rounded-md border border-white/15 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-60';
export const accountButtonClass = 'rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
export const accountSecondaryClass = 'rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';

export async function accountRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(30_000) });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('The connection was interrupted. Check the current status before retrying.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many attempts. Please wait a moment and try again.');
    const message = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : null;
    throw new Error(message || (response.status === 401 ? 'Please sign in again to continue.' : response.status === 403 ? 'Your account does not have permission for this action.' : 'The request failed. Please try again.'));
  }
  if (!body) throw new Error('The server response was interrupted. Check the current status before retrying.');
  return body as T;
}

export function accountPost<T>(url: string, body: object): Promise<T> {
  return accountRequest<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
