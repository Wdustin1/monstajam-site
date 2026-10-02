import type { AudioAsset, Credit, Track, Video } from '@prisma/client';
import { prisma } from './prisma';
import { TrackCreateSchema, VideoCreateSchema } from './schemas';
import { parseCoverSource } from './cover-source';
import { getPlaybackMode, PREVIEW_SECONDS } from './track-playback';
import { extractYouTubeId } from './youtube';
import type { PublishingCheck, TrackPublishingReview, VideoPublishingReview } from './publishing-types';

export const SAVE_DRAFT_FIRST = 'Save this item as a draft, then review it before publishing.';
export const REVIEW_AGAIN = 'Review the saved item again before publishing.';
export const audioReviewSelect = { status: true, originalPath: true, previewPath: true, previewStart: true, previewDuration: true } as const;
type ReviewAsset = Pick<AudioAsset, keyof typeof audioReviewSelect>;
type ReviewTrack = Track & { credits?: Credit[] };

function nonempty(value: unknown, maximum: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}
function validLegacyUrl(value: string | null): boolean {
  if (!value) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function nullableNumber(value: number | null | undefined) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function dates<T extends { createdAt: Date; updatedAt: Date; deletedAt?: Date | null }>(record: T) {
  return { ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), deletedAt: record.deletedAt?.toISOString() ?? null };
}

export function buildTrackPublishingReview(track: ReviewTrack, asset: ReviewAsset | null, allowLegacyLive = track.published): TrackPublishingReview {
  const checks: PublishingCheck[] = [];
  const normalized = {
    ...track,
    subtitle: track.subtitle ?? undefined, genre: track.genre, color: track.color,
    audioUrl: track.audioUrl ?? undefined, coverUrl: track.coverUrl ?? undefined,
    audioAssetId: track.audioAssetId ?? undefined, playbackMode: track.playbackMode ?? undefined,
  };
  const metadata = TrackCreateSchema.safeParse(normalized);
  const metadataReady = metadata.success && nonempty(track.title, 200) && nonempty(track.artist, 200) && nonempty(track.genre, 100) && nonempty(track.color, 200);
  checks.push({ key: 'metadata', label: 'Track details', status: metadataReady ? 'ready' : 'blocked', message: metadataReady ? 'Title, artist, genre and saved details are valid.' : 'Add a valid title, artist and genre, and correct any invalid saved details before publishing.' });
  const mode = getPlaybackMode(track);
  const duration = nullableNumber(asset?.previewDuration);
  const start = nullableNumber(asset?.previewStart);
  const managedReady = Boolean(track.audioAssetId && asset?.status === 'ready' && nonempty(asset.originalPath, 2048) && nonempty(asset.previewPath, 2048) && duration !== null && duration > 0 && duration <= PREVIEW_SECONDS && start !== null && start >= 0);
  const legacyReady = !track.audioAssetId && allowLegacyLive && validLegacyUrl(track.audioUrl);
  let audioStatus: TrackPublishingReview['audio']['status'] = 'missing';
  if (track.audioAssetId && asset) audioStatus = ['ready', 'processing', 'failed'].includes(asset.status) ? asset.status as 'ready' | 'processing' | 'failed' : 'failed';
  else if (!track.audioAssetId && track.audioUrl) audioStatus = 'legacy';
  checks.push({
    key: 'audio', label: 'Audio and preview', status: managedReady ? 'ready' : legacyReady ? 'warning' : 'blocked',
    message: managedReady ? 'The original and processed preview are ready.' : legacyReady ? 'This live track keeps its existing legacy audio. Upload managed audio before publishing it again from a draft.' : audioStatus === 'processing' ? 'Audio is still processing. Wait for it to finish, then review again.' : audioStatus === 'failed' ? 'Audio processing failed. Prepare a new audio upload before publishing.' : audioStatus === 'legacy' ? 'Upload and process managed audio before publishing this draft.' : 'Upload audio and finish preparing a playable preview before publishing.',
  });
  const artworkReady = Boolean(parseCoverSource(track.coverUrl));
  checks.push({ key: 'artwork', label: 'Cover artwork', status: artworkReady ? 'ready' : 'warning', message: artworkReady ? 'Saved cover artwork is configured. Check it in the preview.' : track.coverUrl ? 'The saved artwork link is not recognized. Check it in the preview or replace it before publishing.' : 'No cover artwork is saved. The site will use its default artwork.' });
  checks.push({ key: 'playback', label: 'Listener playback', status: 'ready', message: mode === 'full' ? 'Listeners will be able to play the full song.' : `Listeners will hear the processed preview${duration !== null && duration > 0 ? ` (up to ${Math.min(duration, PREVIEW_SECONDS)} seconds)` : ''}.` });
  return {
    kind: 'track', track: { ...dates(track), credits: track.credits ?? [] },
    canPublish: checks.every(check => check.status !== 'blocked'), expectedUpdatedAt: track.updatedAt.toISOString(),
    playbackMode: mode, audio: { status: audioStatus, previewStart: start, previewDuration: duration }, checks,
  };
}

export async function getTrackPublishingReview(track: ReviewTrack, options: { allowLegacyLive?: boolean; asset?: ReviewAsset | null } = {}): Promise<TrackPublishingReview> {
  const asset = options.asset !== undefined ? options.asset : track.audioAssetId
    ? await prisma.audioAsset.findUnique({ where: { id: track.audioAssetId }, select: audioReviewSelect })
    : null;
  return buildTrackPublishingReview(track, asset, options.allowLegacyLive ?? track.published);
}

export function getVideoPublishingReview(video: Video): VideoPublishingReview {
  const metadataReady = VideoCreateSchema.safeParse(video).success && nonempty(video.title, 200);
  const parsedId = extractYouTubeId(video.youtubeUrl);
  const youtubeReady = parsedId !== null && parsedId === video.youtubeId;
  const checks: PublishingCheck[] = [
    { key: 'metadata', label: 'Video details', status: metadataReady ? 'ready' : 'blocked', message: metadataReady ? 'The title and saved details are valid.' : 'Add a valid video title and correct any invalid saved details before publishing.' },
    { key: 'youtube', label: 'YouTube link', status: youtubeReady ? 'ready' : 'blocked', message: youtubeReady ? 'The saved YouTube link matches the video ID.' : 'Use a supported YouTube URL whose video ID matches the saved video.' },
    { key: 'availability', label: 'Playback check', status: 'warning', message: 'Play the preview to confirm this video is available and allows embedding. YouTube availability is not checked automatically.' },
  ];
  return { kind: 'video', video: dates(video), canPublish: checks.every(check => check.status !== 'blocked'), expectedUpdatedAt: video.updatedAt.toISOString(), checks };
}

export function publishingFailure(checks: PublishingCheck[]) {
  const blocked = checks.filter(check => check.status === 'blocked');
  return publishingError(blocked.map(check => check.message).join(' ') || REVIEW_AGAIN);
}

export function publishingError(message: string) {
  return { error: message, details: { published: [message] } };
}
