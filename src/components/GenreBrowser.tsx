'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePlayer } from '@/context/PlayerContext';

interface Track {
  id: string;
  slug: string;
  number: number;
  title: string;
  subtitle: string | null;
  artist: string;
  genre: string;
  bpm: number | null;
  mood: string | null;
  color: string;
  accentCyan: boolean | null;
  story: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  published: boolean;
}

interface GenreBrowserProps {
  tracks: Track[];
}

export default function GenreBrowser({ tracks }: GenreBrowserProps) {
  const [activeGenre, setActiveGenre] = useState('All');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toggle, currentTrack, isPlaying, setQueue } = usePlayer();

  // Derive genre list from actual tracks
  const genres = ['All', ...Array.from(new Set(tracks.map(t => t.genre))).sort()];

  const filtered = activeGenre === 'All'
    ? tracks
    : tracks.filter(t => t.genre === activeGenre);

  const handlePlay = (track: Track) => {
    setQueue(filtered);
    toggle(track);
  };

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-[calc(100vh-200px)]">

      {/* ── Mobile genre selector ── */}
      <div className="md:hidden px-6 pb-4">
        <button
          onClick={() => setMobileMenuOpen(v => !v)}
          className="flex items-center justify-between w-full px-4 py-3 rounded-xl border text-sm font-medium text-white"
          style={{ borderColor: '#b026ff', background: 'rgba(176,38,255,0.1)' }}
        >
          <span>{activeGenre === 'All' ? 'All Genres' : activeGenre}</span>
          <svg className={`w-4 h-4 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
        {mobileMenuOpen && (
          <div className="mt-1 rounded-xl border border-white/10 overflow-hidden" style={{ background: '#0e0e14' }}>
            {genres.map(g => (
              <button
                key={g}
                onClick={() => { setActiveGenre(g); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${activeGenre === g ? 'text-[#b026ff]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col pl-8 pr-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <h2 className="text-gray-500 text-xs font-semibold tracking-widest mb-4 uppercase mt-2">Genres</h2>
        <ul className="space-y-2">
          {genres.map((g) => (
            <li key={g}>
              <button
                onClick={() => setActiveGenre(g)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-medium transition-all text-left text-sm ${
                  activeGenre === g
                    ? 'border text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={activeGenre === g ? {
                  borderColor: '#b026ff',
                  boxShadow: '0 0 10px rgba(176,38,255,0.5), inset 0 0 10px rgba(176,38,255,0.2)',
                } : {}}
              >
                <span>{g}</span>
                {activeGenre !== g && (
                  <div className="w-3 h-[3px] rounded-full" style={{ background: 'rgba(176,38,255,0.5)' }} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main grid ── */}
      <main className="flex-1 overflow-y-auto px-6 md:pr-10" style={{ scrollbarWidth: 'none' }}>
        <h1 className="text-3xl font-bold mb-2 text-white tracking-wide">
          {activeGenre === 'All' ? 'All Genres' : activeGenre}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {filtered.length} track{filtered.length !== 1 ? 's' : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            No tracks in this genre yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
            {filtered.map((track) => {
              const isActive = currentTrack?.slug === track.slug;
              return (
                <div
                  key={track.slug}
                  className="group rounded-2xl overflow-hidden border border-transparent hover:border-white/10 transition-all cursor-pointer"
                  style={{ backgroundColor: '#1a1a20' }}
                >
                  {/* Cover */}
                  <div className={`relative w-full aspect-square ${track.color} flex items-center justify-center`}>
                    {track.coverUrl ? (
                      <Image
                        src={track.coverUrl}
                        alt={track.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <svg className="w-10 h-10 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                      <button
                        onClick={() => handlePlay(track)}
                        className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                        style={{ background: '#ff00ff', boxShadow: '0 0 20px rgba(255,0,255,0.8)' }}
                        aria-label={`Play ${track.title}`}
                      >
                        {isActive && isPlaying ? (
                          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {isActive && isPlaying && (
                      <div
                        className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse z-10"
                        style={{ background: '#ff00ff', boxShadow: '0 0 8px #ff00ff' }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <Link href={`/tracks/${track.slug}`} className="block hover:text-[#ff00ff] transition-colors">
                      <h3 className="font-bold text-white text-sm leading-tight truncate">{track.title}</h3>
                    </Link>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{track.artist}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: 'rgba(176,38,255,0.15)', color: '#b026ff', border: '1px solid rgba(176,38,255,0.3)' }}
                      >
                        {track.genre}
                      </span>
                      {track.bpm && (
                        <span className="text-[10px] text-gray-500">{track.bpm} BPM</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
