'use client';

import Link from 'next/link';
import { Play, Pause, Music, Music4 } from 'lucide-react';
import { proxyCoverUrl } from '@/lib/proxy-cover';
import type { TrackWithCredits } from './MusicLibrary';
import { usePlayer } from '@/context/PlayerContext';

interface SongCardProps {
  track: TrackWithCredits;
}

function AlbumArt({ color, coverUrl, onPlay, isActive }: { color: string; coverUrl?: string | null; onPlay: () => void; isActive: boolean }) {
  return (
    <div className={`group/art relative mb-4 aspect-square w-full flex-shrink-0 overflow-hidden rounded-lg border border-white/10 ${!coverUrl ? color : ''}`}>
      {coverUrl ? (
        <img
          src={proxyCoverUrl(coverUrl)}
          alt="Album art"
          className={`h-full w-full object-cover transition duration-500 group-hover/art:scale-[1.035] ${isActive ? 'scale-[1.025]' : ''}`}
        />
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px), repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.05) 6px, rgba(255,255,255,0.05) 7px)',
            }}
          />
          <svg className="absolute inset-0 m-auto h-12 w-12 opacity-30 transition-transform duration-700 group-hover/art:scale-110" fill="white" viewBox="0 0 24 24">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
      <div className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
        Vault file
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-200 group-hover/art:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition hover:scale-105"
          aria-label={isActive ? 'Pause track' : 'Play track'}
        >
          {isActive ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
        </button>
      </div>
    </div>
  );
}

function getProducer(track: TrackWithCredits) {
  return track.credits?.find((credit) => credit.role.toLowerCase().includes('produc'))?.name;
}

function getStoryTeaser(story?: string | null) {
  if (!story) return null;
  const clean = story.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > 96 ? `${clean.slice(0, 93).trim()}...` : clean;
}

export default function SongCard({ track }: SongCardProps) {
  const { currentTrack, isPlaying, toggle } = usePlayer();
  const isCurrent = currentTrack?.slug === track.slug;
  const isActive = isCurrent && isPlaying;
  const isFullSong = track.genre === 'Full Songs';
  const producer = getProducer(track);
  const storyTeaser = getStoryTeaser(track.story);
  const trackNumber = track.number != null ? String(track.number).padStart(2, '0') : '--';

  return (
    <article
      className={`group relative flex min-h-[200px] flex-col rounded-xl border p-4 transition-all duration-300 ${
        isCurrent
          ? 'border-cyan-200/55 neon-pulse-active'
          : 'border-white/10 hover:-translate-y-1 hover:border-white/25'
      }`}
      style={{
        backgroundColor: '#101010',
        boxShadow: isCurrent ? '0 0 24px rgba(0,229,255,0.26)' : '0 12px 28px rgba(0,0,0,0.42)',
      }}
    >
      <div className="absolute right-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-[10px] font-black text-zinc-300 tabular-nums">
        {trackNumber}
      </div>

      <AlbumArt color={track.color} coverUrl={track.coverUrl} onPlay={() => toggle(track)} isActive={isActive} />

      <div className="flex flex-grow flex-col">
        <div className="mb-1 flex items-start justify-between gap-2">
          <Link href={`/tracks/${track.slug}`} onClick={(e) => e.stopPropagation()} className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-bold leading-snug text-white transition-colors hover:text-cyan-200">
              {track.title}{track.subtitle ? ` (${track.subtitle})` : ''}
            </h3>
          </Link>
          <button
            onClick={() => toggle(track)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all hover:scale-110"
            aria-label={isActive ? 'Pause' : 'Play'}
            style={isActive
              ? { background: '#00e5ff', color: '#020202', boxShadow: '0 0 12px rgba(0,229,255,0.45)' }
              : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }
            }
          >
            {isActive
              ? <Pause className="h-3 w-3 fill-current" />
              : <Play className="ml-0.5 h-3 w-3 fill-current text-white" />
            }
          </button>
        </div>

        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">{track.artist}</p>

        <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          {track.bpm != null && (
            <div className="border border-white/10 bg-black/25 px-2 py-1.5">
              <span className="text-zinc-600">BPM</span> <span className="text-zinc-200">{track.bpm}</span>
            </div>
          )}
          {track.mood && (
            <div className="border border-white/10 bg-black/25 px-2 py-1.5">
              <span className="text-zinc-600">Mood</span> <span className="text-zinc-200">{track.mood}</span>
            </div>
          )}
          {producer && (
            <div className="col-span-2 border border-white/10 bg-black/25 px-2 py-1.5">
              <span className="text-zinc-600">Producer</span> <span className="text-zinc-200">{producer}</span>
            </div>
          )}
        </div>

        {storyTeaser && (
          <p className="mb-4 line-clamp-2 text-xs leading-5 text-zinc-500">{storyTeaser}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
            style={{
              borderColor: isFullSong ? 'rgba(52,211,153,0.35)' : 'rgba(0,229,255,0.25)',
              background: isFullSong ? 'rgba(52,211,153,0.10)' : 'rgba(0,229,255,0.055)',
              color: isFullSong ? '#86efac' : '#9eefff',
            }}
          >
            {isFullSong ? 'Full song' : 'Vault cut'}
          </span>
          <div className="flex gap-2">
            {track.spotifyUrl && track.spotifyUrl !== '#' && (
              <a
                href={track.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full p-1.5 transition-colors hover:bg-white/5"
                aria-label={`Open ${track.title} on Spotify`}
              >
                <Music className="h-4 w-4 text-green-400 hover:text-green-300" />
              </a>
            )}
            {track.appleMusicUrl && track.appleMusicUrl !== '#' && (
              <a
                href={track.appleMusicUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full p-1.5 transition-colors hover:bg-white/5"
                aria-label={`Open ${track.title} on Apple Music`}
              >
                <Music4 className="h-4 w-4 text-red-400 hover:text-red-300" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
