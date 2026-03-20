'use client';

import { usePlayer } from '@/context/PlayerContext';
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, Maximize2
} from 'lucide-react';

// SVG waveform bars — two colors meeting in the middle to mimic the design
const BARS = [3,5,8,12,7,14,10,6,9,13,11,5,8,15,12,7,4,9,11,6,13,8,5,10,14,9,6,12,8,4,7,11,13,9,5,8,12,10,6,15,9,7,11,5,13,8,4,10,12,7];
const PLAYED_FRAC = 0.55; // 55% played — represents progress visually

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
    <footer className="fixed bottom-0 left-0 w-full z-50 border-t border-white/10"
      style={{ background: 'rgba(26, 26, 32, 0.85)', backdropFilter: 'blur(12px)' }}
    >
      {/* Progress line at very top edge */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-white/10" />
      <div
        className="absolute top-0 left-0 h-[3px] shadow-[0_0_10px_#b026ff]"
        style={{
          width: currentTrack ? '55%' : '0%',
          background: 'linear-gradient(90deg, #22d3ee, #3b82f6, #b026ff)',
          transition: 'width 0.3s ease',
        }}
      />

      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

        {/* LEFT: Track info */}
        <div className="flex items-center gap-4 w-1/4 min-w-[180px]">
          <div className={`w-14 h-14 rounded-lg flex-shrink-0 ${displayTrack.color} shadow-md`} />
          <div className="overflow-hidden">
            <h4 className="text-white font-semibold text-sm truncate">
              {displayTrack.title}{(displayTrack as typeof currentTrack & { subtitle?: string })?.subtitle
                ? ` (${(displayTrack as typeof currentTrack & { subtitle?: string })?.subtitle})` : ''}
            </h4>
            <p className="text-gray-400 text-xs truncate">
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
              const color = played
                ? (i / BARS.length < 0.3 ? '#22d3ee' : i / BARS.length < 0.5 ? '#818cf8' : '#b026ff')
                : '#374151';
              const glowColor = played ? color : undefined;
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-full flex-shrink-0 transition-all duration-300"
                  style={{
                    height: `${isPlaying && currentTrack
                      ? Math.max(h * 2.8, 6) * (0.7 + 0.3 * Math.sin(Date.now() / 200 + i))
                      : h * 2.4}px`,
                    backgroundColor: color,
                    boxShadow: glowColor ? `0 0 4px ${glowColor}` : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center justify-end gap-5 w-1/4 min-w-[260px]">
          <button className="text-gray-400 hover:text-white transition-colors" aria-label="Shuffle">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" aria-label="Previous">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={handlePlayPause}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform flex-shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying && currentTrack
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 fill-current ml-0.5" />
            }
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" aria-label="Next">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" aria-label="Repeat">
            <Repeat className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 ml-1">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <div className="w-16 h-1 bg-gray-600 rounded-full relative overflow-visible">
              <div className="absolute top-0 left-0 h-full w-3/4 rounded-full" style={{ background: '#b026ff' }} />
              <div className="absolute top-1/2 left-[75%] -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_5px_white] -translate-x-1/2" />
            </div>
          </div>

          {/* Expand */}
          <button className="flex flex-col items-center gap-0.5 group text-gray-400 hover:text-white transition-colors ml-1">
            <span className="text-[9px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity leading-none">Expand</span>
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </footer>
  );
}
