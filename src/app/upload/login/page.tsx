'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/upload');
        router.refresh();
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05000A]">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm mx-4 flex flex-col gap-6"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <Image
            src="/monstajam-logo.png"
            alt="MonstaJam"
            width={64}
            height={64}
            className="rounded-full"
          />
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-widest text-white">
              MONSTA<span className="text-cyan-400">JAM</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
          </div>
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm text-gray-400 font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
          />
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
