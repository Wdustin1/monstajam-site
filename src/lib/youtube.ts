// Parse supported public YouTube links by hostname and path, never a substring
// match. The result identifies the embed; it does not verify availability.
export function extractYouTubeId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const hostname = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null = null;
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      if (parts.length === 1) id = parts[0];
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(hostname)) {
      if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) id = url.searchParams.get('v');
      else if (parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1];
    } else if (['youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(hostname) && parts.length === 2 && parts[0] === 'embed') {
      id = parts[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
