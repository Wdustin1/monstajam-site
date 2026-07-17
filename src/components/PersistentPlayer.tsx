'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronUp,
  ListMusic,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer, type PlayerTrack } from '@/context/PlayerContext';
import { getPreviewLabel } from '@/lib/player-comfort';
import { proxyCoverUrl } from '@/lib/proxy-cover';

const BARS = [3,5,8,12,7,14,10,6,9,13,11,5,8,15,12,7,4,9,11,6,13,8,5,10,14,9,6,12,8,4,7,11,13,9,5,8,12,10,6,15,9,7,11,5,13,8,4,10,12,7];

function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function TrackArtwork({ track, className }: { track: PlayerTrack; className: string }) {
  const coverSrc = proxyCoverUrl(track.coverUrl);
  return (
    <span
      data-player-artwork
      className={`relative block shrink-0 overflow-hidden rounded-xl ${track.color} ${className}`}
      style={{ boxShadow: '0 0 18px rgba(176,38,255,0.35)' }}
    >
      {coverSrc ? (
        <Image
          src={coverSrc}
          alt={`${track.title} cover art`}
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <Music2 aria-hidden="true" className="h-5 w-5 text-white/40" />
        </span>
      )}
    </span>
  );
}

export default function PersistentPlayer() {
  const {
    currentTrack, queue, isPlaying, progress, currentTime, duration,
    volume, pause, play, seek, setVolume,
    next, prev, shuffleOn, repeatOn, toggleShuffle, toggleRepeat,
  } = usePlayer();
  const [isCompact, setIsCompact] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const queueTriggerRef = useRef<HTMLButtonElement | null>(null);
  const queueCloseRef = useRef<HTMLButtonElement | null>(null);
  const compactExpandRef = useRef<HTMLButtonElement | null>(null);

  const minimizePlayer = useCallback(() => {
    setQueueOpen(false);
    setIsCompact(true);
    requestAnimationFrame(() => compactExpandRef.current?.focus());
  }, []);

  const closeQueue = useCallback(() => {
    setQueueOpen(false);
    requestAnimationFrame(() => queueTriggerRef.current?.focus());
  }, []);

  const toggleQueue = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (queueOpen) {
      closeQueue();
      return;
    }
    queueTriggerRef.current = event.currentTarget;
    setQueueOpen(true);
  }, [closeQueue, queueOpen]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      barsRef.current.forEach((element, index) => {
        if (element) element.style.height = `${BARS[index] * 2.4}px`;
      });
      return;
    }

    const animate = () => {
      tickRef.current += 1;
      const tick = tickRef.current;
      barsRef.current.forEach((element, index) => {
        if (!element) return;
        const wave = Math.sin(tick / 6 + index * 0.4) * 0.4 + 0.6;
        const secondWave = Math.sin(tick / 10 + index * 0.2 + 1.5) * 0.2 + 0.8;
        element.style.height = `${Math.max(BARS[index] * 2.8 * wave * secondWave, 3)}px`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!queueOpen) return;
    queueCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeQueue();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeQueue, queueOpen]);

  if (!currentTrack) return null;

  const displayTrack = currentTrack;
  const currentIndex = queue.findIndex((track) => track.slug === displayTrack.slug);
  const rotatedQueue = currentIndex >= 0
    ? [...queue.slice(currentIndex + 1), ...queue.slice(0, currentIndex)]
    : queue;
  const upNextTracks = rotatedQueue
    .filter((track) => track.slug !== displayTrack.slug)
    .slice(0, 5);
  const previewLabel = getPreviewLabel(currentTrack, duration);
  const resumeLabel = currentTime > 0 && !isPlaying ? `Resume at ${formatTime(currentTime)}` : null;

  const handlePlayPause = () => {
    if (isPlaying) pause();
    else play(currentTrack);
  };

  const handleSeekKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextProgress = progress;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextProgress += 0.05;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextProgress -= 0.05;
    else if (event.key === 'Home') nextProgress = 0;
    else if (event.key === 'End') nextProgress = 1;
    else return;

    event.preventDefault();
    seek(Math.min(1, Math.max(0, nextProgress)));
  };

  const playerSurface = {
    background: 'rgba(5, 0, 10, 0.96)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.72), 0 0 28px rgba(124,58,237,0.12)',
  };

  return (
    <div
      role="region"
      aria-label="Audio player"
      data-player-mode={isCompact ? 'compact' : 'expanded'}
      className={isCompact
        ? 'fixed bottom-3 left-3 right-3 z-50 sm:left-auto sm:w-[390px]'
        : 'fixed bottom-0 left-0 z-50 w-full'}
      style={playerSurface}
    >
      {isCompact ? (
        <div className="relative flex min-h-[68px] items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 pr-2">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5"
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-300 via-violet-500 to-fuchsia-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <Link href={`/tracks/${displayTrack.slug}`} aria-label={`Open ${displayTrack.title}`}>
            <TrackArtwork track={displayTrack} className="h-11 w-11" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/tracks/${displayTrack.slug}`}
              className="flex min-h-11 flex-col justify-center transition hover:text-cyan-200"
            >
              <span className="truncate text-sm font-bold text-white">{displayTrack.title}</span>
              <span className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200/65">
                {resumeLabel ?? previewLabel}
              </span>
            </Link>
          </div>
          <button
            type="button"
            onClick={handlePlayPause}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.55)] transition hover:scale-105"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <Pause aria-hidden="true" className="h-4 w-4 fill-current" />
              : <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
          <button
            ref={compactExpandRef}
            type="button"
            onClick={() => setIsCompact(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-gray-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Expand player"
          >
            <Maximize2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          {queueOpen && (
            <section
              id="player-up-next"
              aria-label="Up Next queue"
              className="absolute bottom-full right-0 z-20 w-full border border-white/10 bg-[#08040d]/[0.98] shadow-[0_-24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:right-4 sm:mb-3 sm:w-[380px] sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200/60">Queue</p>
                  <h2 className="mt-0.5 text-sm font-black text-white">Up Next</h2>
                </div>
                <button
                  ref={queueCloseRef}
                  type="button"
                  onClick={closeQueue}
                  className="grid h-11 w-11 place-items-center rounded-xl text-gray-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close Up Next"
                >
                  <ChevronUp aria-hidden="true" className="h-4 w-4 rotate-180" />
                </button>
              </div>
              <div className="max-h-[min(50vh,360px)] overflow-y-auto p-2">
                {upNextTracks.length > 0 ? upNextTracks.map((track, index) => (
                  <button
                    key={track.slug}
                    type="button"
                    onClick={() => { play(track); closeQueue(); }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-[10px] text-gray-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <TrackArtwork track={track} className="h-11 w-11" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{track.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-500">{track.artist}</span>
                    </span>
                    <Play aria-hidden="true" className="h-4 w-4 fill-current text-cyan-200/70" />
                  </button>
                )) : (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">
                    This is the last track in the current queue.
                  </p>
                )}
              </div>
            </section>
          )}

          <div
            className="group absolute -top-10 left-0 z-10 h-11 w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            onKeyDown={handleSeekKeyDown}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              seek((event.clientX - rect.left) / rect.width);
            }}
          >
            <div className="absolute bottom-0 left-0 h-[3px] w-full bg-white/[0.06]">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-300 via-violet-500 to-fuchsia-500 shadow-[0_0_10px_rgba(176,38,255,0.9)]"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_8px_rgba(255,0,170,0.8)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{ left: `calc(${progress * 100}% - 6px)` }}
              />
            </div>
          </div>

          <div className="md:hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-center gap-3">
              <Link href={`/tracks/${displayTrack.slug}`} aria-label={`Open ${displayTrack.title}`}>
                <TrackArtwork track={displayTrack} className="h-11 w-11" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tracks/${displayTrack.slug}`}
                  className="flex min-h-11 flex-col justify-center text-white"
                >
                  <span className="truncate text-sm font-bold leading-tight">
                    {displayTrack.title}{displayTrack.subtitle ? ` (${displayTrack.subtitle})` : ''}
                  </span>
                  <span className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200/60">
                    {previewLabel}
                  </span>
                </Link>
              </div>
              <button
                type="button"
                onClick={prev}
                className="grid h-11 w-11 place-items-center text-gray-400 hover:text-white"
                aria-label="Previous"
              >
                <SkipBack aria-hidden="true" className="h-5 w-5 fill-current" />
              </button>
              <button
                type="button"
                onClick={handlePlayPause}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-600 text-white shadow-[0_0_14px_rgba(124,58,237,0.7)]"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause aria-hidden="true" className="h-4 w-4 fill-current" />
                  : <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-current" />}
              </button>
              <button
                type="button"
                onClick={next}
                className="grid h-11 w-11 place-items-center text-gray-400 hover:text-white"
                aria-label="Next"
              >
                <SkipForward aria-hidden="true" className="h-5 w-5 fill-current" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1 border-t border-white/[0.06] pt-2">
              <span className="mr-auto text-[10px] tabular-nums text-gray-500">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {resumeLabel && (
                <span className="hidden text-[9px] font-bold uppercase tracking-[0.1em] text-fuchsia-200/60 min-[360px]:inline">
                  {resumeLabel}
                </span>
              )}
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="Shuffle"
                aria-pressed={shuffleOn}
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ color: shuffleOn ? '#00e5ff' : '#6b7280' }}
              >
                <Shuffle aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleRepeat}
                aria-label="Repeat"
                aria-pressed={repeatOn}
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ color: repeatOn ? '#00e5ff' : '#6b7280' }}
              >
                <Repeat aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleQueue}
                aria-label="Show Up Next"
                aria-controls="player-up-next"
                aria-expanded={queueOpen}
                className="grid h-11 w-11 place-items-center rounded-xl text-gray-500 hover:text-white"
              >
                <ListMusic aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={minimizePlayer}
                aria-label="Minimize player"
                className="grid h-11 w-11 place-items-center rounded-xl text-gray-500 hover:text-white"
              >
                <Minimize2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mx-auto hidden max-w-screen-2xl items-center gap-5 px-6 py-3 md:flex">
            <div className="flex w-[29%] min-w-0 items-center gap-3">
              <Link href={`/tracks/${displayTrack.slug}`} aria-label={`Open ${displayTrack.title}`}>
                <TrackArtwork track={displayTrack} className="h-12 w-12" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tracks/${displayTrack.slug}`}
                  className="block truncate text-sm font-bold text-white transition hover:text-cyan-200"
                >
                  {displayTrack.title}{displayTrack.subtitle ? ` (${displayTrack.subtitle})` : ''}
                </Link>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span className="truncate text-[11px] text-gray-500">{displayTrack.artist}</span>
                  <span className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-100/70">
                    {previewLabel}
                  </span>
                  {resumeLabel && (
                    <span className="shrink-0 text-[9px] font-semibold text-fuchsia-200/60">{resumeLabel}</span>
                  )}
                </div>
              </div>
            </div>

            <div
              className="flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden px-2"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                seek((event.clientX - rect.left) / rect.width);
              }}
              title="Click to seek"
            >
              <div className="flex h-11 w-full items-end justify-center gap-[2px]">
                {BARS.map((height, index) => {
                  const barFraction = index / BARS.length;
                  const played = barFraction < progress;
                  const color = played
                    ? (barFraction < 0.25 ? '#00e5ff' : barFraction < 0.5 ? '#a78bfa' : '#ff00aa')
                    : 'rgba(255,255,255,0.07)';
                  return (
                    <div
                      key={index}
                      ref={(element) => { barsRef.current[index] = element; }}
                      className="w-[3px] shrink-0 rounded-full"
                      style={{
                        height: `${height * 2.4}px`,
                        backgroundColor: color,
                        boxShadow: played ? `0 0 4px ${color}` : undefined,
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex w-full justify-between px-1 text-[10px] tabular-nums text-gray-600">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex w-[36%] items-center justify-end gap-1.5">
              <button type="button" onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffleOn} className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: shuffleOn ? '#00e5ff' : '#4b5563' }}>
                <Shuffle aria-hidden="true" className="h-4 w-4" />
              </button>
              <button type="button" onClick={prev} aria-label="Previous" className="grid h-11 w-11 place-items-center text-gray-400 hover:text-white">
                <SkipBack aria-hidden="true" className="h-5 w-5 fill-current" />
              </button>
              <button
                type="button"
                onClick={handlePlayPause}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-600 text-white shadow-[0_0_18px_rgba(124,58,237,0.7)] transition hover:scale-105"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause aria-hidden="true" className="h-4 w-4 fill-current" />
                  : <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-current" />}
              </button>
              <button type="button" onClick={next} aria-label="Next" className="grid h-11 w-11 place-items-center text-gray-400 hover:text-white">
                <SkipForward aria-hidden="true" className="h-5 w-5 fill-current" />
              </button>
              <button type="button" onClick={toggleRepeat} aria-label="Repeat" aria-pressed={repeatOn} className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: repeatOn ? '#00e5ff' : '#4b5563' }}>
                <Repeat aria-hidden="true" className="h-4 w-4" />
              </button>
              <div className="ml-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
                  className="grid h-11 w-11 place-items-center text-gray-500 hover:text-white"
                  aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {volume === 0
                    ? <VolumeX aria-hidden="true" className="h-4 w-4" />
                    : <Volume2 aria-hidden="true" className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="h-11 w-14 cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, #7c3aed ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 4px',
                    accentColor: '#7c3aed',
                  }}
                  aria-label="Volume"
                />
              </div>
              <button
                type="button"
                onClick={toggleQueue}
                aria-label="Show Up Next"
                aria-controls="player-up-next"
                aria-expanded={queueOpen}
                className="ml-1 grid h-11 w-11 place-items-center rounded-xl text-gray-500 transition hover:bg-white/5 hover:text-white"
              >
                <ListMusic aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={minimizePlayer}
                aria-label="Minimize player"
                className="grid h-11 w-11 place-items-center rounded-xl text-gray-500 transition hover:bg-white/5 hover:text-white"
              >
                <Minimize2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
