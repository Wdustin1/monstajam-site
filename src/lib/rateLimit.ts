type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  maxEntries: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type WindowEntry = {
  attempts: number;
  resetAt: number;
};

export function getRequestAddress(headers: Pick<Headers, 'get'>) {
  return headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function createFixedWindowRateLimiter({ limit, windowMs, maxEntries }: RateLimiterOptions) {
  const entries = new Map<string, WindowEntry>();

  function consume(key: string, now = Date.now()): RateLimitResult {
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      if (!entry && entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value as string | undefined;
        if (oldestKey) entries.delete(oldestKey);
      }
      entry = { attempts: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
    if (entry.attempts >= limit) return { allowed: false, retryAfterSeconds };

    entry.attempts += 1;
    return { allowed: true, retryAfterSeconds };
  }

  function clear(key: string) {
    entries.delete(key);
  }

  return { consume, clear };
}
