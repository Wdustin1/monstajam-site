'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PlayerTrack, usePlayer } from '@/context/PlayerContext';
import { proxyCoverUrl } from '@/lib/proxy-cover';

export default function Hero({
  trackCount = 0,
  artistCount = 1,
  videoCount = 0,
  featuredTrack = null,
  showcaseTracks = [],
}: {
  trackCount?: number;
  artistCount?: number;
  videoCount?: number;
  featuredTrack?: PlayerTrack | null;
  showcaseTracks?: PlayerTrack[];
}) {
  const catalogTracks = showcaseTracks.length > 0
    ? showcaseTracks.slice(0, 3)
    : featuredTrack
      ? [featuredTrack]
      : [];
  const [activeTrackIndex, setActiveTrackIndex] = useState<number | null>(null);
  const { currentTrack, isPlaying, progress, toggle } = usePlayer();

  return (
    <section
      data-mobile-layout="home-hero"
      data-design-concept="living-triptych"
      aria-labelledby="monstajam-title"
      className="relative h-[calc(100svh-6rem)] min-h-[calc(100svh-6rem)] w-full overflow-hidden bg-black"
    >
      <div
        data-hero-stage="catalog-triptych"
        className={`triptych-grid ${activeTrackIndex === null ? 'triptych-active-none' : `triptych-active-${activeTrackIndex}`} absolute inset-0`}
      >
        {catalogTracks.map((track, index) => {
          const isActive = activeTrackIndex === index;
          const isTrackPlaying = currentTrack?.slug === track.slug && isPlaying;
          const cover = proxyCoverUrl(track.coverUrl) || '/monstajam-record-label.png';
          const detail = [track.genre, track.bpm ? `${track.bpm} BPM` : null]
            .filter(Boolean)
            .join(' / ');

          return (
            <button
              key={track.slug}
              type="button"
              data-release-panel
              data-panel-state={isActive ? 'active' : 'resting'}
              aria-label={`${isTrackPlaying ? 'Pause' : 'Play'} ${track.title} by ${track.artist}`}
              aria-pressed={isActive}
              onClick={() => {
                setActiveTrackIndex(index);
                toggle(track);
              }}
              className="triptych-panel group relative min-h-11 min-w-0 overflow-hidden border-b border-white/25 bg-[#080808] text-left text-white outline-none focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 md:border-b-0 md:border-r"
            >
              <Image
                src={cover}
                alt={`${track.title} by ${track.artist}`}
                fill
                priority
                sizes="(max-width: 767px) 100vw, 55vw"
                className="triptych-panel-image object-cover"
              />
              <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.92)_100%)] transition-opacity duration-500 group-hover:opacity-80" />
              <span aria-hidden="true" className="triptych-panel-wash absolute inset-0 bg-black/10 mix-blend-multiply" />
              <span aria-hidden="true" className="absolute inset-0 opacity-[0.16] [background-image:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.12)_3px)]" />

              <span className="absolute left-3 top-3 z-10 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/85 sm:left-4 sm:top-4 sm:text-[10px]">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span aria-hidden="true" className="h-px w-5 bg-white/60" />
                <span className="hidden sm:inline">Archive cut</span>
              </span>

              <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-5 md:p-6">
                {isActive && (
                  <div className="mb-2 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100 sm:text-[10px]">
                    <span className={`inline-flex h-2 w-2 rounded-full ${isTrackPlaying ? 'animate-pulse bg-fuchsia-300' : 'bg-white/65'}`} />
                    {isTrackPlaying ? 'On air / press to pause' : 'Selected / press to play'}
                  </div>
                )}
                <p className="triptych-track-title max-w-[28rem] text-balance text-xl font-black uppercase leading-[0.88] tracking-[-0.045em] text-white sm:text-2xl md:text-[clamp(1.45rem,2.7vw,3.4rem)]">
                  {track.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75 sm:text-xs">
                  <span>{track.artist}</span>
                  {detail && <span className="triptych-detail font-mono text-[9px] tracking-[0.16em] text-white/50 sm:text-[10px]">{detail}</span>}
                </div>
                {currentTrack?.slug === track.slug && (
                  <span className="mt-3 block h-[2px] w-full max-w-sm overflow-hidden bg-white/25">
                    <span className="block h-full bg-cyan-200 transition-[width] duration-200" style={{ width: `${Math.max(2, progress * 100)}%` }} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <header className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white sm:text-[10px]">
          <p className="border border-white/35 bg-black/50 px-3 py-2 backdrop-blur-md">Independent sound archive</p>
          <p className="hidden border border-white/35 bg-black/50 px-3 py-2 text-right backdrop-blur-md sm:block">
            {String(catalogTracks.length).padStart(2, '0')} cuts in view / {String(trackCount).padStart(2, '0')} total
          </p>
        </div>

        <div data-hero-type="monsta-jam" className="select-none self-center text-center text-white mix-blend-difference">
          <h1 id="monstajam-title" className="text-[clamp(4.3rem,19vw,18rem)] font-black uppercase leading-[0.64] tracking-[-0.09em]">
            <span className="block -translate-x-[3vw]">MONSTA</span>
            <span className="block translate-x-[5vw] text-transparent [-webkit-text-stroke:clamp(1px,0.16vw,3px)_white]">JAM</span>
          </h1>
          <p className="mx-auto mt-6 w-fit border border-white/45 bg-black/55 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md sm:text-[10px]">
            Tap a release to listen
          </p>
        </div>

        <div className="flex items-end justify-end">
          <a
            href="#library"
            className="pointer-events-auto inline-flex min-h-11 items-center justify-center border border-white bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-black no-underline transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5"
          >
            Browse all {trackCount}
          </a>
        </div>
      </header>

      <span aria-hidden="true" className="pointer-events-none absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rotate-90 font-mono text-[9px] uppercase tracking-[0.28em] text-white/60 lg:block">
        {artistCount} {artistCount === 1 ? 'artist' : 'artists'} / {videoCount} visual records
      </span>

      <style>{`
        .triptych-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: repeat(3, minmax(0, 1fr));
          transition: grid-template-rows 700ms cubic-bezier(.2,.85,.2,1);
        }
        .triptych-grid.triptych-active-0 { grid-template-rows: minmax(0, 2.2fr) minmax(0, .65fr) minmax(0, .65fr); }
        .triptych-grid.triptych-active-1 { grid-template-rows: minmax(0, .65fr) minmax(0, 2.2fr) minmax(0, .65fr); }
        .triptych-grid.triptych-active-2 { grid-template-rows: minmax(0, .65fr) minmax(0, .65fr) minmax(0, 2.2fr); }
        .triptych-panel-image {
          transform: scale(1.02);
          filter: saturate(.88) contrast(1.08) brightness(.72);
          transition: transform 900ms cubic-bezier(.2,.85,.2,1), filter 600ms ease;
        }
        .triptych-panel:hover .triptych-panel-image,
        .triptych-panel[data-panel-state='active'] .triptych-panel-image {
          transform: scale(1.065);
          filter: saturate(1.12) contrast(1.03) brightness(.92);
        }
        .triptych-panel[data-panel-state='resting'] .triptych-detail { display: none; }
        .triptych-panel[data-panel-state='resting'] .triptych-track-title {
          max-width: 18rem;
        }
        @media (min-width: 768px) {
          .triptych-grid {
            grid-template-rows: minmax(0, 1fr);
            grid-template-columns: repeat(3, minmax(0, 1fr));
            transition: grid-template-columns 800ms cubic-bezier(.2,.85,.2,1);
          }
          .triptych-grid.triptych-active-0 { grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 2.2fr) minmax(0, .72fr) minmax(0, .72fr); }
          .triptych-grid.triptych-active-1 { grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, .72fr) minmax(0, 2.2fr) minmax(0, .72fr); }
          .triptych-grid.triptych-active-2 { grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(0, .72fr) minmax(0, .72fr) minmax(0, 2.2fr); }
          .triptych-panel[data-panel-state='resting'] .triptych-track-title {
            font-size: clamp(1.1rem, 1.7vw, 1.75rem);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .triptych-grid,
          .triptych-panel-image {
            transition: none;
          }
          .triptych-panel:hover .triptych-panel-image,
          .triptych-panel[data-panel-state='active'] .triptych-panel-image {
            transform: scale(1.02);
          }
        }
      `}</style>
    </section>
  );
}
