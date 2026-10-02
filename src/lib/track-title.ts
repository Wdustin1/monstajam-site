export const TRACK_TITLE_CONFLICT = 'A track with this title or link already exists. Edit the existing track or choose a different title.';
export const TRACK_TITLE_TRASH_CONFLICT = 'A track with this link is in Trash. Restore it from Trash or choose a different title.';
export const TRACK_TITLE_CREATE_CONFLICT = 'A track with this title or link already exists. Check the library and Trash, or choose a different title.';

export function slugifyTrackTitle(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function trackTitleError(message: string) {
  return { error: message, details: { title: [message] } };
}
