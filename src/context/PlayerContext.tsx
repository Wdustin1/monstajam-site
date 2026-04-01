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
  volume: number;
  shuffleOn: boolean;
  repeatOn: boolean;
  play: (track: PlayerTrack) => void;
  pause: () => void;
  toggle: (track: PlayerTrack) => void;
  seek: (fraction: number) => void;
  setVolume: (v: number) => void;
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
  duration: 0,
  currentTime: 0,
  volume: 0.75,
  shuffleOn: false,
  repeatOn: false,
  play: () => {},
  pause: () => {},
  toggle: () => {},
  seek: () => {},
  setVolume: () => {},
  next: () => {},
  prev: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
  setQueue: () => {},
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(0.75);
  const [queue, setQueueState] = useState<PlayerTrack[]>([]);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<PlayerTrack | null>(null);

  // Keep ref in sync for use in callbacks
  currentTrackRef.current = currentTrack;

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = 'metadata';

    const PREVIEW_CAP = 45; // seconds

    audio.addEventListener('timeupdate', () => {
      if (audio.duration && isFinite(audio.duration)) {
        // Cap playback at PREVIEW_CAP seconds
        if (audio.currentTime >= PREVIEW_CAP) {
          audio.pause();
          audio.dispatchEvent(new Event('ended'));
          return;
        }
        setCurrentTime(audio.currentTime);
        setProgress(audio.currentTime / audio.duration);
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      // Auto-advance handled via state update below
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-advance when track ends
  const [trackEnded, setTrackEnded] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => setTrackEnded(true);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  useEffect(() => {
    if (trackEnded) {
      setTrackEnded(false);
      if (repeatOn) {
        const audio = audioRef.current;
        if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); setIsPlaying(true); }
      } else {
        nextTrackFn();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackEnded, repeatOn]);

  // Reset state on track change
  useEffect(() => {
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack?.slug]);

  const play = useCallback((track: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrackRef.current?.slug !== track.slug) {
      // New track
      setCurrentTrack(track);
      if (track.audioUrl) {
        audio.src = track.audioUrl;
        audio.play().catch((e) => { console.warn('play() failed:', e); });
        setIsPlaying(true);
      } else {
        // No audio URL — still update UI but can't play
        audio.src = '';
        setIsPlaying(false);
      }
    } else {
      // Same track — resume
      if (track.audioUrl) {
        audio.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback((track: PlayerTrack) => {
    if (currentTrackRef.current?.slug === track.slug) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        if (track.audioUrl) { audio.play().catch(() => {}); setIsPlaying(true); }
      } else {
        audio.pause(); setIsPlaying(false);
      }
    } else {
      play(track);
    }
  }, [play]);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const t = Math.max(0, Math.min(1, fraction)) * audio.duration;
    audio.currentTime = t;
    setCurrentTime(t);
    setProgress(fraction);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setQueue = useCallback((tracks: PlayerTrack[]) => {
    setQueueState(tracks);
  }, []);

  const nextTrackFn = useCallback(() => {
    setQueueState(q => {
      if (!q.length) return q;
      const current = currentTrackRef.current;
      let nextIdx: number;
      if (shuffleOn) {
        nextIdx = Math.floor(Math.random() * q.length);
      } else {
        const idx = current ? q.findIndex(t => t.slug === current.slug) : -1;
        nextIdx = (idx + 1) % q.length;
      }
      // Play after state update
      setTimeout(() => play(q[nextIdx]), 0);
      return q;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffleOn, play]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    // If > 3s in, restart current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setProgress(0);
      return;
    }
    setQueueState(q => {
      if (!q.length) return q;
      const current = currentTrackRef.current;
      const idx = current ? q.findIndex(t => t.slug === current.slug) : 0;
      const prevIdx = (idx - 1 + q.length) % q.length;
      setTimeout(() => play(q[prevIdx]), 0);
      return q;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const toggleShuffle = () => setShuffleOn(v => !v);
  const toggleRepeat = () => setRepeatOn(v => !v);

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      progress,
      duration,
      currentTime,
      volume,
      shuffleOn,
      repeatOn,
      play,
      pause,
      toggle,
      seek,
      setVolume,
      next: nextTrackFn,
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
