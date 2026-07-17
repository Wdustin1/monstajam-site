export const VERCEL_BLOB_ROOT = 'blob.vercel-storage.com';

const EXACT_LOCAL_COVERS = new Set([
  '/monstajam-logo.png',
  '/monstajam-record-label.png',
]);

export function isAllowedLocalCoverPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('?') || value.includes('#')) {
    return false;
  }

  let normalizedPath: string;
  try {
    normalizedPath = new URL(value, 'https://monstajam.local').pathname;
  } catch {
    return false;
  }
  if (normalizedPath !== value) return false;

  return EXACT_LOCAL_COVERS.has(value) || value.startsWith('/releases/');
}

export function isTrustedCoverSourceUrl(value: string): boolean {
  if (!value || value.length > 500) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trustedHostname = hostname === VERCEL_BLOB_ROOT
      || hostname.endsWith(`.${VERCEL_BLOB_ROOT}`);
    return url.protocol === 'https:'
      && trustedHostname
      && !url.username
      && !url.password
      && (!url.port || url.port === '443');
  } catch {
    return false;
  }
}

export function normalizeTrustedCoverSourceUrl(value: string): string | null {
  if (!isTrustedCoverSourceUrl(value)) return null;
  try {
    const canonicalUrl = new URL(value).toString();
    return canonicalUrl.length <= 500 ? canonicalUrl : null;
  } catch {
    return null;
  }
}

export function normalizeAllowedCoverUrl(value: string): string | null {
  if (isAllowedLocalCoverPath(value)) return value;
  return normalizeTrustedCoverSourceUrl(value);
}

export function isHttpMediaUrl(value: string): boolean {
  if (!value || value.length > 500) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}
