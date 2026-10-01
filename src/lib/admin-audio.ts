import { AdminSaveError, adminFetch, readAdminResponse } from './admin-save';
import { getPlaybackMode, type PlaybackMode } from './track-playback';

export type { PlaybackMode };
export type AdminAudioAsset = {
  id: string;
  status: 'processing' | 'ready' | 'failed';
  previewStart: number;
  previewDuration?: number | null;
  error?: string | null;
};
export type AudioPreparationSource = { originalUrl: string; originalName: string } | { audioAssetId: string };
export type AudioPreparation = { sourceKey: string; previewStart: number; asset: AdminAudioAsset };

export function initialPlaybackMode(track?: { playbackMode?: string | null; genre?: string | null }): PlaybackMode {
  return getPlaybackMode(track ?? {});
}

function validateAsset(value: AdminAudioAsset): AdminAudioAsset {
  if (!value || typeof value.id !== 'string' || !value.id ||
    !['processing', 'ready', 'failed'].includes(value.status) ||
    !Number.isFinite(value.previewStart) || value.previewStart < 0) {
    throw new AdminSaveError('Audio preparation returned an incomplete response. Your uploaded file is kept; retry to check its progress.');
  }
  return value;
}

async function readAudioResponse(response: Response): Promise<AdminAudioAsset> {
  // A storage/preparation error can be actionable without identifying a form
  // field. Preserve that message instead of asking to fix nonexistent highlights.
  const details = response.status === 422 ? await response.clone().json().catch(() => null) : null;
  try {
    return await readAdminResponse<AdminAudioAsset>(response);
  } catch (error) {
    if (error instanceof AdminSaveError && response.status === 422 &&
      Object.keys(error.fields).length === 0 && typeof details?.error === 'string') {
      throw new AdminSaveError(details.error);
    }
    throw error;
  }
}

export async function loadAdminAudioAsset(id: string): Promise<AdminAudioAsset> {
  return validateAsset(await readAudioResponse(await adminFetch(`/api/audio-assets/${encodeURIComponent(id)}`, { credentials: 'include' })));
}

type PreparationOptions = {
  previous?: AudioPreparation;
  onAsset: (preparation: AudioPreparation) => void;
  onProgress: (message: string) => void;
  request?: typeof adminFetch;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
};

/** Prepare a replacement before changing track metadata; retries reuse the same original/job. */
export async function prepareAdminAudio(
  source: AudioPreparationSource,
  previewStart: number,
  options: PreparationOptions,
): Promise<AdminAudioAsset> {
  const sourceKey = 'originalUrl' in source ? source.originalUrl : source.audioAssetId;
  const request = options.request ?? adminFetch;
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? 5 * 60_000);
  let asset = options.previous?.sourceKey === sourceKey && options.previous.previewStart === previewStart
    ? options.previous.asset : undefined;
  const record = (value: AdminAudioAsset) => {
    asset = validateAsset(value);
    if (asset.previewStart !== previewStart) {
      throw new AdminSaveError('The prepared audio does not match your selected start time. Your edits are kept; retry the save.');
    }
    options.onAsset({ sourceKey, previewStart, asset });
    return asset;
  };

  try {
    if (!asset || asset.status === 'failed') {
      options.onProgress('Preparing the 45-second preview…');
      record(await readAudioResponse(await request('/api/audio-assets', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...source, previewStart }),
      })));
    }
    while (asset?.status === 'processing') {
      options.onProgress('Preparing the 45-second preview. Your current saved track stays available.');
      if (now() >= deadline) {
        throw new AdminSaveError('Audio is still processing. Your uploaded file is kept; retry to check progress and finish saving.');
      }
      await wait(Math.min(2_000, Math.max(0, deadline - now())));
      if (now() >= deadline) {
        throw new AdminSaveError('Audio is still processing. Your uploaded file is kept; retry to check progress and finish saving.');
      }
      record(await readAudioResponse(await request(`/api/audio-assets/${encodeURIComponent(asset.id)}`, { credentials: 'include' })));
    }
    if (!asset || asset.status !== 'ready') {
      throw new AdminSaveError(asset?.error || 'Audio preparation failed. Your uploaded file is kept; retry or choose a different audio file.');
    }
    options.onProgress('Preview ready. Saving track changes…');
    return asset;
  } catch (error) {
    if (error instanceof AdminSaveError) throw error;
    throw new AdminSaveError('Audio preparation could not be checked. Your uploaded file and edits are kept; retry to continue.');
  }
}
