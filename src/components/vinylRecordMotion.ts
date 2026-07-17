import type { PlayerTrack } from '@/context/PlayerContext';

export const TONEARM_REST_DEGREES = -5;
export const TONEARM_PLAY_START_DEGREES = 42;
export const TONEARM_PLAY_END_DEGREES = 50;

export function clampPlaybackProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

export function getTonearmRotation(isPlaying: boolean, progress: number) {
  if (!isPlaying) return TONEARM_REST_DEGREES;

  const clampedProgress = clampPlaybackProgress(progress);
  return (
    TONEARM_PLAY_START_DEGREES +
    (TONEARM_PLAY_END_DEGREES - TONEARM_PLAY_START_DEGREES) * clampedProgress
  );
}

export function getControlledTurntableTrack({
  currentTrack,
  featuredTrack,
  isPlaying,
}: {
  currentTrack: PlayerTrack | null;
  featuredTrack?: PlayerTrack | null;
  isPlaying: boolean;
}) {
  const displayTrack = featuredTrack ?? currentTrack;
  const clickTrack = featuredTrack ?? currentTrack;
  const activeTrackSlug = clickTrack?.slug ?? null;
  const isControlledTrackActive = Boolean(
    activeTrackSlug && currentTrack?.slug === activeTrackSlug,
  );

  return {
    displayTrack,
    clickTrack,
    isTurntablePlaying: isPlaying && isControlledTrackActive,
  };
}
