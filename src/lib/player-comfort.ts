import { isHttpMediaUrl, normalizeAllowedCoverUrl } from './media-url';

export const PREVIEW_CAP_SECONDS = 45;
export const PLAYER_STORAGE_KEY = 'monstajam-player-state-v1';
export const PLAYER_SNAPSHOT_VERSION = 1;

export type PlaybackTrack = {
  genre?: string | null;
};

export type QueueTrack = {
  slug: string;
};

export function isPreviewTrack(track: PlaybackTrack | null | undefined) {
  return track?.genre !== 'Full Songs';
}

export function getPlaybackDuration(
  track: PlaybackTrack | null | undefined,
  sourceDuration: number,
) {
  const finiteDuration = Number.isFinite(sourceDuration) && sourceDuration > 0
    ? sourceDuration
    : 0;

  if (!isPreviewTrack(track)) return finiteDuration;
  if (!finiteDuration) return PREVIEW_CAP_SECONDS;
  return Math.min(finiteDuration, PREVIEW_CAP_SECONDS);
}

export function getPlaybackProgress(
  track: PlaybackTrack | null | undefined,
  currentTime: number,
  sourceDuration: number,
) {
  const playbackDuration = getPlaybackDuration(track, sourceDuration);
  if (!playbackDuration) return 0;
  return Math.min(1, Math.max(0, currentTime / playbackDuration));
}

export function getPreviewLabel(
  track: PlaybackTrack | null | undefined,
  effectiveDuration: number,
) {
  if (!isPreviewTrack(track)) return 'Full track';
  const seconds = Number.isFinite(effectiveDuration) && effectiveDuration > 0
    ? Math.ceil(Math.min(effectiveDuration, PREVIEW_CAP_SECONDS))
    : PREVIEW_CAP_SECONDS;
  return `${seconds} sec preview`;
}

export function getNextTrack<T extends QueueTrack>(
  queue: readonly T[],
  currentSlug: string | null | undefined,
  shuffleOn: boolean,
  random: () => number = Math.random,
): T | null {
  if (!queue.length) return null;
  const currentIndex = currentSlug
    ? queue.findIndex((track) => track.slug === currentSlug)
    : -1;

  if (shuffleOn) {
    const candidates = currentSlug
      ? queue.filter((track) => track.slug !== currentSlug)
      : [...queue];
    if (!candidates.length) return null;
    const sample = Math.min(0.999999, Math.max(0, random()));
    return candidates[Math.floor(sample * candidates.length)] ?? null;
  }

  if (currentIndex < 0) return queue[0];
  for (let offset = 1; offset <= queue.length; offset += 1) {
    const candidate = queue[(currentIndex + offset) % queue.length];
    if (candidate.slug !== currentSlug) return candidate;
  }
  return null;
}

export function getPreviousTrack<T extends QueueTrack>(
  queue: readonly T[],
  currentSlug: string | null | undefined,
): T | null {
  if (!queue.length) return null;
  const currentIndex = currentSlug
    ? queue.findIndex((track) => track.slug === currentSlug)
    : -1;
  if (currentIndex < 0) return queue[queue.length - 1];
  for (let offset = 1; offset <= queue.length; offset += 1) {
    const candidate = queue[(currentIndex - offset + queue.length) % queue.length];
    if (candidate.slug !== currentSlug) return candidate;
  }
  return null;
}

export type PlayerSnapshotTrack = PlaybackTrack & {
  slug: string;
  title: string;
  artist: string;
  color: string;
  subtitle?: string | null;
  audioUrl?: string | null;
  coverUrl?: string | null;
  bpm?: number | null;
  number?: number | null;
};

export type PlayerSnapshot = {
  currentTrack: PlayerSnapshotTrack;
  queue: PlayerSnapshotTrack[];
  currentTime: number;
  volume: number;
  shuffleOn: boolean;
  repeatOn: boolean;
};

type PlayerStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRequiredString(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isOptionalString(value: unknown, maxLength: number) {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= maxLength);
}

function isSafeAudioUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || value.length > 500) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return isHttpMediaUrl(value);
}

function isSafeCoverUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && normalizeAllowedCoverUrl(value) !== null;
}

