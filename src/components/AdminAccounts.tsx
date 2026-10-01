'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { accountButtonClass, accountInputClass, accountPost, accountRequest, accountSecondaryClass, type AdminAccount, type AdminIdentity } from '@/lib/admin-account-client';

type SetupLink = { activationUrl: string; expiresAt: string; email: string; kind: 'activate' | 'reset' };
type AccountList = { accounts: AdminAccount[]; currentUserId: string };
type LinkResult = { activationUrl: string; expiresAt: string };

function dateLabel(value: string | null) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Not available' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function RevokeDialog({ account, busy, error, onCancel, onConfirm }: { account: AdminAccount; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} aria-labelledby="revoke-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-rose-300/30 bg-slate-950 p-6 text-white backdrop:bg-black/75">
      <h2 id="revoke-title" className="text-lg font-semibold">{account.status === 'pending' ? 'Cancel this invitation?' : 'Remove admin access?'}</h2>
      <p className="mt-3 break-words text-sm leading-6 text-slate-300">{account.email} will lose access immediately. Existing sessions and setup links will stop working. Their songs and videos will stay on the site.</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onCancel} className={accountSecondaryClass}>Keep access</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="rounded-md bg-rose-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? 'Removing…' : 'Remove access'}</button>
      </div>
    </dialog>
  );
}

