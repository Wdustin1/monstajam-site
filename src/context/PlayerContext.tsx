'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';

export interface PlayerTrack {
  slug: string;
  title: string;
  artist: string;
  color: string;
  subtitle?: string | null;
  audioUrl?: string | null;
  coverUrl?: string | null;
  genre?: string | null;
  bpm?: number | null;
  number?: number | null;
}

interface PlayerContextValue {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  currentTime: number;
  shuffleOn: boolean;
  repeatOn: boolean;
  play: (track: PlayerTrack) => void;
  pause: () => void;
  toggle: (track: PlayerTrack) => void;
  seek: (fraction: number) => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setQueue: (tracks: PlayerTrack[]) => void;
}

const PlayerContext = createContext<PlayerContextValue>({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  duration: 180,
  currentTime: 0,
  shuffleOn: false,
  repeatOn: false,
  play: () => {},
  pause: () => {},
  toggle: () => {},
  seek: () => {},
  next: () => {},
  prev: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
  setQueue: () => {},
});

const DEFAULT_DURATION = 180;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueueState] = useState<PlayerTrack[]>([]);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const duration = DEFAULT_DURATION;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 1) {
            clearInterval(intervalRef.current!);
            // Auto-advance when track ends
            if (repeatOn) return 0;
            return 1;
          }
          return p + 0.1 / duration;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, duration, repeatOn]);

  // Auto-next when track finishes
  useEffect(() => {
    if (progress >= 1 && !repeatOn) {
      const timer = setTimeout(() => {
        nextTrack();
      }, 400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, repeatOn]);

  useEffect(() => {
    setProgress(0);
  }, [currentTrack?.slug]);

  const play = (track: PlayerTrack) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const pause = () => setIsPlaying(false);

  const toggle = (track: PlayerTrack) => {
    if (currentTrack?.slug === track.slug) {
      setIsPlaying((prev) => !prev);
    } else {
      play(track);
    }
  };

  const seek = (fraction: number) => {
    setProgress(Math.max(0, Math.min(1, fraction)));
  };

  const setQueue = useCallback((tracks: PlayerTrack[]) => {
    setQueueState(tracks);
  }, []);

  const nextTrack = useCallback(() => {
    if (!queue.length) return;
    if (shuffleOn) {
      const idx = Math.floor(Math.random() * queue.length);
      play(queue[idx]);
      return;
    }
    const currentIdx = currentTrack ? queue.findIndex((t) => t.slug === currentTrack.slug) : -1;
    const nextIdx = (currentIdx + 1) % queue.length;
    play(queue[nextIdx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentTrack, shuffleOn]);

  const prevTrack = useCallback(() => {
    if (!queue.length) return;
    // If more than 3s in, restart current track
    if (progress > 0.03 && currentTrack) {
      seek(0);
      setIsPlaying(true);
      return;
    }
    const currentIdx = currentTrack ? queue.findIndex((t) => t.slug === currentTrack.slug) : 0;
    const prevIdx = (currentIdx - 1 + queue.length) % queue.length;
    play(queue[prevIdx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentTrack, progress]);

  const toggleShuffle = () => setShuffleOn((v) => !v);
  const toggleRepeat = () => setRepeatOn((v) => !v);

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      progress,
      duration,
      currentTime: progress * duration,
      shuffleOn,
      repeatOn,
      play,
      pause,
      toggle,
      seek,
      next: nextTrack,
      prev: prevTrack,
      toggleShuffle,
      toggleRepeat,
      setQueue,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
