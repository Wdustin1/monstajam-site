import { normalizeAllowedCoverUrl } from './media-url';

/**
 * Keep local cover paths inside Next Image's explicit local allowlist and route
 * trusted Vercel Blob covers through the same-origin SSRF-hardened proxy.
 */
export function proxyCoverUrl(url: string | null | undefined) {
  if (!url) return '';
  const coverUrl = normalizeAllowedCoverUrl(url);
  if (!coverUrl) return '';
  if (coverUrl.startsWith('/')) return coverUrl;
  return `/api/cover?url=${encodeURIComponent(coverUrl)}`;
}
