'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { Track } from '@prisma/client';

interface PlayerContextValue {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;      // 0–1
  duration: number;      // seconds
  currentTime: number;   // seconds elapsed
  play: (track: Track) => void;
  pause: () => void;
  toggle: (track: Track) => void;
  seek: (fraction: number) => void;
}

const PlayerContext = createContext<PlayerContextValue>({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  duration: 180,
  currentTime: 0,
  play: () => {},
  pause: () => {},
  toggle: () => {},
  seek: () => {},
});

const DEFAULT_DURATION = 180; // 3 minutes for demo tracks

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const duration = DEFAULT_DURATION;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick progress forward while playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 1) {
            clearInterval(intervalRef.current!);
            return 1;
          }
          return p + 0.1 / duration; // ~100ms ticks
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, duration]);

  // Reset progress when track changes
  useEffect(() => {
    setProgress(0);
  }, [currentTrack?.slug]);

  const play = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const pause = () => setIsPlaying(false);

  const toggle = (track: Track) => {
    if (currentTrack?.slug === track.slug) {
      setIsPlaying((prev) => !prev);
    } else {
      play(track);
    }
  };

  const seek = (fraction: number) => {
    setProgress(Math.max(0, Math.min(1, fraction)));
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      progress,
      duration,
      currentTime: progress * duration,
      play,
      pause,
      toggle,
      seek,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
