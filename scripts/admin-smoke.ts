// This manual smoke leaves its synthetic draft in Trash for review or restoration.
// DELETE hides the record; it does not permanently remove saved metadata or files.
type Track = {
  id: string;
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
  deletedAt?: string | null;
  deletedBy?: string | null;
};

const baseUrl = process.env.ADMIN_SMOKE_BASE_URL;
const username = process.env.ADMIN_SMOKE_USERNAME;
const password = process.env.ADMIN_SMOKE_PASSWORD;

if (!baseUrl || !username || !password) {
  console.error('Set ADMIN_SMOKE_BASE_URL, ADMIN_SMOKE_USERNAME, and ADMIN_SMOKE_PASSWORD before running admin smoke tests.');
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
  if (!['GET', 'HEAD', 'OPTIONS'].includes(init.method ?? 'GET')) {
    headers.set('Origin', new URL(baseUrl!).origin);
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: 'manual' });
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

async function moveSmokeTrackToTrashOnFailure() {
  try {
    await request(`/api/tracks/${smokeSlug}`, { method: 'DELETE' });
  } catch {
    // Best-effort hiding only; the create path may not have run. Records stay in Trash.
  }
}

async function main() {
  console.info('Admin smoke creates and edits a synthetic draft, then moves it to Trash. The fixture remains in Trash; no permanent cleanup is performed.');
  await jsonRequest('/api/auth/sign-in/username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
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
  if (after.some((track) => track.slug === smokeSlug)) throw new Error('Smoke track is still in the active library after moving to Trash.');
  const trash = await jsonRequest<{ tracks: Track[] }>('/api/admin/trash');
  const trashed = trash.tracks.find((track) => track.slug === smokeSlug);
  if (!trashed || trashed.published || !trashed.deletedAt || !Number.isFinite(Date.parse(trashed.deletedAt)) || !trashed.deletedBy) {
    throw new Error('Smoke track was not retained as an unpublished record in Trash.');
  }
  const preservedFields = ['id', 'slug', 'title', 'artist', 'genre', 'number', 'bpm', 'mood', 'audioUrl', 'coverUrl'] as const;
  if (preservedFields.some((field) => trashed[field] !== edited[field])) {
    throw new Error('Moving the smoke track to Trash changed its saved metadata.');
  }

  console.log(JSON.stringify({
    ok: true,
    beforeCount: before.length,
    afterCount: after.length,
    createdEditedTrashed: smokeSlug,
    retainedInTrash: true,
  }, null, 2));
}

main().catch(async (error) => {
  await moveSmokeTrackToTrashOnFailure();
  console.error(`The smoke draft ${smokeSlug}, if created, may remain in Trash. No permanent cleanup was attempted.`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
