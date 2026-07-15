export {};

type Track = {
  slug: string;
  number: number;
  published: boolean;
  audioUrl: string | null;
};

const baseUrl = process.env.ADMIN_SMOKE_BASE_URL;
const password = process.env.ADMIN_SECRET;
if (!baseUrl || !password) {
  console.error('Set ADMIN_SMOKE_BASE_URL and ADMIN_SECRET before running the track concurrency smoke.');
  process.exit(1);
}

const slug = `track-race-smoke-${Date.now()}`;
const cookieJar = new Map<string, string>();
let fixtureCreated = false;

function cookieHeader() {
  return Array.from(cookieJar, ([key, value]) => `${key}=${value}`).join('; ');
}

function storeCookies(headers: Headers) {
  for (const cookie of headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(';');
    const separator = pair.indexOf('=');
    if (separator > 0) cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookieJar.size) headers.set('Cookie', cookieHeader());
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  storeCookies(response.headers);
  return response;
}

async function requireJson<T>(path: string, init: RequestInit = {}) {
  const response = await request(path, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return body as T;
}

async function verifyFixtureAbsent() {
  const tracks = await requireJson<Track[]>('/api/tracks?all=true');
  if (tracks.some((track) => track.slug === slug)) {
    throw new Error('Track concurrency fixture cleanup did not persist.');
  }
}

async function cleanup() {
  if (!fixtureCreated) return;
  const response = await request(`/api/tracks/${slug}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Fixture cleanup failed with ${response.status}.`);
  await verifyFixtureAbsent();
  fixtureCreated = false;
}

function assertRaceStatuses(first: Response, second: Response) {
  const statuses = [first.status, second.status].sort((a, b) => a - b);
  if (statuses[0] !== 200 || statuses[1] !== 422) {
    throw new Error(`Unexpected race statuses: ${first.status}, ${second.status}`);
  }
}

async function main() {
  await requireJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const before = await requireJson<Track[]>('/api/tracks?all=true');
  await requireJson<Track>('/api/tracks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug,
      title: 'Track Concurrency Smoke',
      artist: 'Echo QA',
      genre: 'Hip-Hop',
      number: before.reduce((max, track) => Math.max(max, track.number), 0) + 1,
      color: 'bg-gradient-to-br from-purple-600 to-blue-500',
      audioUrl: 'https://store.public.blob.vercel-storage.com/smoke.wav',
      published: false,
    }),
  });
  fixtureCreated = true;

  const [publishResponse, clearAudioResponse] = await Promise.all([
    request(`/api/tracks/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: true }),
    }),
    request(`/api/tracks/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: '' }),
    }),
  ]);

  assertRaceStatuses(publishResponse, clearAudioResponse);

  const after = await requireJson<Track[]>('/api/tracks?all=true');
  const finalTrack = after.find((track) => track.slug === slug);
  if (!finalTrack) throw new Error('Track concurrency fixture disappeared.');
  if (finalTrack.published && !finalTrack.audioUrl) {
    throw new Error('Concurrent updates violated the published-track audio invariant.');
  }

  await cleanup();
  console.log(JSON.stringify({
    ok: true,
    publishStatus: publishResponse.status,
    clearAudioStatus: clearAudioResponse.status,
    finalPublished: finalTrack.published,
    finalHasAudio: Boolean(finalTrack.audioUrl),
  }));
}

main().catch(async (error) => {
  try {
    await cleanup();
  } catch (cleanupError) {
    console.error(cleanupError instanceof Error ? cleanupError.message : cleanupError);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
