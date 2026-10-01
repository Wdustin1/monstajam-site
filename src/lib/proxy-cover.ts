import { parseCoverSource } from './cover-source';

/** Route this project's Blob artwork through image validation and sanitization. */
export function proxyCoverUrl(url: string | null | undefined): string {
  if (!url) return '';
  const source = parseCoverSource(url);
  if (source) {
    // Version new URLs so browsers don't reuse the old proxy's immutable cache.
    return `/api/cover?${new URLSearchParams({ url: source.href, v: '2' })}`;
  }
  return url;
}
