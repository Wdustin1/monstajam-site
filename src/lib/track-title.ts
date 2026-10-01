export const TRACK_TITLE_CONFLICT = 'A track with this title or link already exists. Edit the existing track or choose a different title.';

export function slugifyTrackTitle(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function trackTitleError(message: string) {
  return { error: message, details: { title: [message] } };
}