function isOptionalInteger(value: unknown, min: number, max: number) {
  return value === undefined || value === null
    || (typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max);
}

function isSnapshotTrack(value: unknown): value is PlayerSnapshotTrack {
  if (!isRecord(value)) return false;
  if (!isRequiredString(value.slug, 200) || !/^[a-z0-9-]+$/.test(value.slug as string)) return false;
  if (!isRequiredString(value.title, 200) || !isRequiredString(value.artist, 200)) return false;
  if (!isOptionalString(value.color, 200) || !isOptionalString(value.subtitle, 200) || !isOptionalString(value.genre, 100)) return false;
  if (!isSafeAudioUrl(value.audioUrl) || !isSafeCoverUrl(value.coverUrl)) return false;
  if (!isOptionalInteger(value.bpm, 40, 300) || !isOptionalInteger(value.number, 1, Number.MAX_SAFE_INTEGER)) return false;
  return true;
}

function toSnapshotTrack(track: PlayerSnapshotTrack): PlayerSnapshotTrack {
  const snapshot: PlayerSnapshotTrack = {
    slug: track.slug,
    title: track.title,
    artist: track.artist,
    color: typeof track.color === 'string' ? track.color : '',
  };
  if (track.subtitle !== undefined) snapshot.subtitle = track.subtitle;
  if (track.audioUrl !== undefined) snapshot.audioUrl = track.audioUrl;
  if (track.coverUrl !== undefined) {
    snapshot.coverUrl = track.coverUrl ? normalizeAllowedCoverUrl(track.coverUrl) : track.coverUrl;
  }
  if (track.genre !== undefined) snapshot.genre = track.genre;
  if (track.bpm !== undefined) snapshot.bpm = track.bpm;
  if (track.number !== undefined) snapshot.number = track.number;
  return snapshot;
}

export function serializePlayerSnapshot(snapshot: PlayerSnapshot) {
  const seenSlugs = new Set<string>();
  const queue = snapshot.queue.filter((track) => {
    if (seenSlugs.has(track.slug)) return false;
    seenSlugs.add(track.slug);
    return true;
  }).slice(0, 200).map(toSnapshotTrack);

  return JSON.stringify({
    version: PLAYER_SNAPSHOT_VERSION,
    ...snapshot,
    currentTrack: toSnapshotTrack(snapshot.currentTrack),
    queue,
  });
}

export function parsePlayerSnapshot(value: string | null): PlayerSnapshot | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== PLAYER_SNAPSHOT_VERSION) return null;
    if (!isSnapshotTrack(parsed.currentTrack)) return null;
    if (!Array.isArray(parsed.queue) || parsed.queue.length > 200 || !parsed.queue.every(isSnapshotTrack)) return null;
    const queueSlugs = parsed.queue.map((track) => track.slug);
    if (new Set(queueSlugs).size !== queueSlugs.length) return null;
    if (typeof parsed.currentTime !== 'number' || !Number.isFinite(parsed.currentTime) || parsed.currentTime < 0 || parsed.currentTime > 86400) return null;
    if (typeof parsed.volume !== 'number' || !Number.isFinite(parsed.volume) || parsed.volume < 0 || parsed.volume > 1) return null;
    if (typeof parsed.shuffleOn !== 'boolean' || typeof parsed.repeatOn !== 'boolean') return null;

    return {
      currentTrack: toSnapshotTrack(parsed.currentTrack),
      queue: parsed.queue.map(toSnapshotTrack),
      currentTime: parsed.currentTime,
      volume: parsed.volume,
      shuffleOn: parsed.shuffleOn,
      repeatOn: parsed.repeatOn,
    };
  } catch {
    return null;
  }
}

export function readPlayerSnapshot(storage: PlayerStorage | null | undefined) {
  if (!storage) return null;
  try {
    return parsePlayerSnapshot(storage.getItem(PLAYER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writePlayerSnapshot(
  storage: PlayerStorage | null | undefined,
  snapshot: PlayerSnapshot,
) {
  if (!storage) return false;
  try {
    storage.setItem(PLAYER_STORAGE_KEY, serializePlayerSnapshot(snapshot));
    return true;
  } catch {
    return false;
  }
}
