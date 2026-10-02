'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminSaveError, adminFetch, readAdminResponse } from '@/lib/admin-save';
import { proxyCoverUrl } from '@/lib/proxy-cover';
import type { PublishingReview } from '@/lib/publishing-types';

export type PublishingTarget = { kind: 'track' | 'video'; key: string };

function validReview(value: unknown, target: PublishingTarget): value is PublishingReview {
  if (!value || typeof value !== 'object') return false;
  const result = value as PublishingReview;
  if (result.kind !== target.kind || typeof result.canPublish !== 'boolean' ||
    typeof result.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(result.expectedUpdatedAt)) ||
    !Array.isArray(result.checks) || !result.checks.length || result.checks.some((check) =>
      !check || typeof check.key !== 'string' || typeof check.label !== 'string' || typeof check.message !== 'string' || !['ready', 'warning', 'blocked'].includes(check.status))) return false;
  const item = result.kind === 'track' ? result.track : result.video;
  if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.published !== 'boolean') return false;
  if (result.kind === 'track') return result.track.slug === target.key &&
    ['preview', 'full'].includes(result.playbackMode) && Boolean(result.audio) &&
    ['ready', 'processing', 'failed', 'missing', 'legacy'].includes(result.audio.status);
  return result.video.id === target.key && typeof result.video.youtubeId === 'string';
}

