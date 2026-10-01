'use client';

import { useRef, useState } from 'react';
import { accountButtonClass, accountInputClass, accountPost, type AdminIdentity } from '@/lib/admin-account-client';

export default function AdminPasswordSettings({ currentAdmin }: { currentAdmin: AdminIdentity }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setSuccess(false);
    if (newPassword !== confirmation) { setError('The passwords do not match.'); return; }
    submitting.current = true;
    setSaving(true);
    try {
      await accountPost('/api/auth/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your password could not be updated. Please try again.');
    } finally { submitting.current = false; setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-xl space-y-8">
        <a href="/upload" className="text-sm text-cyan-300 underline underline-offset-4">Back to dashboard</a>
        <header>
          <h1 className="text-3xl font-semibold">Your account</h1>
          <p className="mt-3 text-slate-300">{currentAdmin.name} · {currentAdmin.role === 'owner' ? 'Owner' : 'Admin'}</p>
          <p className="mt-1 break-all text-sm text-slate-400">Username: {currentAdmin.username}</p>
        </header>
        <form onSubmit={submit} className="rounded-lg border border-white/15 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Change password</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use at least 12 characters. Updating your password signs out your other sessions.</p>
          <fieldset disabled={saving} aria-busy={saving} className="mt-6 space-y-5">
            <div>
              <label htmlFor="current-password" className="mb-2 block text-sm text-slate-300">Current password</label>
              <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={accountInputClass} />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm text-slate-300">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={accountInputClass} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm text-slate-300">Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={accountInputClass} />
            </div>
            {error && <p role="alert" className="text-sm text-rose-300">{error} <a href="/upload/login" target="_blank" rel="noopener noreferrer" className="underline">Sign in in a new tab</a></p>}
            {success && <p role="status" className="text-sm text-emerald-300">Password updated. Your other sessions have been signed out.</p>}
            <button type="submit" disabled={saving || !currentPassword || newPassword.length < 12 || !confirmation} className={accountButtonClass}>{saving ? 'Updating password…' : 'Update password'}</button>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