export default function AdminAccounts({ currentAdmin }: { currentAdmin: AdminIdentity }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [setupLink, setSetupLink] = useState<SetupLink | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [confirm, setConfirm] = useState<AdminAccount | null>(null);
  const operation = useRef(false);
  const readVersion = useRef(0);
  const linkField = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const version = ++readVersion.current;
    setLoading(true);
    try {
      const result = await accountRequest<AccountList>('/api/admin/accounts');
      if (version === readVersion.current) setAccounts(result.accounts);
    } catch (cause) {
      if (version === readVersion.current) setError(cause instanceof Error ? cause.message : 'The account list could not be loaded.');
    } finally { if (version === readVersion.current) setLoading(false); }
  }, []);

  useEffect(() => {
    const version = readVersion;
    void load();
    return () => { version.current++; };
  }, [load]);

  async function mutate(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be saved.'); }
    finally { operation.current = false; setBusy(false); }
  }

  function revealLink(link: LinkResult, accountEmail: string, kind: 'activate' | 'reset') {
    setSetupLink({ ...link, email: accountEmail, kind });
    setCopyStatus('');
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    await mutate(async () => {
      const result = await accountPost<LinkResult & { account: AdminAccount }>('/api/admin/accounts', { name: name.trim(), email: email.trim() });
      revealLink(result, result.account.email, 'activate');
      setName(''); setEmail('');
      setNotice('Invitation created. Copy the link and share it directly with this person.');
      await load();
    });
  }

  async function makeLink(account: AdminAccount, kind: 'activate' | 'reset') {
    await mutate(async () => {
      const result = await accountPost<LinkResult>(`/api/admin/accounts/${encodeURIComponent(account.id)}/link`, { kind });
      revealLink(result, account.email, kind);
      setNotice('New link created. Any previous setup link for this account no longer works.');
      await load();
    });
  }

  async function reinvite(account: AdminAccount) {
    await mutate(async () => {
      const result = await accountPost<LinkResult & { account: AdminAccount }>('/api/admin/accounts', { email: account.email, name: account.name });
      revealLink(result, account.email, 'activate');
      setNotice('New invitation created. The person must set a password before signing in.');
      await load();
    });
  }

  async function revoke() {
    if (!confirm || !confirm.canRevoke) return;
    const account = confirm;
    await mutate(async () => {
      await accountRequest(`/api/admin/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
      if (setupLink?.email === account.email) setSetupLink(null);
      setConfirm(null);
      setNotice(`Access removed for ${account.email}.`);
      await load();
    });
  }

  async function copyLink() {
    if (!setupLink) return;
    try { await navigator.clipboard.writeText(setupLink.activationUrl); setCopyStatus('Link copied.'); }
    catch { linkField.current?.focus(); linkField.current?.select(); setCopyStatus('Select and copy the link below.'); }
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <nav className="flex flex-wrap gap-5 text-sm text-cyan-300">
          <a href="/upload" className="underline underline-offset-4">Back to dashboard</a>
          <a href="/upload/account" className="underline underline-offset-4">Your account</a>
        </nav>
        <header>
          <h1 className="text-3xl font-semibold">Admin access</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Signed in as {currentAdmin.email}. Admins can manage songs and videos. Only you can manage admin access.</p>
        </header>
        {error && <p role="alert" className="rounded-md border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error} <a href="/upload/login" target="_blank" rel="noopener noreferrer" className="underline">Sign in in a new tab</a></p>}
        {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
        {setupLink && (
          <section aria-label="Setup link" className="space-y-3 rounded-lg border border-cyan-400/40 bg-cyan-400/5 p-5">
            <h2 className="text-lg font-semibold">{setupLink.kind === 'activate' ? 'Activation' : 'Password-reset'} link for {setupLink.email}</h2>
            <p className="text-sm leading-6 text-slate-300">Share this privately with this person. It expires {dateLabel(setupLink.expiresAt)} and can be used once. No email has been sent.</p>
            <label htmlFor="setup-link" className="block text-sm text-slate-300">Private setup link</label>
            <input ref={linkField} id="setup-link" readOnly value={setupLink.activationUrl} onFocus={(event) => event.target.select()} className={accountInputClass} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={copyLink} className={accountButtonClass}>Copy link</button>
              <button type="button" onClick={() => setSetupLink(null)} className={accountSecondaryClass}>Hide link</button>
              {copyStatus && <span role="status" className="text-sm text-slate-300">{copyStatus}</span>}
            </div>
          </section>
        )}
        <form onSubmit={invite} className="rounded-lg border border-white/15 p-5">
          <h2 className="text-lg font-semibold">Invite an admin</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Create a personal account and share its one-hour activation link.</p>
          <fieldset disabled={busy} aria-busy={busy} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="invite-name" className="mb-2 block text-sm text-slate-300">Name</label><input id="invite-name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={accountInputClass} /></div>
            <div><label htmlFor="invite-email" className="mb-2 block text-sm text-slate-300">Email</label><input id="invite-email" type="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => setEmail(event.target.value)} className={accountInputClass} /></div>
            <div className="sm:col-span-2"><button type="submit" disabled={busy || !name.trim() || !email.trim()} className={accountButtonClass}>{busy ? 'Please wait…' : 'Create activation link'}</button></div>
          </fieldset>
        </form>
        <section aria-label="Admin accounts" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Accounts</h2>
            <button type="button" disabled={busy || loading} onClick={() => { setError(''); void load(); }} className={accountSecondaryClass}>{loading ? 'Loading…' : 'Refresh accounts'}</button>
          </div>
          {loading && accounts.length === 0 && <p role="status" className="text-sm text-slate-400">Loading accounts…</p>}
          {accounts.map((account) => (
            <article key={account.id} className="rounded-lg border border-white/15 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{account.name}{account.id === currentAdmin.id ? ' (you)' : ''}</h3>
                  <p className="mt-1 break-all text-sm text-slate-300">{account.email}</p>
                  <p className="mt-2 text-sm text-slate-400">{account.role === 'owner' ? 'Owner' : 'Admin'} · {account.status === 'active' ? 'Active' : account.status === 'pending' ? 'Pending activation' : 'Removed'}</p>
                  {account.status === 'pending' && <p className="mt-2 text-xs text-slate-400">{account.linkExpiresAt && new Date(account.linkExpiresAt).valueOf() <= Date.now() ? 'Link expired' : 'Link expires'}: {dateLabel(account.linkExpiresAt)}</p>}
                  {account.status === 'active' && <p className="mt-2 text-xs text-slate-400">Last sign-in: {dateLabel(account.lastLoginAt)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {account.role !== 'owner' && account.status === 'pending' && <button type="button" disabled={busy} onClick={() => void makeLink(account, 'activate')} className={accountSecondaryClass}>New activation link</button>}
                  {account.role !== 'owner' && account.status === 'active' && <button type="button" disabled={busy} onClick={() => void makeLink(account, 'reset')} className={accountSecondaryClass}>Password-reset link</button>}
                  {account.role !== 'owner' && account.status === 'removed' && <button type="button" disabled={busy} onClick={() => void reinvite(account)} className={accountSecondaryClass}>Reinvite</button>}
                  {account.status !== 'removed' && <button type="button" disabled={busy || !account.canRevoke || account.role === 'owner'} onClick={() => { setError(''); setConfirm(account); }} className={accountSecondaryClass}>{account.status === 'pending' ? 'Cancel invitation' : 'Remove access'}</button>}
                </div>
              </div>
              {account.role === 'owner' && <p className="mt-3 text-xs text-slate-400">Owner access cannot be removed. Change your password in Your account.</p>}
            </article>
          ))}
        </section>
      </div>
      {confirm && <RevokeDialog account={confirm} busy={busy} error={error} onCancel={() => setConfirm(null)} onConfirm={() => void revoke()} />}
    </main>
  );
}
