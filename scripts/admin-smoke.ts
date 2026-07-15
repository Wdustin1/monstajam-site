export {};

type Track = {
  slug: string;
  title: string;
  artist: string;
  genre: string;
  number: number;
  bpm: number | null;
  mood: string | null;
  published: boolean;
  audioUrl: string | null;
  coverUrl: string | null;
};

const baseUrl = process.env.ADMIN_SMOKE_BASE_URL;
const password = process.env.ADMIN_SECRET;

if (!baseUrl || !password) {
  console.error('Set ADMIN_SMOKE_BASE_URL and ADMIN_SECRET before running admin smoke tests.');
  process.exit(1);
}

const cookieJar = new Map<string, string>();
const smokeSlug = `admin-smoke-${Date.now()}`;

function cookieHeader() {
  return Array.from(cookieJar.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
}

function storeCookies(headers: Headers) {
  const cookies = headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookieJar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookieJar.size) headers.set('Cookie', cookieHeader());

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  storeCookies(res.headers);
  return res;
}

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const res = await request(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function cleanup() {
  try {
    await request(`/api/tracks/${smokeSlug}`, { method: 'DELETE' });
  } catch {
    // Cleanup is best-effort; the create path may not have run.
  }
}

async function main() {
  await jsonRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const before = await jsonRequest<Track[]>('/api/tracks?all=true');

  await jsonRequest<Track>('/api/tracks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: smokeSlug,
      title: 'Admin Smoke Test',
      artist: 'Echo QA',
      genre: 'Hip-Hop',
      number: before.reduce((max, track) => Math.max(max, track.number), 0) + 1,
      bpm: 101,
      mood: 'smoke initial',
      color: 'bg-gradient-to-br from-purple-600 to-blue-500',
      published: false,
    }),
  });

  const edited = await jsonRequest<Track>(`/api/tracks/${smokeSlug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mood: 'smoke edited', published: false }),
  });
  if (edited.mood !== 'smoke edited') throw new Error('Track edit did not persist.');

  await jsonRequest(`/api/tracks/${smokeSlug}`, {
    method: 'DELETE',
  });

  const after = await jsonRequest<Track[]>('/api/tracks?all=true');
  if (after.some((track) => track.slug === smokeSlug)) throw new Error('Smoke track cleanup failed.');

  console.log(JSON.stringify({
    ok: true,
    beforeCount: before.length,
    afterCount: after.length,
    createdEditedDeleted: smokeSlug,
  }, null, 2));
}

main().catch(async (error) => {
  await cleanup();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
