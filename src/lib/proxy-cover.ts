/**
 * Route Vercel Blob cover URLs through our /api/cover proxy.
 * Vercel Blob sometimes wraps responses in multipart/form-data which
 * breaks <img> tags. The proxy strips the wrapper and serves clean images.
 */
export function proxyCoverUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('blob.vercel-storage.com')) {
    // Decode first to normalize any %-encoded chars, then encode for query param
    const decoded = decodeURI(url);
    return `/api/cover?url=${encodeURIComponent(decoded)}`;
  }
  return url;
}