export default function PublishingReviewDialog({ target, disabled, onClose, onPublish, onError, onPlayback }: {
  target: PublishingTarget;
  disabled: boolean;
  onClose: () => void;
  onPublish: (review: PublishingReview) => Promise<void>;
  onError: (error: unknown) => void;
  onPlayback: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const mounted = useRef(false);
  const version = useRef(0);
  const publishingLock = useRef(false);
  const [review, setReview] = useState<PublishingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);

  const load = useCallback(async () => {
    if (!mounted.current || publishingLock.current) return;
    const requestVersion = ++version.current;
    setLoading(true); setReview(null); setChecked(false); setError(null);
    setNeedsReload(false); setAudioFailed(false); setArtworkFailed(false);
    try {
      const result = await readAdminResponse<unknown>(await adminFetch(`/api/admin/publishing/${target.kind}s/${encodeURIComponent(target.key)}`, { credentials: 'include', cache: 'no-store' }));
      if (!validReview(result, target)) throw new Error('Incomplete publishing review');
      if (mounted.current && version.current === requestVersion) setReview(result);
    } catch (cause) {
      if (!mounted.current || version.current !== requestVersion) return;
      onError(cause);
      setError(cause instanceof AdminSaveError ? cause.message : 'The saved item could not be checked. Nothing has been published. Reload the review to try again.');
    } finally { if (mounted.current && version.current === requestVersion) setLoading(false); }
  }, [onError, target]);

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    const lifetime = ++version.current;
    queueMicrotask(() => { if (mounted.current && version.current === lifetime) void load(); });
    return () => { mounted.current = false; };
  }, [load]);

  useEffect(() => {
    const player = audio.current;
    return () => { player?.pause(); };
  }, [review]);

  const item = review?.kind === 'track' ? review.track : review?.video;
  const blocked = !review?.canPublish || review.checks.some((check) => check.status === 'blocked');
  const canConfirm = Boolean(review && !item?.published && !blocked && checked && !audioFailed && !needsReload && !loading && !publishing && !disabled);

  async function publish() {
    if (!canConfirm || !review || publishingLock.current) return;
    publishingLock.current = true; setPublishing(true); setError(null);
    audio.current?.pause();
    try { await onPublish(review); }
    catch (cause) {
      if (!mounted.current) return;
      onError(cause); setNeedsReload(true); setChecked(false);
      setError(cause instanceof AdminSaveError
        ? Object.values(cause.fields).join(' ') || cause.message
        : 'Publication could not be confirmed. Reload the review to check the saved status before trying again.');
    } finally {
      publishingLock.current = false;
      if (mounted.current) setPublishing(false);
    }
  }

  return <dialog ref={dialog} aria-label={`Review ${target.kind} for publishing`} onCancel={(event) => { event.preventDefault(); if (!publishingLock.current) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,760px)] overflow-y-auto rounded-xl border border-white/20 bg-slate-950 p-5 text-white shadow-2xl backdrop:bg-black/80 sm:p-6">
    <h2 className="text-xl font-semibold">Review {target.kind} for publishing</h2>
    <p className="mt-2 text-sm text-slate-400">This shows the saved version. Publishing makes it visible on the website. Other unsaved work stays in your editor.</p>
    {loading && <p role="status" className="mt-5 text-sm text-cyan-200">Checking saved details and media…</p>}
    {error && <div role="alert" className="mt-4 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-200">{error}</div>}
    {disabled && <p className="mt-3 text-sm text-amber-200">Close this review, sign in again, then use Retry connection before publishing.</p>}
    {review && item && <div className="mt-5 space-y-5">
      <div>
        <h3 className="text-lg font-semibold">{item.title}</h3>
        {item.artist && <p className="mt-1 text-sm text-slate-300">{item.artist}</p>}
        {review.kind === 'track' && <p className="mt-1 text-sm text-slate-400">{review.track.genre}{review.track.bpm ? ` · ${review.track.bpm} BPM` : ''}{review.track.mood ? ` · ${review.track.mood}` : ''}</p>}
      </div>
      {item.published && <p role="status" className="rounded-md bg-cyan-300/10 p-3 text-sm text-cyan-100">This item is already live. Its current publication status has been kept.</p>}
      {review.kind === 'track' ? <>
        {review.track.coverUrl && !artworkFailed ?
          // The image proxy validates and normalizes saved artwork.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxyCoverUrl(review.track.coverUrl)} alt={`Artwork for ${review.track.title}`} onError={() => setArtworkFailed(true)} className="max-h-56 max-w-full rounded-lg object-contain" />
          : <p className="rounded-md bg-amber-300/10 p-3 text-sm text-amber-100">{artworkFailed ? 'Artwork could not be loaded. Check it before publishing.' : 'No artwork saved. The site will use its default cover.'}</p>}
        <div className="rounded-lg border border-cyan-300/20 p-4">
          <p className="font-semibold text-cyan-200">Visitors will hear: {review.playbackMode === 'full' ? 'Full song' : '45-second preview'}</p>
          {review.playbackMode === 'preview' && review.audio.previewDuration != null && <p className="mt-1 text-sm text-slate-400">Saved clip: {Math.round(review.audio.previewDuration * 10) / 10} seconds{review.audio.previewStart != null ? `, starting at ${review.audio.previewStart} seconds` : ''}. Short songs can have a shorter preview.</p>}
          {review.audio.status === 'ready' && <audio ref={audio} aria-label="Listener playback preview" controls preload="none" onPlay={onPlayback} onError={() => setAudioFailed(true)} src={`/api/audio/${encodeURIComponent(review.track.slug)}?${review.playbackMode === 'preview' ? 'preview' : 'full'}=true&v=${encodeURIComponent(review.expectedUpdatedAt)}`} className="mt-3 w-full" />}
          {audioFailed && <p role="alert" className="mt-2 text-sm text-rose-200">Audio could not be played. Reload the review and check playback before publishing.</p>}
          <a href={`/upload/preview/${encodeURIComponent(review.track.slug)}`} target="_blank" rel="noopener noreferrer" onClick={() => audio.current?.pause()} className="mt-3 inline-block text-sm text-cyan-200 underline">Open saved page preview (new tab, admin full-song audition)</a>
        </div>
        {review.track.story && <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-slate-300"><h4 className="mb-2 font-semibold">Story / lyrics</h4>{review.track.story}</div>}
        {review.track.credits?.length ? <div className="text-sm text-slate-300"><h4 className="font-semibold">Credits</h4>{review.track.credits.map((credit) => <p key={credit.id}>{credit.role}: {credit.name}</p>)}</div> : null}
      </> : <>
        {/^[A-Za-z0-9_-]{11}$/.test(review.video.youtubeId) && <iframe title="Saved video preview" src={`https://www.youtube-nocookie.com/embed/${review.video.youtubeId}`} allowFullScreen className="aspect-video w-full rounded-lg border-0" />}
        {review.video.duration && <p className="text-sm text-slate-400">Duration: {review.video.duration}</p>}
      </>}
      <ul aria-label="Publishing checks" className="space-y-2">
        {review.checks.map((check) => <li key={check.key} className={`rounded-md border p-3 text-sm ${check.status === 'blocked' ? 'border-rose-300/30 text-rose-200' : check.status === 'warning' ? 'border-amber-300/30 text-amber-100' : 'border-emerald-300/20 text-emerald-200'}`}>
          <strong>{check.status === 'blocked' ? 'Needs attention' : check.status === 'warning' ? 'Warning' : 'Ready'}: {check.label}</strong><p className="mt-1">{check.message}</p>
        </li>)}
      </ul>
      {!item.published && <label className="flex items-start gap-3 text-sm text-slate-200">
        <input type="checkbox" checked={checked} disabled={blocked || needsReload || audioFailed || publishing || disabled} onChange={(event) => setChecked(event.target.checked)} className="mt-1" />
        {target.kind === 'track' ? 'I checked the preview and playback setting.' : 'I checked the video preview.'}
      </label>}
    </div>}
    <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
      <button type="button" onClick={onClose} disabled={publishing} className="rounded-md border border-white/20 px-4 py-2 text-sm disabled:opacity-50">{item?.published ? 'Close review' : 'Keep draft'}</button>
      <button type="button" onClick={load} disabled={loading || publishing || disabled} className="rounded-md border border-white/20 px-4 py-2 text-sm disabled:opacity-50">Reload review</button>
      <button type="button" onClick={publish} disabled={!canConfirm} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{publishing ? 'Publishing…' : `Publish ${target.kind}`}</button>
    </div>
  </dialog>;
}
