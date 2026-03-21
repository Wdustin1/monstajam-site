'use client';

import { usePlayer } from '@/context/PlayerContext';
import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2,
} from 'lucide-react';

// Waveform bar heights
const BARS = [3,5,8,12,7,14,10,6,9,13,11,5,8,15,12,7,4,9,11,6,13,8,5,10,14,9,6,12,8,4,7,11,13,9,5,8,12,10,6,15,9,7,11,5,13,8,4,10,12,7];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PersistentPlayer() {
  const { currentTrack, isPlaying, progress, currentTime, duration, pause, play, toggle, seek, next, prev, shuffleOn, repeatOn, toggleShuffle, toggleRepeat } = usePlayer();
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Animation tick for waveform dance
  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 1;
      setTick(t);
      rafRef.current = requestAnimationFrame(animate);
    };
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const handlePlayPause = () => {
    if (!currentTrack) return;
    isPlaying ? pause() : play(currentTrack);
  };

  // Click on waveform to seek
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    seek(fraction);
  };

  const displayTrack = currentTrack ?? {
    title: 'No track selected',
    artist: '',
    bpm: undefined as number | undefined,
    color: 'bg-gradient-to-br from-purple-700 to-blue-600',
    slug: '',
    number: 0,
    genre: '',
  };

  const hasTrack = !!currentTrack;

  return (
    <footer
      className="fixed bottom-0 left-0 w-full z-50"
      style={{
        background: 'rgba(5, 0, 10, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,0,170,0.2)',
      }}
    >
      {/* ── Progress bar at very top — clickable ── */}
      <div
        ref={barRef}
        className="absolute top-0 left-0 w-full h-[3px] cursor-pointer group"
        style={{ background: 'rgba(255,255,255,0.06)' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - rect.left) / rect.width);
        }}
      >
        <div
          className="absolute top-0 left-0 h-full transition-none"
          style={{
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #00e5ff, #7c3aed, #ff00aa)',
            boxShadow: '0 0 10px rgba(176,38,255,0.9)',
          }}
        />
        {/* Scrubber handle */}
        {hasTrack && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress * 100}% - 6px)`, boxShadow: '0 0 8px rgba(255,0,170,0.8)' }}
          />
        )}
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

        {/* ── LEFT: Track info ── */}
        <div className="flex items-center gap-4 w-1/4 min-w-[180px]">
          <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${displayTrack.color} flex items-center justify-center`}
            style={{ boxShadow: hasTrack ? '0 0 16px rgba(176,38,255,0.4)' : undefined }}>
            <svg className="w-5 h-5 opacity-40" fill="white" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-white font-semibold text-sm truncate leading-tight">
              {displayTrack.title}
              {'subtitle' in displayTrack && (displayTrack as typeof currentTrack & { subtitle?: string })?.subtitle
                ? ` (${(displayTrack as typeof currentTrack & { subtitle?: string })?.subtitle})` : ''}
            </h4>
            {hasTrack && (
              <p className="text-xs truncate mt-0.5" style={{ color: '#00e5ff', opacity: 0.7 }}>
                {displayTrack.genre}
                {(displayTrack as typeof currentTrack & { bpm?: number })?.bpm
                  ? ` • ${(displayTrack as typeof currentTrack & { bpm?: number }).bpm} BPM` : ''}
              </p>
            )}
          </div>
        </div>

        {/* ── CENTER: Animated waveform ── */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden cursor-pointer"
          onClick={handleWaveformClick}
          title="Click to seek"
        >
          <div className="w-full h-12 flex items-end justify-center gap-[2px]">
            {BARS.map((h, i) => {
              const barFrac = i / BARS.length;
              const played = barFrac < progress;

              // Animated height when playing: sine wave ripple across bars
              let displayHeight: number;
              if (isPlaying) {
                const wave = Math.sin((tick / 6) + i * 0.4) * 0.4 + 0.6;
                const wave2 = Math.sin((tick / 10) + i * 0.2 + 1.5) * 0.2 + 0.8;
                displayHeight = h * 2.8 * wave * wave2;
              } else {
                displayHeight = h * 2.4;
              }
              displayHeight = Math.max(displayHeight, 3);

              const frac = barFrac;
              const color = played
                ? (frac < 0.25 ? '#00e5ff' : frac < 0.5 ? '#a78bfa' : '#ff00aa')
                : 'rgba(255,255,255,0.07)';

              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full flex-shrink-0"
                  style={{
                    height: `${displayHeight}px`,
                    backgroundColor: color,
                    boxShadow: played ? `0 0 4px ${color}` : undefined,
                    transition: isPlaying ? 'none' : 'height 0.3s ease',
                  }}
                />
              );
            })}
          </div>

          {/* Time display */}
          <div className="flex justify-between w-full mt-1 px-1">
            <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* ── RIGHT: Controls ── */}
        <div className="flex items-center justify-end gap-4 w-1/4 min-w-[240px]">
          <button
            onClick={toggleShuffle}
            className="transition-colors"
            aria-label="Shuffle"
            style={{ color: shuffleOn ? '#00e5ff' : '#4b5563' }}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={prev}
            disabled={!hasTrack}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30"
            aria-label="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play/Pause */}
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
            {isPlaying && currentTrack
              ? <Pause className="w-4 h-4 text-white fill-current" />
              : <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            }
          </button>

          <button
            onClick={next}
            disabled={!hasTrack}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30"
            aria-label="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={toggleRepeat}
            className="transition-colors"
            aria-label="Repeat"
            style={{ color: repeatOn ? '#00e5ff' : '#4b5563' }}
          >
            <Repeat className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 ml-1">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <div className="w-16 h-1 bg-white/10 rounded-full relative">
              <div className="absolute top-0 left-0 h-full w-3/4 rounded-full"
                style={{ background: 'linear-gradient(90deg, #7c3aed, #ff00aa)' }} />
              <div className="absolute top-1/2 left-[75%] -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full -translate-x-1/2"
                style={{ boxShadow: '0 0 6px rgba(255,0,170,0.8)' }} />
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
