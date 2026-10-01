'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { getPlaybackDuration, getPlaybackMode, isSamePlayback, PREVIEW_SECONDS, type PlaybackMode } from '@/lib/track-playback';

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
  playbackMode?: PlaybackMode | null;
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
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef(false);

  const play = useCallback((track: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;

    // A public preview and an admin audition of the same song are different
    // sources. Never resume a full audition when the user selects its preview.
    if (!isSamePlayback(currentTrackRef.current, track)) {
      audio.pause();
      currentTrackRef.current = track;
      setCurrentTrack(track);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      if (track.audioUrl) {
        audio.src = track.audioUrl;
      } else {
        audio.removeAttribute('src');
        audio.load();
        return;
      }
    }

    if (!track.audioUrl) return;
    const playableDuration = getPlaybackDuration(track, audio.duration);
    if (audio.ended || (playableDuration > 0 && audio.currentTime >= playableDuration)) {
      audio.currentTime = 0;
    }
    void audio.play().catch(() => {
      if (audio.paused) setIsPlaying(false);
    });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback((track: PlayerTrack) => {
    const audio = audioRef.current;
    if (isSamePlayback(currentTrackRef.current, track) && audio && !audio.paused) {
      pause();
    } else {
      play(track);
    }
  }, [pause, play]);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    const track = currentTrackRef.current;
    if (!audio || !track || !Number.isFinite(fraction)) return;
    const playableDuration = getPlaybackDuration(track, audio.duration);
    if (!playableDuration) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    const time = clamped * playableDuration;
    audio.currentTime = time;
    setCurrentTime(time);
    setProgress(clamped);
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setQueue = useCallback((tracks: PlayerTrack[]) => {
    queueRef.current = tracks;
  }, []);

  const nextTrack = useCallback(() => {
    const queue = queueRef.current;
    if (!queue.length) return;
    const current = currentTrackRef.current;
    const index = current ? queue.findIndex(track => track.slug === current.slug) : -1;
    const nextIndex = shuffleRef.current
      ? Math.floor(Math.random() * queue.length)
      : (index + 1) % queue.length;
    play(queue[nextIndex]);
  }, [play]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setProgress(0);
      return;
    }
    const queue = queueRef.current;
    if (!queue.length) return;
    const current = currentTrackRef.current;
    const index = current ? queue.findIndex(track => track.slug === current.slug) : 0;
    const previousIndex = (Math.max(0, index) - 1 + queue.length) % queue.length;
    play(queue[previousIndex]);
  }, [play]);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.75;
    audio.preload = 'metadata';
    audioRef.current = audio;

    const finishTrack = () => {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (repeatRef.current && currentTrackRef.current) {
        play(currentTrackRef.current);
      } else {
        nextTrack();
      }
    };
    const updateTime = () => {
      const track = currentTrackRef.current;
      if (!track) return;
      // Managed songs use an actual clip. This cap preserves preview behavior
      // for legacy public files until they are replaced with managed audio.
      if (getPlaybackMode(track) === 'preview' && audio.currentTime >= PREVIEW_SECONDS && !audio.paused) {
        finishTrack();
        return;
      }
      const playableDuration = getPlaybackDuration(track, audio.duration);
      const time = Math.min(audio.currentTime, playableDuration);
      setCurrentTime(time);
      setProgress(playableDuration ? time / playableDuration : 0);
    };
    const updateDuration = () => {
      const track = currentTrackRef.current;
      setDuration(track ? getPlaybackDuration(track, audio.duration) : 0);
    };
    const handlePlaying = () => setIsPlaying(true);
    const handleStopped = () => setIsPlaying(false);
    const handleEnded = () => {
      // A queued native ended event may arrive after the preview cap has
      // already advanced the source. Only finish audio that is still ended.
      if (audio.ended) finishTrack();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handleStopped);
    audio.addEventListener('error', handleStopped);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handleStopped);
      audio.removeEventListener('error', handleStopped);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, [nextTrack, play]);

  const toggleShuffle = () => {
    shuffleRef.current = !shuffleRef.current;
    setShuffleOn(shuffleRef.current);
  };
  const toggleRepeat = () => {
    repeatRef.current = !repeatRef.current;
    setRepeatOn(repeatRef.current);
  };

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
