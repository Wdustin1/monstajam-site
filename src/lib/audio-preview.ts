import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';
import { MAX_AUDIO_BYTES, PREVIEW_SECONDS } from './audio-storage';

// Restrict demuxers to audio containers, excluding playlists that can refer to other
// files. A bounded temporary file supports M4A/MP4 metadata located at the end.
export async function createAudioPreview(input: ReadableStream<Uint8Array>, start: number) {
  if (!Number.isFinite(start) || start < 0 || start > 7200) throw new Error('Preview start must be between 0 and 7200 seconds.');
  if (!ffmpegPath) throw new Error('Audio conversion is unavailable on this server.');
  const directory = await mkdtemp(join(tmpdir(), 'monstajam-audio-'));
  const inputPath = join(directory, 'original.audio');
  try {
    let inputBytes = 0;
    const limiter = new Transform({ transform(chunk, _encoding, callback) {
      inputBytes += chunk.length;
      callback(inputBytes > MAX_AUDIO_BYTES ? new Error('Audio is too large.') : null, chunk);
    } });
    await pipeline(
      Readable.fromWeb(input as import('node:stream/web').ReadableStream<Uint8Array>),
      limiter, createWriteStream(inputPath, { flags: 'wx', mode: 0o600 }),
      { signal: AbortSignal.timeout(120_000) },
    );
    return await encodePreview(inputPath, start, ffmpegPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await rmdir(directory).catch(() => {});
  }
}

async function encodePreview(inputPath: string, start: number, executable: string) {
  const child = spawn(executable, [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    '-protocol_whitelist', 'file,pipe',
    '-format_whitelist', 'mp3,wav,flac,ogg,mov,aac,aiff,asf,matroska,webm', '-i', inputPath,
    '-ss', String(start), '-t', String(PREVIEW_SECONDS), '-map', '0:a:0',
    '-vn', '-sn', '-dn', '-map_metadata', '-1', '-threads', '1',
    '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k',
    '-progress', 'pipe:3', '-f', 'mp3', 'pipe:1',
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
  let outputBytes = 0;
  let duration = 0;
  let failed = false;
  let progress = '';
  const output: Buffer[] = [];
  const stop = () => { failed = true; child.kill('SIGKILL'); };
  const timer = setTimeout(stop, 90_000);
  // FFmpeg intentionally stops reading when the 45-second clip is complete.
  child.stdin.on('error', () => {});
  child.stdout.on('data', (chunk: Buffer) => {
    outputBytes += chunk.length;
    if (outputBytes > 2 * 1024 * 1024) stop(); else output.push(chunk);
  });
  child.stderr.resume();
  child.stdio[3]?.on('data', (chunk: Buffer) => {
    progress += chunk.toString();
    const lines = progress.split('\n');
    progress = lines.pop() ?? '';
    for (const line of lines) if (line.startsWith('out_time_us=')) {
      const seconds = Number(line.slice(12)) / 1_000_000;
      if (Number.isFinite(seconds)) duration = Math.max(duration, seconds);
    }
  });
  const finished = new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  child.stdin.end();
  try {
    const code = await finished;
    if (failed || code !== 0 || duration < 0.1 || outputBytes < 1000) {
      throw new Error('Could not create the preview. Check the audio file and choose a start point before the song ends, then retry.');
    }
    return { bytes: Buffer.concat(output), duration: Math.min(PREVIEW_SECONDS, duration) };
  } finally {
    clearTimeout(timer);
    child.stdin.destroy();
    child.kill();
  }
}
