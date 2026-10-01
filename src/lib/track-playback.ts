export type PlaybackMode = 'preview' | 'full';

export const PREVIEW_SECONDS = 45;

interface PlaybackTrack {
  genre?: string | null;
  playbackMode?: string | null;
}

export function getPlaybackMode(track: PlaybackTrack): PlaybackMode {
  if (track.playbackMode === 'full' || track.playbackMode === 'preview') {
    return track.playbackMode;
  }
  // Only unmigrated records retain the old genre-based behavior.
  if (track.playbackMode == null && track.genre === 'Full Songs') return 'full';
  return 'preview';
}

export function getPlaybackDuration(track: PlaybackTrack, sourceDuration: number): number {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return 0;
  return getPlaybackMode(track) === 'full'
    ? sourceDuration
    : Math.min(PREVIEW_SECONDS, sourceDuration);
}

interface PlaybackSource extends PlaybackTrack {
  slug: string;
  audioUrl?: string | null;
}

export function isSamePlayback(a: PlaybackSource | null, b: PlaybackSource): boolean {
  return a !== null && a.slug === b.slug &&
    (a.audioUrl ?? null) === (b.audioUrl ?? null) &&
    getPlaybackMode(a) === getPlaybackMode(b);
}

export interface PublicTrackSource extends PlaybackSource {
  title: string;
  artist: string;
  color: string;
  id?: string;
  number?: number | null;
  subtitle?: string | null;
  bpm?: number | null;
  mood?: string | null;
  accentCyan?: boolean | null;
  story?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  coverUrl?: string | null;
  published?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  audioAssetId?: string | null;
  credits?: { id: string; trackId: string; role: string; name: string }[];
}

// Use at every public JSON and RSC boundary. In particular, never spread a
// database record: future private columns or asset relations must stay private.
export function toPublicTrack(track: PublicTrackSource) {
  const revision = track.updatedAt instanceof Date
    ? track.updatedAt.getTime()
    : Date.parse(track.updatedAt ?? '');
  // A new upload for the same slug/mode must replace any buffered audio. Use
  // public metadata for the revision so private asset identifiers stay hidden.
  const revisionQuery = Number.isFinite(revision) ? `?v=${revision}` : '';
  return {
    id: track.id,
    slug: track.slug,
    number: track.number,
    title: track.title,
    subtitle: track.subtitle,
    artist: track.artist,
    genre: track.genre,
    bpm: track.bpm,
    mood: track.mood,
    color: track.color,
    accentCyan: track.accentCyan,
    story: track.story,
    spotifyUrl: track.spotifyUrl,
    appleMusicUrl: track.appleMusicUrl,
    audioUrl: track.audioAssetId
      ? `/api/audio/${encodeURIComponent(track.slug)}${revisionQuery}`
      : track.audioUrl,
    coverUrl: track.coverUrl,
    playbackMode: getPlaybackMode(track),
    published: track.published,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
    credits: track.credits?.map(({ id, trackId, role, name }) => ({ id, trackId, role, name })),
  };
}

export type PublicTrack = ReturnType<typeof toPublicTrack>;
