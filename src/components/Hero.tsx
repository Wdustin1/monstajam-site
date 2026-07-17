'use client';

import Image from 'next/image';
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
  const trackTitle = featuredTrack?.title ?? 'Featured cut';
  const trackArtist = featuredTrack?.artist ?? 'Monsta Jam Productions';
  const bpm = featuredTrack?.bpm ? `${featuredTrack.bpm} BPM` : 'Private press';

  return (
    <section
      data-mobile-layout="home-hero"
      data-design-concept="cinematic-record-launch"
      aria-labelledby="record-launch-title"
      className="relative mx-auto flex min-h-[calc(100svh-6rem)] w-full max-w-[1500px] flex-col overflow-hidden px-4 pb-8 pt-5 sm:px-6 md:px-8 md:pb-14 md:pt-8"
    >
      <div
        data-hero-type="monsta-jam"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-10 z-0 select-none text-center font-black uppercase leading-[0.68] tracking-[-0.085em] text-white/[0.055] sm:top-6 lg:top-0"
        style={{ fontSize: 'clamp(5rem, 21vw, 18rem)' }}
      >
        <span className="block -translate-x-[2vw]">MONSTA</span>
        <span className="block translate-x-[4vw] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.08)]">JAM</span>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute left-[7%] top-[26%] z-0 h-px w-[86%] bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-52 z-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-28 z-0 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-[110px]" />

      <header className="relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <div className="mb-3 flex items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80 sm:text-xs">
          <span className="h-px w-8 bg-cyan-300/50" />
          Monsta Jam private press
          <span className="h-px w-8 bg-cyan-300/50" />
        </div>
        <h1 id="record-launch-title" className="max-w-4xl text-balance text-[clamp(2.2rem,10vw,6.5rem)] font-black uppercase leading-[0.82] tracking-[-0.065em] text-white">
          Cold World
          <span className="block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">Volume II</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55 sm:text-xs">
          <span>MJ-016</span>
          <span aria-hidden="true" className="text-fuchsia-300/70">◆</span>
          <span>Tyler J</span>
          <span aria-hidden="true" className="text-cyan-300/70">◆</span>
          <span>Produced by Monsta Jam</span>
        </div>
      </header>

      <div
        data-hero-stage="record-launch"
        className="relative z-10 mx-auto mt-2 h-[350px] w-full max-w-5xl flex-1 sm:mt-4 sm:h-[430px] lg:mt-0 lg:min-h-[470px]"
      >
        <div
          data-hero-sleeve="cold-world-volume-2"
          className="absolute left-1/2 top-5 z-[4] h-[176px] w-[176px] -translate-x-1/2 -rotate-[5deg] sm:top-3 sm:h-[224px] sm:w-[224px] lg:left-[20%] lg:top-20 lg:h-[290px] lg:w-[290px] lg:-translate-x-0"
        >
          <div aria-hidden="true" className="absolute -right-5 top-3 h-[90%] w-12 rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,#111_0_11%,#050505_12%_54%,#222_55%_56%,#050505_57%)] shadow-[18px_10px_34px_rgba(0,0,0,0.65)]" />
          <div className="relative h-full w-full overflow-hidden border border-white/20 bg-[#07090e] p-2 shadow-[-18px_28px_70px_rgba(0,0,0,0.75),0_0_42px_rgba(91,113,255,0.2)]">
            <Image
              src="/releases/cold-world-volume-2-cover.jpg"
              alt="Tyler J Cold World Volume 2 album sleeve"
              fill
              priority
              sizes="(max-width: 639px) 176px, (max-width: 1023px) 224px, 290px"
              className="object-cover p-2"
            />
            <span aria-hidden="true" className="absolute inset-2 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.18)_40%,transparent_56%)] opacity-30 mix-blend-screen" />
            <span className="absolute bottom-3 left-3 border border-white/15 bg-black/70 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/75 backdrop-blur-sm">MJ-016 · Limited press</span>
          </div>
        </div>

        <div className="cinematic-turntable-wrapper">
          <VinylRecord featuredTrack={featuredTrack} />
        </div>

        <div className="absolute bottom-0 left-1/2 z-30 flex min-h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap border border-cyan-200/25 bg-black/75 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_0_30px_rgba(0,229,255,0.16)] backdrop-blur-md sm:bottom-3 sm:text-xs lg:bottom-5">
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-300 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-300" />
          </span>
          DROP THE NEEDLE
        </div>
      </div>

      <footer className="relative z-30 mx-auto mt-1 grid w-full max-w-5xl grid-cols-[1fr_auto] items-center gap-3 border-y border-white/10 bg-black/25 px-3 py-3 backdrop-blur-sm sm:grid-cols-[1.4fr_0.8fr_auto] sm:px-5">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">Featured cut</p>
          <p className="truncate text-sm font-black uppercase tracking-tight text-white sm:text-base">{trackTitle}</p>
          <p className="truncate text-[11px] text-white/55">{trackArtist}</p>
        </div>
        <div className="hidden border-l border-white/10 pl-5 sm:block">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">Session data</p>
          <p className="mt-1 font-mono text-xs uppercase text-cyan-100">{bpm} · {trackCount} cuts · {artistCount} {artistCount === 1 ? 'artist' : 'artists'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex min-h-11 items-center justify-center border border-cyan-200/40 bg-cyan-200 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:-translate-y-0.5 hover:bg-white sm:px-5"
          >
            Browse crate
          </button>
          <a
            href={videoCount > 0 ? '/videos' : '/community'}
            aria-label={videoCount > 0 ? 'Watch Videos' : 'Join Community'}
            className="hidden min-h-11 items-center justify-center border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white no-underline transition hover:border-fuchsia-300/50 hover:text-fuchsia-100 md:inline-flex"
          >
            {videoCount > 0 ? 'Watch Videos' : 'Join Community'}
          </a>
        </div>
      </footer>

      <style>{`
        .cinematic-turntable-wrapper {
          position: absolute;
          left: 50%;
          bottom: 35px;
          z-index: 12;
          width: 300px; height: 204px;
          display: flex; align-items: center; justify-content: center;
          transform: translateX(-50%);
          overflow: visible;
        }
        .cinematic-turntable-wrapper > * {
          transform: scale(0.536);
          transform-origin: center center;
          flex-shrink: 0;
        }
        @media (min-width: 360px) {
          .cinematic-turntable-wrapper { width: 350px; height: 238px; }
          .cinematic-turntable-wrapper > * { transform: scale(0.625); }
        }
        @media (min-width: 480px) {
          .cinematic-turntable-wrapper { width: 430px; height: 292px; }
          .cinematic-turntable-wrapper > * { transform: scale(0.768); }
        }
        @media (min-width: 640px) {
          .cinematic-turntable-wrapper { width: 520px; height: 353px; }
          .cinematic-turntable-wrapper > * { transform: scale(0.929); }
        }
        @media (min-width: 1024px) {
          .cinematic-turntable-wrapper {
            left: auto; right: 1%; bottom: 32px;
            width: 560px; height: 380px;
            transform: none;
          }
          .cinematic-turntable-wrapper > * { transform: scale(1); }
        }
        @media (min-width: 1280px) {
          .cinematic-turntable-wrapper { right: 5%; }
        }
      `}</style>
    </section>
  );
}
