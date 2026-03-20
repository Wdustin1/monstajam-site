'use client';

import Link from 'next/link';
import { Play, Pause, Music, Music4 } from 'lucide-react';
import type { TrackWithCredits } from './MusicLibrary';
import { usePlayer } from '@/context/PlayerContext';

interface SongCardProps {
  track: TrackWithCredits;
}

// Album art with hover play overlay
function AlbumArt({ color, onPlay, isActive }: { color: string; onPlay: () => void; isActive: boolean }) {
  return (
    <div className={`w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 ${color} flex items-center justify-center relative group/art mb-4`}>
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px), repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px)'
        }} />
      {/* Music note */}
      <svg className="w-12 h-12 opacity-30 transition-transform duration-700 group-hover/art:scale-110" fill="white" viewBox="0 0 24 24">
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
      </svg>
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-opacity duration-200">
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="w-14 h-14 rounded-full flex items-center justify-center border border-white/20 hover:bg-white hover:text-black transition-all"
          style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
          aria-label="Play"
        >
          <svg className="w-6 h-6 ml-0.5" fill="white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function SongCard({ track }: SongCardProps) {
  const { currentTrack, isPlaying, toggle } = usePlayer();
  const isActive = currentTrack?.slug === track.slug && isPlaying;

  return (
    <article
      className={`rounded-2xl p-4 flex flex-col group cursor-pointer relative min-h-[200px] border transition-all duration-300 ${
        isActive
          ? 'border-[#ff00ff] neon-pulse-active'
          : 'border-white/8 hover:border-[rgba(255,0,255,0.6)] hover:shadow-[0_0_24px_rgba(255,0,255,0.35)]'
      }`}
      style={{
        backgroundColor: '#0A0710',
        boxShadow: isActive
          ? '0 0 28px rgba(255,0,170,0.55)'
          : '0 4px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Track number badge */}
      <div className="absolute top-3 right-3 text-[10px] font-bold text-gray-600 tabular-nums">
        {String(track.number).padStart(2, '0')}
      </div>

      {/* Album art with hover play overlay */}
      <AlbumArt color={track.color} onPlay={() => toggle(track)} isActive={isActive} />

      <div className="flex flex-col flex-grow">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <Link href={`/tracks/${track.slug}`} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
            <h3 className="font-bold text-base leading-snug text-white hover:text-[#00e5ff] transition-colors line-clamp-2">
              {track.title}{track.subtitle ? ` (${track.subtitle})` : ''}
            </h3>
          </Link>
          {/* Small inline play/pause */}
          <button
            onClick={() => toggle(track)}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            aria-label={isActive ? 'Pause' : 'Play'}
            style={isActive
              ? { background: '#ff00ff', boxShadow: '0 0 12px rgba(255,0,255,0.6)' }
              : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {isActive
              ? <Pause className="w-3 h-3 text-white fill-current" />
              : <Play className="w-3 h-3 text-white fill-current ml-0.5" />
            }
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{track.artist}</p>

        <div className="mt-auto flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
            style={{
              border: '1px solid rgba(0,229,255,0.3)',
              background: 'rgba(0,229,255,0.07)',
              color: '#00e5ff',
            }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            EXCLUSIVE
          </span>
          <div className="flex gap-2">
            {track.spotifyUrl && track.spotifyUrl !== '#' && (
              <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-full hover:bg-white/5 transition-colors">
                <Music className="w-4 h-4 text-green-400 hover:text-green-300" />
              </a>
            )}
            {track.appleMusicUrl && track.appleMusicUrl !== '#' && (
              <a href={track.appleMusicUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-full hover:bg-white/5 transition-colors">
                <Music4 className="w-4 h-4 text-red-400 hover:text-red-300" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
