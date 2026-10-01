import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import ffmpeg from 'ffmpeg-static';
import { createAudioPreview } from '../../src/lib/audio-preview';
import { isOriginalPath, originalPathFromUrl } from '../../src/lib/audio-storage';

function wav(seconds: number) {
  const samples = Math.floor(seconds * 44100);
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(44100, 24); data.writeUInt32LE(88200, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 44100) * 3000), 44 + i * 2);
  return data;
}

async function decodedDuration(bytes: Buffer) {
  const child = spawn(ffmpeg!, ['-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ar', '44100', '-ac', '1', 'pipe:1'], { windowsHide: true });
  let size = 0;
  child.stdout.on('data', (chunk: Buffer) => { size += chunk.length; });
  child.stderr.resume();
  child.stdin.end(bytes);
  const code = await new Promise(resolve => child.on('close', resolve));
  assert.equal(code, 0);
  return size / 88200;
}

test('real encoder produces only a 45-second clip from a longer full song', async () => {
  const result = await createAudioPreview(new Blob([wav(80)]).stream(), 0);
  const decoded = await decodedDuration(result.bytes);
  assert.ok(decoded >= 44.9 && decoded < 45.1, `decoded duration ${decoded}`);
  assert.ok(result.bytes.length < 1_200_000);
  assert.ok(result.duration >= 44.9 && result.duration <= 45);
});

test('preview start selects the requested section without serving the rest of the song', async () => {
  const result = await createAudioPreview(new Blob([wav(80)]).stream(), 60);
  const decoded = await decodedDuration(result.bytes);
  assert.ok(decoded >= 19.9 && decoded < 20.1, `decoded duration ${decoded}`);
});

test('ordinary M4A with metadata after its audio data is decoded into a real preview', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'monstajam-m4a-test-'));
  const pathname = join(directory, 'fixture.m4a');
  try {
    const child = spawn(ffmpeg!, ['-v', 'error', '-i', 'pipe:0', '-c:a', 'aac', pathname], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.stdout.resume();
    child.stdin.on('error', () => {});
    const finished = new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    child.stdin.end(wav(80));
    assert.equal(await finished, 0, stderr);
    const bytes = await readFile(pathname);
    assert.ok(bytes.indexOf('moov') > bytes.indexOf('mdat'), 'fixture must require seeking back from the trailing metadata');
    const result = await createAudioPreview(new Blob([bytes]).stream(), 10);
    const decoded = await decodedDuration(result.bytes);
    assert.ok(decoded >= 44.9 && decoded < 45.1, `decoded M4A preview duration ${decoded}`);
  } finally {
    await unlink(pathname).catch(() => {});
    await rmdir(directory).catch(() => {});
  }
});

test('short tracks generate a valid shorter preview', async () => {
  const result = await createAudioPreview(new Blob([wav(2)]).stream(), 0);
  assert.ok((await decodedDuration(result.bytes)) < 2.1);
});

test('a start after the end fails instead of publishing empty audio', async () => {
  await assert.rejects(createAudioPreview(new Blob([wav(2)]).stream(), 3), /Could not create/);
});

test('invalid audio fails without yielding an asset', async () => {
  await assert.rejects(createAudioPreview(new Blob(['not audio']).stream(), 0), /Could not create/);
});

test('network playlists are rejected by the converter', async () => {
  await assert.rejects(createAudioPreview(new Blob(['#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nhttp://127.0.0.1:1/private\n#EXT-X-ENDLIST']).stream(), 0));
});

test('a local-file playlist cannot make the converter read another file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'monstajam-playlist-test-'));
  const pathname = join(directory, 'private-fixture.wav');
  try {
    await writeFile(pathname, wav(2));
    const playlist = `ffconcat version 1.0\nfile '${pathname.replaceAll('\\', '/')}'\n`;
    await assert.rejects(createAudioPreview(new Blob([playlist]).stream(), 0), /Could not create/);
  } finally {
    await unlink(pathname).catch(() => {});
    await rmdir(directory).catch(() => {});
  }
});

test('original URLs must match this exact private store and upload prefix', () => {
  const previous = process.env.AUDIO_READ_WRITE_TOKEN;
  process.env.AUDIO_READ_WRITE_TOKEN = 'vercel_blob_rw_TestStore_secret';
  try {
    assert.equal(originalPathFromUrl('https://teststore.private.blob.vercel-storage.com/monstajam/originals/test.wav'), 'monstajam/originals/test.wav');
    for (const url of [
      'https://teststore.public.blob.vercel-storage.com/monstajam/originals/test.wav',
      'https://other.private.blob.vercel-storage.com/monstajam/originals/test.wav',
      'https://teststore.private.blob.vercel-storage.com/monstajam/previews/test.wav',
      'https://teststore.private.blob.vercel-storage.com/monstajam/originals/test.wav?x=1',
      'https://user:pass@teststore.private.blob.vercel-storage.com/monstajam/originals/test.wav',
    ]) assert.throws(() => originalPathFromUrl(url));
    assert.equal(isOriginalPath('monstajam/originals/../../secret'), false);
  } finally {
    if (previous === undefined) delete process.env.AUDIO_READ_WRITE_TOKEN; else process.env.AUDIO_READ_WRITE_TOKEN = previous;
  }
});
