// Public address of this project's artwork store. Update this allowlist explicitly
// if the Blob store changes; other tenants are not trusted artwork sources.
const COVER_HOST = 'uwuqs1lz48clguif.public.blob.vercel-storage.com';

export function parseCoverSource(value: string | null | undefined): URL | null {
  if (!value || value.length > 2048 || /[\s\\]/.test(value)) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== COVER_HOST ||
      url.username || url.password || url.port || url.hash ||
      !url.pathname.startsWith('/monstajam/covers/') ||
      url.pathname === '/monstajam/covers/'
    ) return null;

    return url;
  } catch {
    return null;
  }
}
