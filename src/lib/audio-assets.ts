import { createHash, randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import type { AudioAsset } from '@prisma/client';
import { prisma } from './prisma';
import { audioToken, getPrivateAudio } from './audio-storage';
import { createAudioPreview } from './audio-preview';

export const AUDIO_JOB_TIMEOUT_MS = 270_000;
export function audioAssetKey(pathname: string, start: number) {
  return createHash('sha256').update(`${pathname}\n${start}`).digest('hex');
}

export function audioAssetStatus(asset: AudioAsset) {
  const stale = asset.status === 'processing' && Date.now() - asset.updatedAt.getTime() > AUDIO_JOB_TIMEOUT_MS;
  return {
    id: asset.id, status: stale ? 'failed' : asset.status,
    previewStart: asset.previewStart, previewDuration: asset.previewDuration,
    originalName: asset.originalName,
    error: stale ? 'Preview processing timed out. Save again to retry; your existing track is unchanged.' : asset.error,
  };
}

export async function processAudioAsset(asset: AudioAsset) {
  try {
    const original = await getPrivateAudio(asset.originalPath, { signal: AbortSignal.timeout(120_000) });
    if (!original || original.statusCode !== 200) throw new Error('The uploaded original was not found.');
    const preview = await createAudioPreview(original.stream, asset.previewStart);
    const previewPath = `monstajam/previews/${asset.id}-${randomUUID()}.mp3`;
    await put(previewPath, preview.bytes, {
      access: 'private', token: audioToken(), contentType: 'audio/mpeg',
      addRandomSuffix: false, allowOverwrite: false, abortSignal: AbortSignal.timeout(30_000),
    });
    // A timed-out worker must never overwrite the result of a newer retry.
    await prisma.audioAsset.updateMany({
      where: { id: asset.id, status: 'processing', updatedAt: asset.updatedAt },
      data: { previewPath, previewDuration: preview.duration, status: 'ready', error: null },
    });
  } catch {
    await prisma.audioAsset.updateMany({
      where: { id: asset.id, status: 'processing', updatedAt: asset.updatedAt },
      data: { status: 'failed', error: 'Could not prepare the audio preview. Check the audio file and preview start, then save again to retry. Your saved track is unchanged.' },
    });
  }
}
