import Image from 'next/image';
import React from 'react';

// Add real URLs here when social accounts are ready.
const SOCIAL_LINKS: { label: string; href: string; icon: React.ReactNode }[] = [];

export default function Footer() {
  return (
    <footer
      className="relative w-full overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#070707' }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-8 py-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                src="/monstajam-logo.png"
                alt="MonstaJam"
                width={36}
                height={36}
                className="rounded-full object-cover"
              />
              <span className="text-lg font-black tracking-widest text-white">
                MONSTA<span className="text-cyan-300">JAM</span>
              </span>
            </div>
            <p className="max-w-sm text-sm leading-6 text-zinc-500">
              Monsta Jam Productions: label roster, producer vault, official drops, and the records behind them.
            </p>
          </div>

          {SOCIAL_LINKS.length > 0 && (
            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-all hover:border-white/25 hover:text-white"
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">{s.icon}</svg>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="flex flex-col items-start justify-between gap-4 text-xs uppercase tracking-[0.18em] text-zinc-600 md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} Monsta Jam Productions</span>
          <span>Archive maintained for the roster.</span>
        </div>
      </div>
    </footer>
  );
}
