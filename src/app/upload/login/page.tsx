'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { accountButtonClass, accountInputClass, accountPost } from '@/lib/admin-account-client';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setLoading(true);
    try {
      await accountPost('/api/auth/sign-in/email', { email: email.trim(), password });
      // A document boundary preserves Back/Forward protection for browsers
      // without the Navigation API when they enter the content editor.
      if (!('navigation' in window)) {
        window.location.replace('/upload');
        return;
      }
      router.push('/upload');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05000A] px-4 py-12 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/monstajam-logo.png" alt="MonstaJam" width={64} height={64} className="rounded-full" />
          <h1 className="text-2xl font-semibold">Sign in to MonstaJam</h1>
          <p className="text-sm text-slate-400">Use your individual admin account.</p>
        </div>
        <fieldset disabled={loading} className="space-y-5" aria-busy={loading}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-slate-300">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} className={accountInputClass} />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-slate-300">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={accountInputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <button type="submit" disabled={!email.trim() || !password || loading} className={`${accountButtonClass} w-full`}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </fieldset>
        <p className="text-sm leading-6 text-slate-400">Forgot your password? Ask the owner for a password-reset link.</p>
        <p className="text-sm leading-6 text-slate-400">New admin? Open the activation link shared with you by the owner.</p>
        <Link href="/" className="inline-block text-sm text-cyan-300 underline underline-offset-4">Back to the site</Link>
      </form>
    </main>
  );
}
