'use client';

import { usePlayer } from '@/context/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Music4 } from 'lucide-react';

const WAVEFORM = [2, 4, 6, 3, 8, 5, 7, 4, 2, 6, 8, 3, 5, 7, 4, 2];

export default function PersistentPlayer() {
  const { currentTrack, isPlaying, pause, play } = usePlayer();

  const handlePlayPause = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      pause();
    } else {
      play(currentTrack);
    }
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 px-4 md:px-8 max-w-7xl mx-auto pointer-events-none">
      {/* Glow wrapper */}
      <div className="relative pointer-events-auto">
        <div
          className="absolute inset-[-2px] rounded-full z-[-1] opacity-80 blur-[5px]"
          style={{ background: 'linear-gradient(90deg, #ff00ff, #00ffff)' }}
        />
        <div className="bg-[#0a0a0f] rounded-full px-6 py-3 flex items-center justify-between gap-4">

          {/* Left: Controls + Volume */}
          <div className="flex items-center gap-4 min-w-[150px]">
            <button className="text-gray-400 hover:text-white transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={handlePlayPause}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
            >
              {isPlaying && currentTrack ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
            <button className="text-gray-400 hover:text-white transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <div className="hidden lg:flex items-center gap-2 ml-4">
              <Volume2 className="w-4 h-4 text-gray-400" />
              <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full w-2/3" style={{ background: 'linear-gradient(90deg, #ff00ff, #00ffff)' }} />
              </div>
            </div>
          </div>

          {/* Center: Now Playing */}
          <div className="flex items-center gap-3 flex-grow justify-center overflow-hidden">
            {currentTrack ? (
              <>
                <div
                  className={`hidden sm:block w-10 h-10 rounded shadow-lg flex-shrink-0 ${currentTrack.color}`}
                />
                <div className="flex flex-col text-center sm:text-left overflow-hidden">
                  <span className="text-sm font-semibold truncate text-white">
                    {currentTrack.title}{currentTrack.subtitle ? ` (${currentTrack.subtitle})` : ''}
                  </span>
                  <span className="text-xs text-gray-400 truncate">{currentTrack.artist}</span>
                </div>
              </>
            ) : (
              <span className="text-sm text-gray-500">Select a track to play</span>
            )}
          </div>

          {/* Right: Waveform + Buy/Stream */}
          <div className="flex items-center gap-6 min-w-[150px] justify-end">
            {/* Animated waveform */}
            <div className="hidden md:flex items-end gap-[3px] h-8 opacity-70">
              {WAVEFORM.map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full transition-all duration-300"
                  style={{
                    height: isPlaying ? `${h * 4}px` : '6px',
                    background: i < 5 ? '#ff00ff' : i < 10 ? '#a855f7' : '#00ffff',
                    animation: isPlaying ? `pulse ${0.4 + (i % 4) * 0.15}s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Buy/Stream</span>
              <div className="flex gap-2">
                <button className="text-green-500 hover:opacity-80 transition-opacity">
                  <Music className="w-5 h-5" />
                </button>
                <button className="text-red-500 hover:opacity-80 transition-opacity">
                  <Music4 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
