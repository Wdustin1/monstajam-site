'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

type Props = {
  kind: 'audio' | 'image';
  file: File | null;
  audioRef?: RefObject<HTMLAudioElement | null>;
  onAudioPlay?: () => void;
};

type LocalSource = { file: File; kind: Props['kind']; url: string | null };

export default function SelectedMediaPreview({ kind, file, audioRef, onAudioPlay }: Props) {
  const [source, setSource] = useState<LocalSource | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (file) {
      try { url = URL.createObjectURL(file); } catch { /* Selection remains usable even without browser preview support. */ }
    }
    // Synchronize the browser-owned URL with the selected file; never allocate it during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(file ? { file, kind, url } : null);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [file, kind]);

  const current = source?.file === file && source.kind === kind ? source : null;
  const url = current?.url ?? null;
  const attachAudio = useCallback((element: HTMLAudioElement | null) => {
    if (!element) return;
    if (url) element.src = url;
    if (audioRef) audioRef.current = element;
    return () => {
      element.pause();
      element.removeAttribute('src');
      element.load();
      if (audioRef?.current === element) audioRef.current = null;
    };
  }, [audioRef, url]);

  if (!file) return null;
  const failed = Boolean(current && (!url || failedUrl === url));
  const label = kind === 'audio' ? 'Selected audio' : 'Selected artwork';

  return (
    <section aria-label={label} className="mt-4 space-y-2">
      <p className="text-sm font-medium text-slate-200">{label}</p>
      <p className="break-words text-xs text-slate-400">{file.name}</p>
      {url && (kind === 'audio' ? (
        <audio key={url} ref={attachAudio} aria-label={label} controls preload="metadata" src={url} onPlay={onAudioPlay} onError={() => setFailedUrl(url)} className="w-full" />
      ) : (
        // Local object URLs cannot use server image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt={label} hidden={failed} onError={() => setFailedUrl(url)} className="max-h-48 max-w-full rounded-md object-contain" />
      ))}
      {failed ? (
        <p role="status" className="text-xs text-amber-200">This browser could not {kind === 'audio' ? 'play this audio' : 'preview this artwork'}. Your file is still selected. You can keep it for saving or choose another file.</p>
      ) : (
        <p className="text-xs text-slate-400">{kind === 'audio' ? 'Listen to the selected original before saving. This is not the saved 45-second preview.' : 'Preview of the selected file. Your saved artwork changes only after a successful save.'}</p>
      )}
    </section>
  );
}
