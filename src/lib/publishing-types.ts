import type { Credit, Track, Video } from '@prisma/client';

export type PublishingCheck = {
  key: string;
  label: string;
  status: 'ready' | 'warning' | 'blocked';
  message: string;
};

type SerializedDates<T> = Omit<T, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type PublishingTrack = SerializedDates<Track> & { credits: Credit[] };
export type PublishingVideo = SerializedDates<Video>;

type ReviewBase = {
  canPublish: boolean;
  expectedUpdatedAt: string;
  checks: PublishingCheck[];
};
export type TrackPublishingReview = ReviewBase & {
  kind: 'track';
  track: PublishingTrack;
  playbackMode: 'preview' | 'full';
  audio: {
    status: 'missing' | 'legacy' | 'processing' | 'failed' | 'ready';
    previewStart: number | null;
    previewDuration: number | null;
  };
};
export type VideoPublishingReview = ReviewBase & { kind: 'video'; video: PublishingVideo };
export type PublishingReview = TrackPublishingReview | VideoPublishingReview;
