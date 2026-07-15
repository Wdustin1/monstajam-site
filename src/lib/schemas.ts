import { z } from 'zod';

// ── Video ──────────────────────────────────────────────────────────────────────

export const VideoCreateSchema = z.object({
  title:      z.string().min(1, 'Title is required').max(200),
  artist:     z.string().max(200).optional(),
  youtubeUrl: z.string().url('Must be a valid YouTube URL'),
  youtubeId:  z.string().min(1).max(20),
  duration:   z.string().max(10).optional(),
  published:  z.boolean().optional(),
  order:      z.number().int().min(0).optional(),
});

export const VideoUpdateSchema = VideoCreateSchema.partial();

export type VideoCreateInput = z.infer<typeof VideoCreateSchema>;
export type VideoUpdateInput = z.infer<typeof VideoUpdateSchema>;

const urlOrEmpty = z.string().max(500).url().or(z.literal('')).optional();

const TrackBaseSchema = z.object({
  title:         z.string().min(1, 'Title is required').max(200),
  subtitle:      z.string().max(200).optional(),
  artist:        z.string().min(1).max(200),
  slug:          z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  number:        z.number().int().positive(),
  genre:         z.string().max(100).optional(),
  bpm:           z.number().int().min(40).max(300).optional().nullable(),
  mood:          z.string().max(100).optional().nullable(),
  color:         z.string().max(200).optional(),
  story:         z.string().max(10000).optional().nullable(),
  audioUrl:      urlOrEmpty,
  coverUrl:      urlOrEmpty,
  spotifyUrl:    urlOrEmpty,
  appleMusicUrl: urlOrEmpty,
  previewOnly:   z.boolean().optional(),  // true = 30-sec preview (default), false = full song
  published:     z.boolean().optional(),
  accentCyan:    z.boolean().optional().nullable(),
});

export const TrackCreateSchema = TrackBaseSchema.superRefine((track, context) => {
  if (track.published && !track.audioUrl) {
    context.addIssue({
      code: 'custom',
      path: ['audioUrl'],
      message: 'Published tracks require an audio URL',
    });
  }
});

export const TrackUpdateSchema = TrackBaseSchema
  .omit({ slug: true, number: true })
  .partial();

export type TrackCreateInput = z.infer<typeof TrackCreateSchema>;
export type TrackUpdateInput = z.infer<typeof TrackUpdateSchema>;
