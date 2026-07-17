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
  return (
    <section
      data-mobile-layout="home-hero"
      className="relative mx-auto flex min-h-0 max-w-7xl flex-col items-center justify-between gap-5 px-5 pb-2 pt-6 md:gap-12 md:px-8 md:pb-16 md:pt-10 lg:min-h-[calc(100vh-260px)] lg:flex-row"
    >
      {/* Ambient glow blobs behind content */}
      <div className="absolute top-1/3 left-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute top-1/4 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.10) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* ── Left: Text ── */}
      <div className="z-10 flex w-full flex-col gap-4 md:gap-6 lg:w-1/2">

        <h1 className="font-black leading-none tracking-tight flex flex-col gap-1"
          style={{ fontSize: 'clamp(2.5rem, 10vw, 5.5rem)' }}>
          <span style={{
            background: 'linear-gradient(90deg, #00ffff, #0088ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 14px rgba(0,255,255,0.55))',
          }}>
            UNRELEASED.
          </span>
          <span style={{
            background: 'linear-gradient(90deg, #ff44ff, #aa00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 14px rgba(255,0,255,0.55))',
          }}>
            EXCLUSIVE.
          </span>
          <span style={{
            background: 'linear-gradient(90deg, #ffffff, #aaddff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(100,200,255,0.5))',
          }}>
            YOURS.
          </span>
        </h1>

        <p className="max-w-md text-base leading-relaxed text-gray-400 md:mt-2">
          Discover the beats and tracks that never made it to the mainstream.
          Curated for true fans — no algorithms, no gatekeepers.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3 md:mt-4 md:gap-4">
          {/* Explore Library — cyan glow */}
          <button
            onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 font-bold text-white transition-all hover:scale-105 min-[480px]:w-auto"
            style={{
              border: '2px solid #00e5ff',
              background: 'rgba(0,229,255,0.07)',
              boxShadow: '0 0 16px rgba(0,229,255,0.35), inset 0 0 12px rgba(0,229,255,0.08)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#00e5ff" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M10 8l6 4-6 4V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#00e5ff" stroke="none"/>
            </svg>
            Explore Library
          </button>

          {/* Keep the secondary action useful even before the first video is published. */}
          <a
            href={videoCount > 0 ? '/videos' : '/community'}
            className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 font-bold text-white no-underline transition-all hover:scale-105 min-[480px]:w-auto"
            style={{
              border: '1px solid rgba(255,0,255,0.4)',
              background: 'rgba(255,0,255,0.05)',
              boxShadow: '0 0 12px rgba(255,0,255,0.2)',
            }}
          >
            {videoCount > 0 ? (
              <svg className="w-5 h-5" fill="none" stroke="#ff44ff" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="3" strokeWidth="2"/>
                <path d="M10 9l5 3-5 3V9z" fill="#ff44ff" stroke="none"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="#ff44ff" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span style={{ color: '#ff99ff' }}>{videoCount > 0 ? 'Watch Videos' : 'Join Community'}</span>
          </a>
        </div>

        {/* Social proof strip */}
        <div className="mt-2 flex w-full items-center justify-between gap-3 border-t border-white/5 pt-5 md:gap-5 md:pt-6">
          <div className="flex flex-col">
            <span className="text-white font-black text-lg leading-none">{trackCount}</span>
            <span className="text-gray-500 text-xs mt-0.5">Exclusive Tracks</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white font-black text-lg leading-none">{videoCount}</span>
            <span className="text-gray-500 text-xs mt-0.5">Music Videos</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white font-black text-lg leading-none">{artistCount}</span>
            <span className="text-gray-500 text-xs mt-0.5">{artistCount === 1 ? 'Artist' : 'Artists'}</span>
          </div>
        </div>
      </div>

      {/* ── Right: Vinyl ── */}
      <div className="w-full lg:w-1/2 flex justify-center lg:justify-end mt-2 lg:mt-0 relative lg:pl-8">
        {/* Glow behind vinyl */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 70%)', filter: 'blur(30px)' }} />
        </div>
        {/* Scale wrapper: shrink vinyl on mobile uniformly (keeps it circular) */}
        <div className="vinyl-scale-wrapper">
          <style>{`
            .vinyl-scale-wrapper {
              width: 260px; height: 214px;
              display: flex; align-items: center; justify-content: center;
              overflow: visible;
            }
            .vinyl-scale-wrapper > * {
              transform: scale(0.58);
              transform-origin: center center;
              flex-shrink: 0;
            }
            @media (min-width: 360px) {
              .vinyl-scale-wrapper { width: 286px; height: 234px; }
              .vinyl-scale-wrapper > * { transform: scale(0.65); }
            }
            @media (min-width: 480px) {
              .vinyl-scale-wrapper { width: 320px; height: 260px; }
              .vinyl-scale-wrapper > * { transform: scale(0.72); }
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
