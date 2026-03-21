'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlayer } from '@/context/PlayerContext';
import type { TrackWithCredits } from './MusicLibrary';

interface TrackDetailProps {
  track: TrackWithCredits;
  allTracks?: TrackWithCredits[];
}

export default function TrackDetail({ track, allTracks = [] }: TrackDetailProps) {
  const [showLyrics, setShowLyrics] = useState(false);
  const { toggle, currentTrack, isPlaying, setQueue, play } = usePlayer();

  const handlePlay = () => {
    // Set queue with all tracks so Next/Prev work
    if (allTracks.length > 0) {
      setQueue(allTracks);
    }
    toggle(track);
  };
  const isCurrentTrack = currentTrack?.slug === track.slug;

  const titleColor = track.accentCyan ? 'text-[#00ffff]' : 'text-[#ff00ff]';
  const titleShadow = track.accentCyan
    ? '0 0 10px rgba(0,255,255,0.8), 0 0 20px rgba(0,255,255,0.4)'
    : '0 0 10px rgba(255,0,255,0.8), 0 0 20px rgba(255,0,255,0.4)';

  return (
    <main className="flex-grow container mx-auto px-8 pt-28 pb-16 z-10 flex flex-col lg:flex-row gap-16 lg:gap-24 items-start justify-center max-w-7xl">
      {/* Back link */}
      <div className="absolute top-24 left-8 z-20 hidden lg:block">
        <Link
          href="/#library"
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Back to Library
        </Link>
      </div>

      {/* Left: Album Art */}
      <div className="w-full lg:w-1/2 max-w-xl mx-auto lg:mx-0 flex-shrink-0">
        <div
          className="relative rounded-2xl p-[4px]"
          style={{
            background: 'linear-gradient(135deg, #ff00ff, #00ffff)',
            boxShadow: '-10px -10px 40px rgba(255,0,255,0.4), 10px 10px 40px rgba(0,255,255,0.4)',
          }}
        >
          <div className={`w-full aspect-square rounded-[calc(1rem-4px)] ${track.color} flex items-center justify-center`}>
            {/* Placeholder art — swap with <Image> when real art is available */}
            <div className="flex flex-col items-center gap-3 opacity-60">
              <svg className="w-20 h-20 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              <span className="text-white text-sm font-bold tracking-widest uppercase">{track.artist}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Track Info */}
      <div className="w-full lg:w-1/2 flex flex-col gap-8">
        {/* Mobile back link */}
        <Link
          href="/#library"
          className="lg:hidden text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Back to Library
        </Link>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-5xl lg:text-6xl font-black uppercase leading-tight tracking-tight">
            <span
              className={`block ${titleColor}`}
              style={{ textShadow: titleShadow }}
            >
              {track.title.toUpperCase()}
            </span>
            {track.subtitle && (
              <span
                className="block text-[#ff00ff]"
                style={{ textShadow: '0 0 10px rgba(255,0,255,0.8), 0 0 20px rgba(255,0,255,0.4)' }}
              >
                ({track.subtitle.toUpperCase()})
              </span>
            )}
          </h1>
          <h2 className="text-xl font-semibold text-gray-400 uppercase tracking-widest mt-2">
            {track.artist.toUpperCase()}
          </h2>
        </div>

        {/* Story */}
        {track.story && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">The Story</h3>
            <p className="text-[#a0a0a0] text-sm leading-relaxed max-w-2xl">{track.story}</p>
          </div>
        )}

        {/* Credits */}
        {track.credits && track.credits.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Credits</h3>
            <ul className="text-[#a0a0a0] text-sm space-y-1">
              {track.credits.map((c) => (
                <li key={c.role}>
                  <span className="font-semibold text-gray-300 uppercase">{c.role}:</span> {c.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mt-2">
          <button
            onClick={handlePlay}
            className="bg-[#ff00ff] hover:bg-[#e600e6] text-black font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all"
            style={{ boxShadow: '0 0 15px rgba(255,0,255,0.6)' }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 0 25px rgba(255,0,255,0.9)')}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 0 15px rgba(255,0,255,0.6)')}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              {isCurrentTrack && isPlaying
                ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                : <path clipRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" fillRule="evenodd" />
              }
            </svg>
            {isCurrentTrack && isPlaying ? 'Pause' : 'Play Now'}
          </button>

          {track.spotifyUrl && track.spotifyUrl !== '#' && (
            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1DB954] hover:bg-[#1aa34a] text-black font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all"
              style={{ boxShadow: '0 0 15px rgba(29,185,84,0.5)' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zM20.16 9.6C16.32 7.38 9.48 7.14 5.52 8.34c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.56-1.38 12.06-1.08 16.56 1.62.54.3.72 1.02.42 1.56-.24.54-.84.72-1.68.18z" />
              </svg>
              Spotify
            </a>
          )}

          {track.appleMusicUrl && track.appleMusicUrl !== '#' && (
            <a
              href={track.appleMusicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-pink-600 to-red-500 hover:brightness-110 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all"
              style={{ boxShadow: '0 0 15px rgba(239,68,68,0.5)' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 18V5l12-2v13M9 18c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-2" />
              </svg>
              Apple Music
            </a>
          )}
        </div>

        {/* Exclusive Content — only render if there's something to show */}
        {track.story && (
          <div className="flex flex-col gap-4 mt-6">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Exclusive Content</h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setShowLyrics((v) => !v)}
                className="bg-transparent text-[#00ffff] font-bold py-3 px-8 rounded-full text-sm tracking-wider transition-all"
                style={{
                  border: '2px solid #00ffff',
                  boxShadow: '0 0 10px rgba(0,255,255,0.4), inset 0 0 10px rgba(0,255,255,0.2)',
                }}
              >
                {showLyrics ? 'Hide Lyrics' : 'View Lyrics'}
              </button>
            </div>
            {showLyrics && (
              <div
                className="rounded-2xl p-6 text-sm text-gray-300 leading-relaxed whitespace-pre-line"
                style={{
                  background: 'rgba(0,255,255,0.04)',
                  border: '1px solid rgba(0,255,255,0.15)',
                  boxShadow: 'inset 0 0 20px rgba(0,255,255,0.05)',
                }}
              >
                {track.story}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
