import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdminSaveError } from '../../src/lib/admin-save';
import { initialPlaybackMode, prepareAdminAudio, type AdminAudioAsset, type AudioPreparation } from '../../src/lib/admin-audio';

const original = { originalUrl: 'https://example.invalid/private-original.wav', originalName: 'My original.wav' };
function asset(status: AdminAudioAsset['status'], previewStart = 12.5): AdminAudioAsset {
  return { id: 'asset-1', status, previewStart, previewDuration: status === 'ready' ? 45 : null };
}

test('playback defaults to preview; explicit mode takes precedence over the legacy genre fallback', () => {
  assert.equal(initialPlaybackMode(), 'preview');
  assert.equal(initialPlaybackMode({ genre: 'Full Songs' }), 'full');
  assert.equal(initialPlaybackMode({ genre: 'Full Songs', playbackMode: 'preview' }), 'preview');
  assert.equal(initialPlaybackMode({ genre: 'Hip-Hop', playbackMode: 'full' }), 'full');
  assert.equal(initialPlaybackMode({ genre: 'Full Songs', playbackMode: 'invalid' }), 'preview');
});

test('private original is prepared first and polled at two-second intervals until ready', async () => {
  const calls: { input: string; init?: RequestInit }[] = [];
  const delays: number[] = [];
  const snapshots: AudioPreparation[] = [];
  const replies = [asset('processing'), asset('processing'), asset('ready')];
  const result = await prepareAdminAudio(original, 12.5, {
    request: async (input, init) => { calls.push({ input, init }); return Response.json(replies.shift()); },
    wait: async (milliseconds) => { delays.push(milliseconds); },
    onAsset: (value) => snapshots.push(value), onProgress: () => {},
  });
  assert.equal(result.status, 'ready');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { ...original, previewStart: 12.5 });
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(calls.slice(1).map((call) => call.input), ['/api/audio-assets/asset-1', '/api/audio-assets/asset-1']);
  assert.deepEqual(delays, [2000, 2000]);
  assert.equal(snapshots[0].asset.status, 'processing');
  assert.equal(snapshots.at(-1)?.asset.status, 'ready');
});

test('a ready cached preparation is reused after metadata failure without any upload or prepare request', async () => {
  const ready = asset('ready');
  const result = await prepareAdminAudio(original, 12.5, {
    previous: { sourceKey: original.originalUrl, previewStart: 12.5, asset: ready },
    request: async () => { throw new Error('Ready cache should not make requests'); },
    onAsset: () => {}, onProgress: () => {},
  });
  assert.equal(result, ready);
});

test('changing a managed preview uses its private asset without an original reupload', async () => {
  let payload;
  const result = await prepareAdminAudio({ audioAssetId: 'saved-asset' }, 30, {
    request: async (_input, init) => { payload = JSON.parse(String(init?.body)); return Response.json({ ...asset('ready', 30), id: 'replacement-asset' }); },
    onAsset: () => {}, onProgress: () => {},
  });
  assert.deepEqual(payload, { audioAssetId: 'saved-asset', previewStart: 30 });
  assert.equal(result.id, 'replacement-asset');
});

test('polling session expiry retains the preparation so retry resumes the existing job', async () => {
  let cached: AudioPreparation | undefined;
  let firstCall = true;
  await assert.rejects(prepareAdminAudio(original, 12.5, {
    request: async () => {
      if (firstCall) { firstCall = false; return Response.json(asset('processing'), { status: 202 }); }
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    },
    wait: async () => {}, onAsset: (value) => { cached = value; }, onProgress: () => {},
  }), /session expired/);
  assert.equal(cached?.asset.status, 'processing');
  const calls: string[] = [];
  await prepareAdminAudio(original, 12.5, {
    previous: cached,
    request: async (input, init) => { calls.push(input); assert.notEqual(init?.method, 'POST'); return Response.json(asset('ready')); },
    wait: async () => {}, onAsset: () => {}, onProgress: () => {},
  });
  assert.deepEqual(calls, ['/api/audio-assets/asset-1']);
});

test('preparation times out with a retryable cached job instead of locking the editor indefinitely', async () => {
  let time = 0;
  let cached: AudioPreparation | undefined;
  await assert.rejects(prepareAdminAudio(original, 12.5, {
    request: async () => Response.json(asset('processing')),
    now: () => time, timeoutMs: 4000, wait: async (milliseconds) => { time += milliseconds; },
    onAsset: (value) => { cached = value; }, onProgress: () => {},
  }), /still processing.*retry/);
  assert.equal(time, 4000);
  assert.equal(cached?.asset.id, 'asset-1');
});

test('a failed conversion can retry the same original without dropping its failure details', async () => {
  let cached: AudioPreparation | undefined;
  await assert.rejects(prepareAdminAudio(original, 12.5, {
    request: async () => Response.json({ ...asset('failed'), error: 'Start time is past the end of this song.' }),
    onAsset: (value) => { cached = value; }, onProgress: () => {},
  }), /past the end/);
  assert.equal(cached?.asset.status, 'failed');
  let retryBody;
  await prepareAdminAudio(original, 12.5, {
    previous: cached,
    request: async (_input, init) => { retryBody = JSON.parse(String(init?.body)); return Response.json(asset('ready')); },
    onAsset: () => {}, onProgress: () => {},
  });
  assert.deepEqual(retryBody, { ...original, previewStart: 12.5 });
});

test('changing the start point invalidates the cached clip and incomplete responses cannot become metadata', async () => {
  let called = false;
  await assert.rejects(prepareAdminAudio(original, 30, {
    previous: { sourceKey: original.originalUrl, previewStart: 12.5, asset: asset('ready') },
    request: async () => { called = true; return Response.json(asset('ready', 12.5)); },
    onAsset: () => {}, onProgress: () => {},
  }), /does not match/);
  assert.ok(called);
  await assert.rejects(prepareAdminAudio(original, 0, {
    request: async () => Response.json({ status: 'ready' }),
    onAsset: () => {}, onProgress: () => {},
  }), AdminSaveError);
});

test('preparation errors without field details retain the actionable storage message', async () => {
  await assert.rejects(prepareAdminAudio(original, 0, {
    request: async () => Response.json({ error: 'Private audio storage is unavailable; retry shortly.' }, { status: 422 }),
    onAsset: () => {}, onProgress: () => {},
  }), /Private audio storage is unavailable/);
});
