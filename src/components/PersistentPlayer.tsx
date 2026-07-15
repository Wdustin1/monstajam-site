'use client';

import { usePlayer } from '@/context/PlayerContext';
import { useEffect, useRef } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, VolumeX,
} from 'lucide-react';

// Waveform bar heights (static shape — animation driven by CSS/ref, not state)
const BARS = [3,5,8,12,7,14,10,6,9,13,11,5,8,15,12,7,4,9,11,6,13,8,5,10,14,9,6,12,8,4,7,11,13,9,5,8,12,10,6,15,9,7,11,5,13,8,4,10,12,7];

function formatTime(seconds: number) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PersistentPlayer() {
  const {
    currentTrack, isPlaying, progress, currentTime, duration,
    volume, pause, play, seek, setVolume,
    next, prev, shuffleOn, repeatOn, toggleShuffle, toggleRepeat,
  } = usePlayer();

  // ── Waveform animation via RAF → ref (no state re-renders) ──────────────────
  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      barsRef.current.forEach((el, i) => {
        if (el) el.style.height = `${BARS[i] * 2.4}px`;
      });
      return;
    }

    const animate = () => {
      tickRef.current += 1;
      const t = tickRef.current;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const wave = Math.sin(t / 6 + i * 0.4) * 0.4 + 0.6;
        const wave2 = Math.sin(t / 10 + i * 0.2 + 1.5) * 0.2 + 0.8;
        el.style.height = `${Math.max(BARS[i] * 2.8 * wave * wave2, 3)}px`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  const handlePlayPause = () => {
    if (!currentTrack) return;
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

  const hasTrack = !!currentTrack;

  if (!hasTrack) return null;

  const displayTrack = currentTrack ?? {
    title: 'No track selected', artist: '', genre: '', slug: '',
    color: 'bg-gradient-to-br from-purple-700 to-blue-600',
    bpm: undefined as number | undefined, subtitle: undefined,
  };

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed bottom-0 left-0 w-full z-50"
      style={{
        background: 'rgba(5, 0, 10, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,0,170,0.2)',
      }}
    >
      {/* ── Progress bar — 24px hit area with a 3px visual track ── */}
      <div
        className="group absolute -top-5 left-0 h-6 w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        onKeyDown={handleSeekKeyDown}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - rect.left) / rect.width);
        }}
      >
        <div className="absolute bottom-0 left-0 h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="absolute left-0 top-0 h-full transition-none"
            style={{
              width: `${progress * 100}%`,
              background: 'linear-gradient(90deg, #00e5ff, #7c3aed, #ff00aa)',
              boxShadow: '0 0 10px rgba(176,38,255,0.9)',
            }}
          />
          {hasTrack && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              style={{ left: `calc(${progress * 100}% - 6px)`, boxShadow: '0 0 8px rgba(255,0,170,0.8)' }}
            />
          )}
        </div>
      </div>

      {/* ── MOBILE LAYOUT (< md) ── */}
      <div className="md:hidden px-4 pt-3 pb-3">
        {/* Row 1: Track info + Play button */}
        <div className="flex items-center gap-3 mb-2">
          {/* Mini album art */}
          <div
            className={`w-10 h-10 rounded-lg flex-shrink-0 ${displayTrack.color} flex items-center justify-center`}
            style={{ boxShadow: hasTrack ? '0 0 12px rgba(176,38,255,0.4)' : undefined }}
          >
            <svg className="w-4 h-4 opacity-40" fill="white" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          </div>

          {/* Track title + artist */}
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm truncate leading-tight">
              {displayTrack.title}
              {currentTrack?.subtitle ? ` (${currentTrack.subtitle})` : ''}
            </h4>
            <p className="text-xs truncate mt-0.5" style={{ color: '#00e5ff', opacity: 0.7 }}>
              {currentTrack?.artist || '—'}
            </p>
          </div>

          {/* Prev / Play / Next */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={prev} disabled={!hasTrack} aria-label="Previous"
              className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-white disabled:opacity-30">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!hasTrack}
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-30"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              style={{
                background: 'linear-gradient(135deg, #00e5ff, #7c3aed)',
                boxShadow: hasTrack ? '0 0 14px rgba(124,58,237,0.7)' : undefined,
              }}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 text-white fill-current" />
                : <Play className="w-4 h-4 text-white fill-current ml-0.5" />
              }
            </button>
            <button onClick={next} disabled={!hasTrack} aria-label="Next"
              className="grid h-10 w-10 place-items-center text-gray-400 transition-colors hover:text-white disabled:opacity-30">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Row 2: Time stamps */}
        <div className="flex justify-between px-1">
          <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (≥ md) ── */}
      <div className="hidden md:flex max-w-screen-2xl mx-auto px-6 py-3 items-center justify-between gap-4">

        {/* LEFT: Track info */}
        <div className="flex items-center gap-4 w-1/4">
          <div
            className={`w-12 h-12 rounded-lg flex-shrink-0 ${displayTrack.color} flex items-center justify-center`}
            style={{ boxShadow: hasTrack ? '0 0 16px rgba(176,38,255,0.4)' : undefined }}
          >
            <svg className="w-5 h-5 opacity-40" fill="white" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-white font-semibold text-sm truncate leading-tight">
              {displayTrack.title}
              {currentTrack?.subtitle ? ` (${currentTrack.subtitle})` : ''}
            </h4>
            {hasTrack && (
              <p className="text-xs truncate mt-0.5" style={{ color: '#00e5ff', opacity: 0.7 }}>
                {currentTrack?.genre}
                {currentTrack?.bpm ? ` • ${currentTrack.bpm} BPM` : ''}
                {!currentTrack?.audioUrl && (
                  <span className="ml-1 text-yellow-500/70">· no audio</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* CENTER: Waveform */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (!currentTrack) return;
            const rect = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - rect.left) / rect.width);
          }}
          title="Click to seek"
        >
          <div className="w-full h-12 flex items-end justify-center gap-[2px]">
            {BARS.map((h, i) => {
              const barFrac = i / BARS.length;
              const played = barFrac < progress;
              const frac = barFrac;
              const color = played
                ? (frac < 0.25 ? '#00e5ff' : frac < 0.5 ? '#a78bfa' : '#ff00aa')
                : 'rgba(255,255,255,0.07)';
              return (
                <div
                  key={i}
                  ref={el => { barsRef.current[i] = el; }}
                  className="w-[3px] rounded-full flex-shrink-0"
                  style={{
                    height: `${h * 2.4}px`,
                    backgroundColor: color,
                    boxShadow: played ? `0 0 4px ${color}` : undefined,
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between w-full mt-1 px-1">
            <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT: Controls + Volume */}
        <div className="flex items-center justify-end gap-4 w-1/4">
          <button onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffleOn} className="p-2 transition-colors"
            style={{ color: shuffleOn ? '#00e5ff' : '#4b5563' }}>
            <Shuffle className="w-4 h-4" />
          </button>
          <button onClick={prev} disabled={!hasTrack} aria-label="Previous"
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={!hasTrack}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-30"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              background: 'linear-gradient(135deg, #00e5ff, #7c3aed)',
              boxShadow: hasTrack ? '0 0 18px rgba(124,58,237,0.7)' : undefined,
            }}
          >
            {isPlaying
              ? <Pause className="w-4 h-4 text-white fill-current" />
              : <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            }
          </button>

          <button onClick={next} disabled={!hasTrack} aria-label="Next"
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button onClick={toggleRepeat} aria-label="Repeat" aria-pressed={repeatOn} className="p-2 transition-colors"
            style={{ color: repeatOn ? '#00e5ff' : '#4b5563' }}>
            <Repeat className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 ml-1">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
              className="text-gray-500 hover:text-white transition-colors"
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="relative w-16 h-4 flex items-center">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7c3aed ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
                  accentColor: '#7c3aed',
                }}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
