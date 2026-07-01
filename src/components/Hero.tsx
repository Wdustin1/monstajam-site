'use client';

import VinylRecord from './VinylRecord';
import { PlayerTrack } from '@/context/PlayerContext';

export default function Hero({
  trackCount = 0,
  artistCount = 1,
  videoCount = 0,
  featuredTrack = null,
}: {
  trackCount?: number;
  artistCount?: number;
  videoCount?: number;
  featuredTrack?: PlayerTrack | null;
}) {
  const stats = [
    { value: `${trackCount}+`, label: 'Vault cuts' },
    ...(videoCount > 0 ? [{ value: String(videoCount), label: videoCount === 1 ? 'Video' : 'Videos' }] : []),
    { value: String(artistCount), label: artistCount === 1 ? 'Roster artist live' : 'Roster artists live' },
  ];

  return (
    <section
      className="relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-5 pb-10 pt-8 md:gap-12 md:px-8 md:pb-16 md:pt-10 lg:flex-row"
      style={{ minHeight: 'calc(100vh - 260px)' }}
    >
      <div className="absolute left-4 top-10 hidden h-28 w-px bg-white/10 md:block" />
      <div className="absolute bottom-8 right-6 hidden h-px w-44 bg-white/10 lg:block" />

      <div className="z-10 flex w-full flex-col gap-6 lg:w-1/2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.65)]" />
          Monsta Jam Productions
        </div>

        <div className="flex flex-col gap-4">
          <h1
            className="max-w-3xl font-black uppercase leading-[0.9] tracking-[-0.07em] text-white"
            style={{ fontSize: 'clamp(3rem, 10vw, 6.25rem)' }}
          >
            The Monsta Jam roster lives here.
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-300 md:text-lg">
            Producer vault, label roster, official drops, and track notes from the Monsta Jam world.
            Start with the Cold World run, then dig through the archive.
          </p>
        </div>

        <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
          <div className="border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Current drop</p>
            <p className="mt-1 text-sm font-semibold text-white">Cold World Vol. 2</p>
          </div>
          <div className="border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Produced by</p>
            <p className="mt-1 text-sm font-semibold text-white">Monsta Jam Productions</p>
          </div>
          <div className="border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Archive lane</p>
            <p className="mt-1 text-sm font-semibold text-white">Vault cuts + full songs</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <button
            onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:-translate-y-0.5 hover:bg-[#00e5ff]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none" />
            </svg>
            Open the vault
          </button>

          {videoCount > 0 && (
            <a
              href="/videos"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white no-underline transition hover:border-white/35 hover:bg-white/5"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="4" width="20" height="16" rx="3" strokeWidth="2" />
                <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
              </svg>
              Watch videos
            </a>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-5 border-t border-white/10 pt-6">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-5">
              {index > 0 && <div className="h-8 w-px bg-white/10" />}
              <div className="flex flex-col">
                <span className="text-lg font-black leading-none text-white tabular-nums">{stat.value}</span>
                <span className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-2 flex w-full justify-center lg:mt-0 lg:w-1/2 lg:justify-end lg:pl-8">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.10),transparent_68%)] blur-3xl" />
        </div>
        <div className="vinyl-scale-wrapper">
          <style>{`
            .vinyl-scale-wrapper {
              width: 315px; height: 260px;
              display: flex; align-items: center; justify-content: center;
              overflow: visible;
            }
            .vinyl-scale-wrapper > * {
              transform: scale(0.72);
              transform-origin: center center;
              flex-shrink: 0;
            }
            @media (min-width: 480px) {
              .vinyl-scale-wrapper { width: 360px; height: 294px; }
              .vinyl-scale-wrapper > * { transform: scale(0.82); }
            }
            @media (min-width: 640px) {
              .vinyl-scale-wrapper { width: 395px; height: 324px; }
              .vinyl-scale-wrapper > * { transform: scale(0.9); }
            }
            @media (min-width: 1024px) {
              .vinyl-scale-wrapper { width: 440px; height: 360px; }
              .vinyl-scale-wrapper > * { transform: scale(1); }
            }
          `}</style>
          <VinylRecord featuredTrack={featuredTrack} />
        </div>
      </div>
    </section>
  );
}
