'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Play, Pause, Music, Music4 } from 'lucide-react';
import { proxyCoverUrl } from '@/lib/proxy-cover';
import type { TrackWithCredits } from './MusicLibrary';
import { usePlayer } from '@/context/PlayerContext';

interface SongCardProps {
  track: TrackWithCredits;
}

// Album art with hover play overlay
function AlbumArt({ title, color, coverUrl, onPlay, isActive }: { title: string; color: string; coverUrl?: string | null; onPlay: () => void; isActive: boolean }) {
  const coverSrc = proxyCoverUrl(coverUrl);
  return (
    <div
      data-song-card-art
      className={`group/art relative h-[88px] w-[88px] flex-shrink-0 overflow-hidden rounded-xl sm:mb-4 sm:h-auto sm:w-full sm:aspect-square ${!coverSrc ? color : ''}`}
    >
      {coverSrc ? (
        <Image
          src={coverSrc}
          alt={`${title} cover art`}
          fill
          sizes="(max-width: 639px) 88px, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
      ) : (
        <>
          {/* Grid texture */}
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px), repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px)'
            }} />
          {/* Music note */}
          <svg className="absolute inset-0 m-auto w-12 h-12 opacity-30 transition-transform duration-700 group-hover/art:scale-110" fill="white" viewBox="0 0 24 24">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
          </svg>
        </>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover/art:opacity-100 group-focus-within/art:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 transition-all hover:bg-white hover:text-black sm:h-14 sm:w-14"
          style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
          aria-label={`${isActive ? 'Pause' : 'Play'} ${title}`}
        >
          {isActive
            ? <Pause className="h-6 w-6 fill-white text-white" />
            : <Play className="h-6 w-6 fill-white text-white" />
          }
        </button>
      </div>
    </div>
  );
}

export default function SongCard({ track }: SongCardProps) {
  const { currentTrack, isPlaying, toggle } = usePlayer();
  const isActive = currentTrack?.slug === track.slug && isPlaying;
  const isFullSong = track.genre === 'Full Songs';

  return (
    <article
      data-mobile-layout="song-card"
      className={`group relative grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-2xl border p-3 transition-all duration-300 sm:flex sm:min-h-[200px] sm:flex-col sm:gap-0 sm:p-4 ${
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
        {track.number == null ? '—' : String(track.number).padStart(2, '0')}
      </div>

      {/* Album art with hover play overlay */}
      <AlbumArt title={track.title} color={track.color} coverUrl={track.coverUrl} onPlay={() => toggle(track)} isActive={isActive} />

      <div className="flex min-w-0 flex-col sm:flex-grow">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <Link href={`/tracks/${track.slug}`} onClick={(e) => e.stopPropagation()} className="flex min-h-11 min-w-0 flex-1 items-start py-2">
            <h3 className="font-bold text-base leading-snug text-white hover:text-[#00e5ff] transition-colors line-clamp-2">
              {track.title}{track.subtitle ? ` (${track.subtitle})` : ''}
            </h3>
          </Link>
          {/* Small inline play/pause */}
          <button
            onClick={() => toggle(track)}
            className="flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
            aria-label={`${isActive ? 'Pause' : 'Play'} ${track.title}`}
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
              border: isFullSong ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(0,229,255,0.3)',
              background: isFullSong ? 'rgba(52,211,153,0.10)' : 'rgba(0,229,255,0.07)',
              color: isFullSong ? '#86efac' : '#00e5ff',
            }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            {isFullSong ? 'FULL SONG' : 'EXCLUSIVE'}
          </span>
          <div className="flex gap-0 sm:gap-2">
            {track.spotifyUrl && track.spotifyUrl !== '#' && (
              <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Listen to ${track.title} on Spotify`}
                onClick={(e) => e.stopPropagation()}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/5">
                <Music className="w-4 h-4 text-green-400 hover:text-green-300" />
              </a>
            )}
            {track.appleMusicUrl && track.appleMusicUrl !== '#' && (
              <a href={track.appleMusicUrl} target="_blank" rel="noopener noreferrer" aria-label={`Listen to ${track.title} on Apple Music`}
                onClick={(e) => e.stopPropagation()}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/5">
                <Music4 className="w-4 h-4 text-red-400 hover:text-red-300" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
