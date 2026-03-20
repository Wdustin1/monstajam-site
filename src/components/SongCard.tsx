'use client';

import Link from 'next/link';
import { Play, Pause, Music, Music4 } from 'lucide-react';
import { Track } from '@/lib/tracks';
import { usePlayer } from '@/context/PlayerContext';

interface SongCardProps {
  track: Track;
}

export default function SongCard({ track }: SongCardProps) {
  const { currentTrack, isPlaying, toggle } = usePlayer();
  const isActive = currentTrack?.slug === track.slug && isPlaying;

  return (
    <article className="bg-[#111114] rounded-xl p-4 flex flex-col group cursor-pointer relative min-h-[180px] border border-[rgba(255,0,255,0.8)] transition-all duration-300 hover:border-[#ff00ff] hover:shadow-[0_0_20px_rgba(255,0,255,0.5)]"
      style={{ boxShadow: isActive ? '0 0 25px rgba(255,0,255,0.6)' : '0 0 10px rgba(255,0,255,0.3)' }}
    >
      <div className="absolute top-4 right-4 text-xs font-bold text-gray-400">{track.number}</div>

      <div className="flex items-center gap-4 mb-4">
        {/* Album art */}
        <div className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 ${track.color}`} />

        {/* Play button */}
        <button
          onClick={() => toggle(track)}
          className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          aria-label={isActive ? 'Pause' : 'Play'}
        >
          {isActive ? (
            <Pause className="w-5 h-5 text-white fill-current" />
          ) : (
            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
          )}
        </button>
      </div>

      <div className="flex flex-col flex-grow">
        <Link href={`/tracks/${track.slug}`} onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold text-base truncate mb-1 text-white hover:text-[#00ffff] transition-colors">
            {track.title}{track.subtitle ? ` (${track.subtitle})` : ''}
          </h3>
        </Link>
        <p className="text-xs text-gray-400 mb-3">{track.artist}</p>

        <div className="mt-auto flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-cyan-500/50 bg-cyan-500/10 text-[10px] text-cyan-400 font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            EXCLUSIVE
          </span>
          <div className="flex gap-2">
            {track.spotifyUrl && (
              <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <Music className="w-4 h-4 text-green-500 hover:opacity-80 transition-opacity" />
              </a>
            )}
            {track.appleMusicUrl && (
              <a href={track.appleMusicUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <Music4 className="w-4 h-4 text-red-500 hover:opacity-80 transition-opacity" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
