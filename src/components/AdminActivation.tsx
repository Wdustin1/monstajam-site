'use client';

import { useEffect, useRef, useState } from 'react';
import { accountButtonClass, accountInputClass, accountPost, accountRequest } from '@/lib/admin-account-client';

type LinkInfo = { name: string; username: string; status: 'pending' | 'active'; expiresAt: string };

export default function AdminActivation() {
  const [token, setToken] = useState('');
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    if (!value) {
      setLinkError('This link is incomplete. Ask the owner for a new activation or password-reset link.');
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    let current = true;
    setToken(value);
    void accountRequest<LinkInfo>('/api/admin/accounts/activation-info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: value }), signal: controller.signal,
    }).then((result) => {
      if (!current) return;
      if (result.status !== 'pending' && result.status !== 'active') throw new Error('This account is no longer available. Ask the owner for help.');
      setInfo(result);
    }).catch((cause) => {
      if (current) setLinkError(cause instanceof Error ? cause.message : 'This link has expired or has already been used. Ask the owner for a new link.');
    }).finally(() => { if (current) setChecking(false); });
    return () => { current = false; controller.abort(); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !info || !token) return;
    setError('');
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    submitting.current = true;
    setSaving(true);
    try {
      await accountPost('/api/auth/reset-password', { token, newPassword: password });
      setPassword('');
      setConfirmation('');
      setToken('');
      window.history.replaceState(window.history.state, '', window.location.pathname);
      setFinished(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The password could not be saved. Please try again.');
    } finally { submitting.current = false; setSaving(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05000A] px-4 py-12 text-white">
      <section className="w-full max-w-md space-y-6" aria-busy={checking}>
        <h1 className="text-2xl font-semibold">{finished ? 'Your password is ready' : info?.status === 'active' ? 'Reset your password' : 'Activate your admin account'}</h1>
        {checking && <p role="status" className="text-slate-300">Checking your link…</p>}
        {linkError && <p role="alert" className="text-sm leading-6 text-rose-300">{linkError}</p>}
        {finished ? <p role="status" className="text-sm leading-6 text-slate-300">Sign in with {info?.username} and your new password.</p> : info && (
          <>
            <div className="rounded-md border border-white/15 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{info.name}</p>
              <p className="mt-1 break-all">Username: {info.username}</p>
              <p className="mt-3">This link can be used once. Choose a password for your account.</p>
            </div>
            <form onSubmit={submit}>
              <fieldset disabled={saving} aria-busy={saving} className="space-y-5">
                <div>
                  <label htmlFor="new-password" className="mb-2 block text-sm text-slate-300">New password</label>
                  <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="password-help" className={accountInputClass} />
                  <p id="password-help" className="mt-2 text-xs text-slate-400">Use at least 12 characters.</p>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm text-slate-300">Confirm new password</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={accountInputClass} />
                </div>
                {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
                <button type="submit" disabled={saving || password.length < 12 || !confirmation} className={accountButtonClass}>{saving ? 'Saving password…' : 'Save password'}</button>
              </fieldset>
            </form>
          </>
        )}
        <a href="/upload/login" className="inline-block text-sm text-cyan-300 underline underline-offset-4">{finished ? 'Sign in' : 'Back to sign in'}</a>
      </section>
    </main>
  );
}
