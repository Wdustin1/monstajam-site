import { get, head } from '@vercel/blob';

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
export const PREVIEW_SECONDS = 45;

export function audioToken(): string {
  const token = process.env.AUDIO_READ_WRITE_TOKEN;
  if (!token) throw new Error('Private audio storage is not configured. Your saved track has not changed.');
  return token;
}

export function originalPathFromUrl(value: string): string {
  const token = audioToken();
  const store = token.split('_')[3];
  const url = new URL(value);
  if (!store || url.protocol !== 'https:' || url.hostname !== `${store.toLowerCase()}.private.blob.vercel-storage.com` ||
      url.port || url.username || url.password || url.search || url.hash) {
    throw new Error('Choose an original uploaded to this site’s private audio storage.');
  }
  const pathname = decodeURIComponent(url.pathname.slice(1));
  if (!isOriginalPath(pathname)) throw new Error('Invalid original audio path.');
  return pathname;
}

export function isOriginalPath(pathname: string): boolean {
  return /^monstajam\/originals\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,230}$/.test(pathname);
}

export async function checkOriginal(pathname: string) {
  if (!isOriginalPath(pathname)) throw new Error('Invalid original audio path.');
  const blob = await head(pathname, { token: audioToken(), abortSignal: AbortSignal.timeout(15_000) });
  if (blob.size <= 0 || blob.size > MAX_AUDIO_BYTES) throw new Error('Audio must be between 1 byte and 500 MB.');
  return blob;
}

export async function getPrivateAudio(pathname: string, options: { range?: string; signal?: AbortSignal } = {}) {
  return get(pathname, {
    access: 'private', token: audioToken(),
    ...(options.range && { headers: { Range: options.range } }),
    abortSignal: options.signal ?? AbortSignal.timeout(240_000),
  });
}
