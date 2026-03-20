'use client';

import { usePlayer } from '@/context/PlayerContext';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, Maximize2
} from 'lucide-react';

const BARS = [3,5,8,12,7,14,10,6,9,13,11,5,8,15,12,7,4,9,11,6,13,8,5,10,14,9,6,12,8,4,7,11,13,9,5,8,12,10,6,15,9,7,11,5,13,8,4,10,12,7];
const PLAYED_FRAC = 0.55;

export default function PersistentPlayer() {
  const { currentTrack, isPlaying, pause, play } = usePlayer();

  const handlePlayPause = () => {
    if (!currentTrack) return;
    isPlaying ? pause() : play(currentTrack);
  };

  const displayTrack = currentTrack ?? {
    title: 'Midnight Cruiser',
    artist: 'West Coast',
    bpm: 95,
    color: 'bg-gradient-to-br from-purple-700 to-blue-600',
    slug: '',
    number: 0,
    genre: 'West Coast',
  };

  return (
    <footer
      className="fixed bottom-0 left-0 w-full z-50"
      style={{
        background: 'rgba(10, 10, 16, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,0,255,0.15)',
      }}
    >
      {/* Progress line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5" />
      <div
        className="absolute top-0 left-0 h-[2px]"
        style={{
          width: currentTrack ? '55%' : '0%',
          background: 'linear-gradient(90deg, #00e5ff, #7c3aed, #ff00ff)',
          boxShadow: '0 0 8px rgba(176,38,255,0.8)',
          transition: 'width 0.3s ease',
        }}
      />

      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

        {/* LEFT: Track info */}
        <div className="flex items-center gap-4 w-1/4 min-w-[180px]">
          <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${displayTrack.color} flex items-center justify-center`}
            style={{ boxShadow: '0 0 12px rgba(0,0,0,0.5)' }}>
            <svg className="w-5 h-5 opacity-40" fill="white" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          </div>
          <div className="overflow-hidden">
            <h4 className="text-white font-semibold text-sm truncate leading-tight">
              {displayTrack.title}
              {(displayTrack as typeof currentTrack & { subtitle?: string })?.subtitle
                ? ` (${(displayTrack as typeof currentTrack & { subtitle?: string })?.subtitle})` : ''}
            </h4>
            <p className="text-xs truncate mt-0.5" style={{ color: '#00e5ff', opacity: 0.7 }}>
              {displayTrack.genre}
              {(displayTrack as typeof currentTrack & { bpm?: number })?.bpm
                ? ` • ${(displayTrack as typeof currentTrack & { bpm?: number }).bpm} BPM` : ''}
            </p>
          </div>
        </div>

        {/* CENTER: Waveform */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
          <div className="w-full h-12 flex items-end justify-center gap-[2px]">
            {BARS.map((h, i) => {
              const played = i / BARS.length < PLAYED_FRAC;
              const frac = i / BARS.length;
              const color = played
                ? (frac < 0.25 ? '#00e5ff' : frac < 0.45 ? '#818cf8' : '#b026ff')
                : 'rgba(255,255,255,0.08)';
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full flex-shrink-0 transition-all duration-300"
                  style={{
                    height: `${h * 2.6}px`,
                    backgroundColor: color,
                    boxShadow: played ? `0 0 4px ${color}` : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center justify-end gap-4 w-1/4 min-w-[260px]">
          <button className="text-gray-600 hover:text-gray-300 transition-colors" aria-label="Shuffle">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" aria-label="Previous">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play/Pause — neon button */}
          <button
            onClick={handlePlayPause}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              background: 'linear-gradient(135deg, #00e5ff, #7c3aed)',
              boxShadow: '0 0 16px rgba(124,58,237,0.6)',
            }}
          >
            {isPlaying && currentTrack
              ? <Pause className="w-4 h-4 text-white fill-current" />
              : <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            }
          </button>

          <button className="text-gray-400 hover:text-white transition-colors" aria-label="Next">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button className="text-gray-600 hover:text-gray-300 transition-colors" aria-label="Repeat">
            <Repeat className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 ml-1">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <div className="w-16 h-1 bg-white/10 rounded-full relative">
              <div className="absolute top-0 left-0 h-full w-3/4 rounded-full"
                style={{ background: 'linear-gradient(90deg, #7c3aed, #b026ff)' }} />
              <div className="absolute top-1/2 left-[75%] -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full -translate-x-1/2"
                style={{ boxShadow: '0 0 6px rgba(176,38,255,0.8)' }} />
            </div>
          </div>

          <button className="text-gray-600 hover:text-gray-300 transition-colors ml-1">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </footer>
  );
}
