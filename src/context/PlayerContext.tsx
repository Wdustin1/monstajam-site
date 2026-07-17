'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import {
  getNextTrack,
  getPlaybackDuration,
  getPlaybackProgress,
  getPreviousTrack,
  isPreviewTrack,
  readPlayerSnapshot,
  writePlayerSnapshot,
} from '@/lib/player-comfort';

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
  queue: PlayerTrack[];
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
  queue: [],
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

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueueState] = useState<PlayerTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(0.75);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const currentTimeRef = useRef(0);
  const volumeRef = useRef(0.75);
  const shuffleOnRef = useRef(false);
  const repeatOnRef = useRef(false);
  const nextTrackRef = useRef<() => void>(() => {});
  const pendingRestoreRef = useRef<(() => void) | null>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    shuffleOnRef.current = shuffleOn;
  }, [shuffleOn]);

  useEffect(() => {
    repeatOnRef.current = repeatOn;
  }, [repeatOn]);

  const persistSnapshot = useCallback(() => {
    if (!hasRestoredRef.current) return;
    const activeTrack = currentTrackRef.current;
    if (!activeTrack) return;
    const audioTime = audioRef.current?.currentTime;
    const exactTime = typeof audioTime === 'number' && Number.isFinite(audioTime)
      ? audioTime
      : currentTimeRef.current;

    writePlayerSnapshot(getBrowserStorage(), {
      currentTrack: activeTrack,
      queue: queueRef.current,
      currentTime: Math.max(0, exactTime),
      volume: volumeRef.current,
      shuffleOn: shuffleOnRef.current,
      repeatOn: repeatOnRef.current,
    });
  }, []);

  const clearPendingRestore = useCallback((audio: HTMLAudioElement) => {
    const pendingRestore = pendingRestoreRef.current;
    if (!pendingRestore) return;
    audio.removeEventListener('loadedmetadata', pendingRestore);
    pendingRestoreRef.current = null;
    hasRestoredRef.current = true;
  }, []);

  const startAudio = useCallback((audio: HTMLAudioElement) => {
    void audio.play().catch(() => setIsPlaying(false));
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const audio = document.createElement('audio');
    const restoredSnapshot = readPlayerSnapshot(getBrowserStorage());

    audio.volume = restoredSnapshot?.volume ?? 0.75;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('data-monstajam-player', 'true');
    audio.style.display = 'none';
    document.body.appendChild(audio);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      const activeTrack = currentTrackRef.current;
      const playbackDuration = getPlaybackDuration(activeTrack, audio.duration);

      if (
        isPreviewTrack(activeTrack)
        && audio.duration > playbackDuration + 0.05
        && audio.currentTime >= playbackDuration
      ) {
        audio.pause();
        audio.dispatchEvent(new Event('ended'));
        return;
      }

      currentTimeRef.current = audio.currentTime;
      setDuration(playbackDuration);
      setCurrentTime(audio.currentTime);
      setProgress(getPlaybackProgress(activeTrack, audio.currentTime, audio.duration));
    };

    const handleLoadedMetadata = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      setDuration(getPlaybackDuration(currentTrackRef.current, audio.duration));
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEmptied = () => setIsPlaying(false);
    const handleError = () => {
      clearPendingRestore(audio);
      setIsPlaying(false);
    };

    const handleEnded = () => {
      audio.currentTime = 0;
      currentTimeRef.current = 0;
      setProgress(0);
      setCurrentTime(0);
      if (repeatOnRef.current) {
        startAudio(audio);
      } else {
        nextTrackRef.current();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('emptied', handleEmptied);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    if (restoredSnapshot) {
      const restoredTrack = restoredSnapshot.currentTrack;
      currentTrackRef.current = restoredTrack;
      queueRef.current = restoredSnapshot.queue;
      currentTimeRef.current = restoredSnapshot.currentTime;
      volumeRef.current = restoredSnapshot.volume;
      shuffleOnRef.current = restoredSnapshot.shuffleOn;
      repeatOnRef.current = restoredSnapshot.repeatOn;

      queueMicrotask(() => {
        if (isCancelled) return;
        setCurrentTrack(restoredTrack);
        setQueueState(restoredSnapshot.queue);
        setVolumeState(restoredSnapshot.volume);
        setShuffleOn(restoredSnapshot.shuffleOn);
        setRepeatOn(restoredSnapshot.repeatOn);
        setDuration(getPlaybackDuration(restoredTrack, 0));
      });

      if (restoredTrack.audioUrl) {
        const restorePosition = () => {
          if (pendingRestoreRef.current !== restorePosition) return;
          pendingRestoreRef.current = null;
          if (currentTrackRef.current?.slug !== restoredTrack.slug) return;
          const playbackDuration = getPlaybackDuration(restoredTrack, audio.duration);
          const resumeTime = restoredSnapshot.currentTime >= playbackDuration - 1
            ? 0
            : Math.min(restoredSnapshot.currentTime, playbackDuration);
          audio.currentTime = resumeTime;
          currentTimeRef.current = resumeTime;
          setCurrentTime(resumeTime);
          setDuration(playbackDuration);
          setProgress(getPlaybackProgress(restoredTrack, resumeTime, audio.duration));
          hasRestoredRef.current = true;
          persistSnapshot();
        };
        pendingRestoreRef.current = restorePosition;
        audio.addEventListener('loadedmetadata', restorePosition, { once: true });
        audio.src = restoredTrack.audioUrl;
        audio.load();
      } else {
        hasRestoredRef.current = true;
        persistSnapshot();
      }
    } else {
      hasRestoredRef.current = true;
    }

    return () => {
      isCancelled = true;
      clearPendingRestore(audio);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('emptied', handleEmptied);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
      audio.load();
      audio.remove();
      if (audioRef.current === audio) audioRef.current = null;
      hasRestoredRef.current = false;
    };
  }, [clearPendingRestore, persistSnapshot, startAudio]);

  useEffect(() => {
    window.addEventListener('pagehide', persistSnapshot);
    return () => window.removeEventListener('pagehide', persistSnapshot);
  }, [persistSnapshot]);

  const play = useCallback((track: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrackRef.current?.slug !== track.slug) {
      clearPendingRestore(audio);
      currentTrackRef.current = track;
      currentTimeRef.current = 0;
      setCurrentTrack(track);
      setProgress(0);
      setCurrentTime(0);
      setDuration(getPlaybackDuration(track, 0));

      if (track.audioUrl) {
        audio.src = track.audioUrl;
        audio.load();
        startAudio(audio);
      } else {
        setIsPlaying(false);
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    if (!track.audioUrl) return;
    if (!audio.src) {
      clearPendingRestore(audio);
      audio.src = track.audioUrl;
      audio.load();
    }
    if (audio.duration && Number.isFinite(audio.duration)) {
      const playbackDuration = getPlaybackDuration(track, audio.duration);
      if (audio.currentTime >= playbackDuration - 0.05) {
        audio.currentTime = 0;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setProgress(0);
      }
    }
    startAudio(audio);
  }, [clearPendingRestore, startAudio]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (Number.isFinite(audio.currentTime)) {
        currentTimeRef.current = audio.currentTime;
        setCurrentTime(audio.currentTime);
      }
    }
    persistSnapshot();
  }, [persistSnapshot]);

  const toggle = useCallback((track: PlayerTrack) => {
    if (currentTrackRef.current?.slug === track.slug) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        if (track.audioUrl) startAudio(audio);
      } else {
        pause();
      }
      return;
    }
    play(track);
  }, [pause, play, startAudio]);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const playbackDuration = getPlaybackDuration(currentTrackRef.current, audio.duration);
    const t = Math.max(0, Math.min(1, fraction)) * playbackDuration;
    audio.currentTime = t;
    currentTimeRef.current = t;
    setCurrentTime(t);
    setProgress(getPlaybackProgress(currentTrackRef.current, t, audio.duration));
    persistSnapshot();
  }, [persistSnapshot]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    persistSnapshot();
  }, [persistSnapshot]);

  const setQueue = useCallback((tracks: PlayerTrack[]) => {
    queueRef.current = tracks;
    setQueueState(tracks);
    persistSnapshot();
  }, [persistSnapshot]);

  const nextTrackFn = useCallback(() => {
    const nextTrack = getNextTrack(
      queueRef.current,
      currentTrackRef.current?.slug,
      shuffleOnRef.current,
    );
    if (nextTrack) play(nextTrack);
  }, [play]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setProgress(0);
      persistSnapshot();
      return;
    }

    const previousTrack = getPreviousTrack(queueRef.current, currentTrackRef.current?.slug);
    if (previousTrack) {
      play(previousTrack);
    } else if (audio && currentTrackRef.current) {
      audio.currentTime = 0;
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setProgress(0);
      persistSnapshot();
    }
  }, [persistSnapshot, play]);

  useEffect(() => {
    nextTrackRef.current = nextTrackFn;
  }, [nextTrackFn]);

  const resumeCheckpoint = Math.floor(currentTime / 5);
  useEffect(() => {
    if (!currentTrack) return;
    persistSnapshot();
  }, [currentTrack, queue, resumeCheckpoint, volume, shuffleOn, repeatOn, persistSnapshot]);

  const toggleShuffle = useCallback(() => {
    const nextValue = !shuffleOnRef.current;
    shuffleOnRef.current = nextValue;
    setShuffleOn(nextValue);
    persistSnapshot();
  }, [persistSnapshot]);

  const toggleRepeat = useCallback(() => {
    const nextValue = !repeatOnRef.current;
    repeatOnRef.current = nextValue;
    setRepeatOn(nextValue);
    persistSnapshot();
  }, [persistSnapshot]);

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      queue,
      shuffleOn,
      repeatOn,
      isPlaying,
      progress,
      duration,
      currentTime,
      volume,
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
