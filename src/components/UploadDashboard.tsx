'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Disc3,
  Eye,
  EyeOff,
  FileAudio,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Music,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Video,
  XCircle,
  Youtube,
} from 'lucide-react';

interface PublishedTrack {
  id: string;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  number: number;
  bpm: number | null;
  mood: string | null;
  story: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  published: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface VideoRecord {
  id: string;
  title: string;
  artist: string | null;
  youtubeUrl: string;
  youtubeId: string;
  duration: string | null;
  published: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

type AdminTab = 'tracks' | 'videos' | 'ops';
type ToastState = { type: 'success' | 'error'; message: string } | null;
type ConfirmState =
  | { kind: 'track'; item: PublishedTrack }
  | { kind: 'video'; item: VideoRecord }
  | null;

type TrackFormState = {
  title: string;
  artist: string;
  genre: string;
  bpm: string;
  mood: string;
  story: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  published: boolean;
  audioFile: File | null;
  coverFile: File | null;
};

type VideoFormState = {
  title: string;
  artist: string;
  youtubeUrl: string;
  duration: string;
  published: boolean;
};

const GENRES = [
  'Full Songs',
  'Hip-Hop',
  'R&B',
  'Soul',
  'Pop',
  'Reggae',
  'Country',
  'Electronic',
  'Lo-Fi',
  'Trap',
  'Afrobeat',
  'Other',
];

const GENRE_COLORS: Record<string, string> = {
  'Hip-Hop': 'bg-gradient-to-br from-purple-600 to-blue-500',
  'Full Songs': 'bg-gradient-to-br from-emerald-500 to-cyan-700',
  'R&B': 'bg-gradient-to-br from-pink-600 to-purple-700',
  Soul: 'bg-gradient-to-br from-amber-600 to-rose-700',
  Pop: 'bg-gradient-to-br from-rose-500 to-pink-600',
  Reggae: 'bg-gradient-to-br from-emerald-600 to-yellow-600',
  Country: 'bg-gradient-to-br from-orange-600 to-stone-700',
  Electronic: 'bg-gradient-to-br from-cyan-500 to-blue-700',
  'Lo-Fi': 'bg-gradient-to-br from-indigo-500 to-purple-600',
  Trap: 'bg-gradient-to-br from-gray-700 to-gray-900',
  Afrobeat: 'bg-gradient-to-br from-orange-500 to-yellow-600',
  Other: 'bg-gradient-to-br from-slate-600 to-slate-800',
};

const emptyTrackForm = (): TrackFormState => ({
  title: '',
  artist: 'Monsta Jam',
  genre: 'Hip-Hop',
  bpm: '',
  mood: '',
  story: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  published: false,
  audioFile: null,
  coverFile: null,
});

const emptyVideoForm = (): VideoFormState => ({
  title: '',
  artist: '',
  youtubeUrl: '',
  duration: '',
  published: true,
});

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatDate(value?: string) {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function fileLabel(file: File | null, fallback: string) {
  return file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : fallback;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 font-mono text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{detail}</div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-rose-400"> *</span>}
      </span>
      {children}
      {error && <span className="mt-2 block text-sm text-rose-300">{error}</span>}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-md border border-white/10 bg-slate-950/80 px-3.5 py-3 text-sm text-white outline-none transition',
        'placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'min-h-28 w-full resize-y rounded-md border border-white/10 bg-slate-950/80 px-3.5 py-3 text-sm text-white outline-none transition',
        'placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'w-full rounded-md border border-white/10 bg-slate-950/80 px-3.5 py-3 text-sm text-white outline-none transition',
        'focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20"
    >
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{help}</span>
      </span>
      <span
        className={[
          'relative h-6 w-11 rounded-full transition',
          checked ? 'bg-cyan-400' : 'bg-slate-700',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 h-4 w-4 rounded-full bg-white transition',
            checked ? 'left-6' : 'left-1',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'live' | 'draft' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  const className = {
    live: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    draft: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    neutral: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  }[tone];

  return (
    <span className={`inline-flex items-center rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${className}`}>
      {children}
    </span>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 4800);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div role="status" aria-live="polite" className="fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-white/10 bg-slate-950/95 p-4 text-sm shadow-2xl shadow-black/40">
      {toast.type === 'success' ? (
        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-300" />
      )}
      <div className="text-slate-100">{toast.message}</div>
    </div>
  );
}

function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirm) return;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirm, onCancel]);

  if (!confirm) return null;

  const title = confirm.kind === 'track' ? confirm.item.title : confirm.item.title;
  const noun = confirm.kind === 'track' ? 'track' : 'video';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" className="w-full max-w-md rounded-lg border border-rose-400/30 bg-slate-950 p-6 shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-rose-400/10 text-rose-300">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 id="delete-dialog-title" className="text-lg font-semibold text-white">Delete {noun}</h3>
            <p id="delete-dialog-description" className="mt-1 text-sm text-slate-400">This permanently removes &quot;{title}&quot; from the database.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UploadDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('tracks');
  const [tracks, setTracks] = useState<PublishedTrack[]>([]);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [trackForm, setTrackForm] = useState<TrackFormState>(() => emptyTrackForm());
  const [videoForm, setVideoForm] = useState<VideoFormState>(() => emptyVideoForm());
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [submittingTrack, setSubmittingTrack] = useState(false);
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [trackErrors, setTrackErrors] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  const loadTracks = useCallback(async () => {
    setTracksLoading(true);
    try {
      const res = await fetch('/api/tracks?all=true', { credentials: 'include' });
      if (!res.ok) throw new Error('Track library failed to load.');
      setTracks(await res.json());
      setLastLoadedAt(new Date());
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Track library failed to load.');
    } finally {
      setTracksLoading(false);
    }
  }, [showToast]);

  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const res = await fetch('/api/videos?all=true', { credentials: 'include' });
      if (!res.ok) throw new Error('Video library failed to load.');
      setVideos(await res.json());
      setLastLoadedAt(new Date());
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Video library failed to load.');
    } finally {
      setVideosLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTracks();
    loadVideos();
  }, [loadTracks, loadVideos]);

  const metrics = useMemo(() => {
    const liveTracks = tracks.filter((track) => track.published).length;
    const draftTracks = tracks.length - liveTracks;
    const missingAudio = tracks.filter((track) => !track.audioUrl).length;
    const missingCovers = tracks.filter((track) => !track.coverUrl).length;
    const liveVideos = videos.filter((video) => video.published).length;

    return {
      liveTracks,
      draftTracks,
      missingAudio,
      missingCovers,
      liveVideos,
      draftVideos: videos.length - liveVideos,
    };
  }, [tracks, videos]);

  const filteredTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tracks;
    return tracks.filter((track) =>
      [track.title, track.artist, track.genre, track.mood, track.slug].some((value) =>
        value?.toLowerCase().includes(needle)
      )
    );
  }, [query, tracks]);

  const resetTrackForm = () => {
    setEditingSlug(null);
    setTrackForm(emptyTrackForm());
    setTrackErrors({});
    setUploadPhase('');
  };

  const resetVideoForm = () => {
    setEditingVideoId(null);
    setVideoForm(emptyVideoForm());
    setVideoErrors({});
  };

  const startEditTrack = (track: PublishedTrack) => {
    setEditingSlug(track.slug);
    setTrackErrors({});
    setUploadPhase('');
    setTrackForm({
      title: track.title,
      artist: track.artist,
      genre: GENRES.includes(track.genre) ? track.genre : 'Other',
      bpm: track.bpm ? String(track.bpm) : '',
      mood: track.mood ?? '',
      story: track.story ?? '',
      spotifyUrl: track.spotifyUrl ?? '',
      appleMusicUrl: track.appleMusicUrl ?? '',
      published: track.published,
      audioFile: null,
      coverFile: null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditVideo = (video: VideoRecord) => {
    setEditingVideoId(video.id);
    setVideoErrors({});
    setVideoForm({
      title: video.title,
      artist: video.artist ?? '',
      youtubeUrl: video.youtubeUrl,
      duration: video.duration ?? '',
      published: video.published,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function uploadFile(file: File, bucket: 'audio' | 'covers') {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `monstajam/${bucket}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setUploadPhase(bucket === 'audio' ? 'Uploading audio to Blob storage' : 'Uploading cover art to Blob storage');
    const blob = await upload(path, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      contentType: file.type || 'application/octet-stream',
      multipart: bucket === 'audio',
    });
    return blob.url;
  }

  function validateTrackForm() {
    const errors: Record<string, string> = {};
    const editingTrack = editingSlug ? tracks.find((track) => track.slug === editingSlug) : null;
    const hasAudio = Boolean(editingTrack?.audioUrl || trackForm.audioFile);

    if (!trackForm.title.trim()) errors.title = 'Track title is required.';
    if (!trackForm.artist.trim()) errors.artist = 'Artist name is required.';
    if (trackForm.bpm && Number.isNaN(Number(trackForm.bpm))) errors.bpm = 'BPM must be a number.';
    if (trackForm.bpm && (Number(trackForm.bpm) < 40 || Number(trackForm.bpm) > 300)) {
      errors.bpm = 'BPM must be between 40 and 300.';
    }
    if (trackForm.published && !hasAudio) {
      errors.audio = 'Live tracks need an audio file. Save as draft if the audio is not ready.';
    }

    setTrackErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleTrackSubmit() {
    if (!validateTrackForm()) return;

    setSubmittingTrack(true);
    setUploadPhase(editingSlug ? 'Saving track changes' : 'Preparing new track');

    try {
      let audioUrl: string | undefined;
      let coverUrl: string | undefined;
      if (trackForm.audioFile) audioUrl = await uploadFile(trackForm.audioFile, 'audio');
      if (trackForm.coverFile) coverUrl = await uploadFile(trackForm.coverFile, 'covers');

      const payload: Record<string, unknown> = {
        title: trackForm.title.trim(),
        artist: trackForm.artist.trim(),
        genre: trackForm.genre,
        bpm: trackForm.bpm ? Number(trackForm.bpm) : undefined,
        mood: trackForm.mood.trim() || undefined,
        story: trackForm.story.trim() || undefined,
        spotifyUrl: trackForm.spotifyUrl.trim() || undefined,
        appleMusicUrl: trackForm.appleMusicUrl.trim() || undefined,
        color: GENRE_COLORS[trackForm.genre] ?? GENRE_COLORS.Other,
        published: trackForm.published,
      };

      if (audioUrl) payload.audioUrl = audioUrl;
      if (coverUrl) payload.coverUrl = coverUrl;

      const res = editingSlug
        ? await fetch(`/api/tracks/${editingSlug}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/tracks', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              slug: slugify(trackForm.title),
              number: tracks.reduce((max, track) => Math.max(max, track.number), 0) + 1,
            }),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || (editingSlug ? 'Track update failed.' : 'Track create failed.'));
      }

      showToast('success', editingSlug ? 'Track changes saved.' : 'Track added to the library.');
      resetTrackForm();
      await loadTracks();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Track save failed.');
    } finally {
      setSubmittingTrack(false);
      setUploadPhase('');
    }
  }

  async function toggleTrackPublish(track: PublishedTrack) {
    try {
      if (!track.published && !track.audioUrl) {
        showToast('error', 'Add audio before publishing this track.');
        return;
      }
      const res = await fetch(`/api/tracks/${track.slug}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !track.published }),
      });
      if (!res.ok) throw new Error('Publish status failed to update.');
      showToast('success', !track.published ? 'Track published.' : 'Track moved to draft.');
      await loadTracks();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Publish status failed to update.');
    }
  }

  async function handleDeleteTrack(track: PublishedTrack) {
    try {
      const res = await fetch(`/api/tracks/${track.slug}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Track delete failed.');
      showToast('success', 'Track deleted.');
      if (editingSlug === track.slug) resetTrackForm();
      await loadTracks();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Track delete failed.');
    } finally {
      setConfirm(null);
    }
  }

  function validateVideoForm() {
    const errors: Record<string, string> = {};
    const youtubeId = extractYouTubeId(videoForm.youtubeUrl);
    if (!videoForm.title.trim()) errors.title = 'Video title is required.';
    if (!videoForm.youtubeUrl.trim()) errors.youtubeUrl = 'YouTube URL is required.';
    if (videoForm.youtubeUrl.trim() && !youtubeId) errors.youtubeUrl = 'Use a valid YouTube watch, short, embed, or youtu.be URL.';
    setVideoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleVideoSubmit() {
    if (!validateVideoForm()) return;
    const youtubeId = extractYouTubeId(videoForm.youtubeUrl);
    if (!youtubeId) return;

    setSubmittingVideo(true);
    try {
      const payload = {
        title: videoForm.title.trim(),
        artist: videoForm.artist.trim() || undefined,
        youtubeUrl: videoForm.youtubeUrl.trim(),
        youtubeId,
        duration: videoForm.duration.trim() || undefined,
        published: videoForm.published,
        order: editingVideoId ? undefined : videos.length,
      };

      const res = editingVideoId
        ? await fetch(`/api/videos/${editingVideoId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/videos', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error(editingVideoId ? 'Video update failed.' : 'Video create failed.');
      showToast('success', editingVideoId ? 'Video changes saved.' : 'Video added.');
      resetVideoForm();
      await loadVideos();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Video save failed.');
    } finally {
      setSubmittingVideo(false);
    }
  }

  async function toggleVideoPublish(video: VideoRecord) {
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !video.published }),
      });
      if (!res.ok) throw new Error('Video publish status failed to update.');
      showToast('success', !video.published ? 'Video published.' : 'Video moved to draft.');
      await loadVideos();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Video publish status failed to update.');
    }
  }

  async function handleDeleteVideo(video: VideoRecord) {
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Video delete failed.');
      showToast('success', 'Video deleted.');
      if (editingVideoId === video.id) resetVideoForm();
      await loadVideos();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Video delete failed.');
    } finally {
      setConfirm(null);
    }
  }

  const confirmDelete = () => {
    if (!confirm) return;
    if (confirm.kind === 'track') {
      handleDeleteTrack(confirm.item);
    } else {
      handleDeleteVideo(confirm.item);
    }
  };

  const youtubePreviewId = extractYouTubeId(videoForm.youtubeUrl);

  return (
    <section className="relative overflow-hidden bg-[#080b12] px-4 pb-10 pt-4 text-white [&_button]:min-h-11 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,199,190,0.14),transparent_28%),radial-gradient(circle_at_86%_2%,rgba(255,80,130,0.12),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
              <Disc3 className="h-4 w-4" />
              Creator suite
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              MonstaJam backstage
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Upload songs, prep releases, manage videos, and catch missing media before anything goes live.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/upload/community"
              className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:text-white"
            >
              Community
            </a>
            <button
              type="button"
              onClick={() => {
                loadTracks();
                loadVideos();
              }}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/upload/login';
              }}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tracks" value={tracks.length} detail={`${metrics.liveTracks} live, ${metrics.draftTracks} draft`} />
          <StatCard label="Videos" value={videos.length} detail={`${metrics.liveVideos} live, ${metrics.draftVideos} draft`} />
          <StatCard label="Media flags" value={metrics.missingAudio + metrics.missingCovers} detail={`${metrics.missingAudio} audio, ${metrics.missingCovers} covers missing`} />
          <StatCard label="Last check" value={lastLoadedAt ? formatDate(lastLoadedAt.toISOString()) : '--'} detail="Admin library refresh" />
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {[
            { id: 'tracks' as const, label: 'Tracks', icon: Music },
            { id: 'videos' as const, label: 'Videos', icon: Video },
            { id: 'ops' as const, label: 'Ops', icon: LayoutDashboard },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={[
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
                activeTab === id
                  ? 'bg-cyan-300 text-slate-950'
                  : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {activeTab === 'tracks' && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{editingSlug ? 'Edit track' : 'New track'}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {editingSlug ? `Editing ${editingSlug}. Media only changes when you select replacement files.` : 'Create a draft first, then publish after media is checked.'}
                  </p>
                </div>
                {editingSlug && (
                  <button
                    type="button"
                    onClick={resetTrackForm}
                    className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    New track
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Track title" required error={trackErrors.title}>
                  <TextInput
                    value={trackForm.title}
                    onChange={(event) => setTrackForm((form) => ({ ...form, title: event.target.value }))}
                    placeholder="Cold World"
                  />
                </Field>
                <Field label="Artist" required error={trackErrors.artist}>
                  <TextInput
                    value={trackForm.artist}
                    onChange={(event) => setTrackForm((form) => ({ ...form, artist: event.target.value }))}
                    placeholder="Jason Miller"
                  />
                </Field>
                <Field label="Genre">
                  <Select value={trackForm.genre} onChange={(event) => setTrackForm((form) => ({ ...form, genre: event.target.value }))}>
                    {GENRES.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="BPM" error={trackErrors.bpm}>
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    value={trackForm.bpm}
                    onChange={(event) => setTrackForm((form) => ({ ...form, bpm: event.target.value }))}
                    placeholder="88"
                  />
                </Field>
                <Field label="Mood">
                  <TextInput
                    value={trackForm.mood}
                    onChange={(event) => setTrackForm((form) => ({ ...form, mood: event.target.value }))}
                    placeholder="Moody"
                  />
                </Field>
                <Field label="Spotify URL">
                  <TextInput
                    value={trackForm.spotifyUrl}
                    onChange={(event) => setTrackForm((form) => ({ ...form, spotifyUrl: event.target.value }))}
                    placeholder="https://open.spotify.com/..."
                  />
                </Field>
                <Field label="Apple Music URL">
                  <TextInput
                    value={trackForm.appleMusicUrl}
                    onChange={(event) => setTrackForm((form) => ({ ...form, appleMusicUrl: event.target.value }))}
                    placeholder="https://music.apple.com/..."
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Track story / lyrics">
                    <TextArea
                      value={trackForm.story}
                      onChange={(event) => setTrackForm((form) => ({ ...form, story: event.target.value }))}
                      placeholder="Notes, lyrics, release story, or context."
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label={editingSlug ? 'Replace audio file' : 'Audio file'} error={trackErrors.audio}>
                  <div className="rounded-md border border-dashed border-cyan-300/30 bg-cyan-300/[0.03] p-4">
                    <div className="flex items-center gap-3 text-sm text-slate-300">
                      <FileAudio className="h-5 w-5 text-cyan-300" />
                      <span>{fileLabel(trackForm.audioFile, editingSlug ? 'Keep current audio unless replaced' : 'MP3 or WAV')}</span>
                    </div>
                    <input
                      type="file"
                      accept=".wav,.mp3,audio/*"
                      className="mt-3 block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                      onChange={(event) => setTrackForm((form) => ({ ...form, audioFile: event.target.files?.[0] ?? null }))}
                    />
                  </div>
                </Field>
                <Field label={editingSlug ? 'Replace cover art' : 'Cover art'}>
                  <div className="rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-3 text-sm text-slate-300">
                      <ImageIcon className="h-5 w-5 text-slate-300" />
                      <span>{fileLabel(trackForm.coverFile, editingSlug ? 'Keep current cover unless replaced' : 'PNG or JPG')}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="mt-3 block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                      onChange={(event) => setTrackForm((form) => ({ ...form, coverFile: event.target.files?.[0] ?? null }))}
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Toggle
                  checked={trackForm.published}
                  onChange={(published) => setTrackForm((form) => ({ ...form, published }))}
                  label={trackForm.published ? 'Publish live' : 'Save as draft'}
                  help={trackForm.published ? 'Requires audio and appears publicly.' : 'Hidden from the public library.'}
                />
                <button
                  type="button"
                  onClick={handleTrackSubmit}
                  disabled={submittingTrack}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingTrack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {editingSlug ? 'Save changes' : 'Add track'}
                </button>
              </div>
              {uploadPhase && <p className="mt-3 text-sm text-cyan-200">{uploadPhase}</p>}
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Track library</h2>
                    <p className="mt-1 text-sm text-slate-400">{filteredTracks.length} visible of {tracks.length}</p>
                  </div>
                  {tracksLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
                </div>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <TextInput
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, artist, genre"
                    className="pl-9"
                  />
                </label>
              </div>

              <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {!tracksLoading && filteredTracks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                    No tracks match that search.
                  </div>
                )}
                {filteredTracks.map((track) => (
                  <article
                    key={track.id}
                    className={[
                      'rounded-lg border p-4 transition',
                      editingSlug === track.slug ? 'border-cyan-300/50 bg-cyan-300/[0.06]' : 'border-white/10 bg-slate-950/50 hover:border-white/20',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-white">{track.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {track.artist} · {track.genre}{track.bpm ? ` · ${track.bpm} BPM` : ''}
                        </p>
                      </div>
                      <StatusPill tone={track.published ? 'live' : 'draft'}>{track.published ? 'Live' : 'Draft'}</StatusPill>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone={track.audioUrl ? 'neutral' : 'warn'}>{track.audioUrl ? 'Audio' : 'No audio'}</StatusPill>
                      <StatusPill tone={track.coverUrl ? 'neutral' : 'warn'}>{track.coverUrl ? 'Cover' : 'No cover'}</StatusPill>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(track.updatedAt ?? track.createdAt)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditTrack(track)}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-cyan-300/20 px-2 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTrackPublish(track)}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25"
                      >
                        {track.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {track.published ? 'Draft' : 'Live'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'track', item: track })}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-300/20 px-2 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{editingVideoId ? 'Edit video' : 'New video'}</h2>
                  <p className="mt-1 text-sm text-slate-400">Paste any standard YouTube URL and the dashboard will extract the video ID.</p>
                </div>
                {editingVideoId && (
                  <button type="button" onClick={resetVideoForm} className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white">
                    New video
                  </button>
                )}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Video title" required error={videoErrors.title}>
                  <TextInput value={videoForm.title} onChange={(event) => setVideoForm((form) => ({ ...form, title: event.target.value }))} />
                </Field>
                <Field label="Artist">
                  <TextInput value={videoForm.artist} onChange={(event) => setVideoForm((form) => ({ ...form, artist: event.target.value }))} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="YouTube URL" required error={videoErrors.youtubeUrl}>
                    <TextInput
                      value={videoForm.youtubeUrl}
                      onChange={(event) => setVideoForm((form) => ({ ...form, youtubeUrl: event.target.value }))}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                    {youtubePreviewId && <p className="mt-2 text-sm text-emerald-300">Video ID: {youtubePreviewId}</p>}
                  </Field>
                </div>
                <Field label="Duration">
                  <TextInput value={videoForm.duration} onChange={(event) => setVideoForm((form) => ({ ...form, duration: event.target.value }))} placeholder="3:52" />
                </Field>
              </div>
              {youtubePreviewId && (
                <div className="mt-5 max-w-lg overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://img.youtube.com/vi/${youtubePreviewId}/maxresdefault.jpg`} alt="YouTube thumbnail preview" className="aspect-video w-full object-cover" />
                </div>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Toggle
                  checked={videoForm.published}
                  onChange={(published) => setVideoForm((form) => ({ ...form, published }))}
                  label={videoForm.published ? 'Publish video' : 'Save video as draft'}
                  help={videoForm.published ? 'Appears on the public video page.' : 'Hidden until approved.'}
                />
                <button
                  type="button"
                  onClick={handleVideoSubmit}
                  disabled={submittingVideo}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-red-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                  {editingVideoId ? 'Save changes' : 'Add video'}
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Video library</h2>
                  <p className="mt-1 text-sm text-slate-400">{videos.length} videos</p>
                </div>
                {videosLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
              </div>
              <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {!videosLoading && videos.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                    No videos yet.
                  </div>
                )}
                {videos.map((video) => (
                  <article key={video.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                    <div className="overflow-hidden rounded-md border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} alt={video.title} className="aspect-video w-full object-cover" />
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{video.title}</h3>
                        {video.artist && <p className="mt-1 text-xs text-slate-500">{video.artist}</p>}
                      </div>
                      <StatusPill tone={video.published ? 'live' : 'draft'}>{video.published ? 'Live' : 'Draft'}</StatusPill>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => startEditVideo(video)} className="rounded-md border border-cyan-300/20 px-2 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/50">Edit</button>
                      <button type="button" onClick={() => toggleVideoPublish(video)} className="rounded-md border border-white/10 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25">
                        {video.published ? 'Draft' : 'Live'}
                      </button>
                      <button type="button" onClick={() => setConfirm({ kind: 'video', item: video })} className="rounded-md border border-rose-300/20 px-2 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'ops' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-white">Release readiness</h2>
              <div className="mt-5 space-y-3">
                {[
                  { label: 'All live tracks have audio', ok: tracks.filter((track) => track.published && !track.audioUrl).length === 0 },
                  { label: 'All live tracks have cover art', ok: tracks.filter((track) => track.published && !track.coverUrl).length === 0 },
                  { label: 'Admin library is reachable', ok: !tracksLoading && !videosLoading },
                  { label: 'Drafts are separated from public output', ok: metrics.draftTracks + metrics.draftVideos >= 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-white/10 bg-slate-950/50 p-3">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    {item.ok ? <CheckCircle className="h-5 w-5 text-emerald-300" /> : <AlertTriangle className="h-5 w-5 text-amber-300" />}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-white">Needs attention</h2>
              <div className="mt-5 space-y-3">
                {tracks.filter((track) => !track.audioUrl || !track.coverUrl).length === 0 ? (
                  <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-200">
                    No missing track media found.
                  </div>
                ) : (
                  tracks
                    .filter((track) => !track.audioUrl || !track.coverUrl)
                    .map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('tracks');
                          startEditTrack(track);
                        }}
                        className="flex w-full items-center justify-between rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-left text-sm text-amber-100 transition hover:border-amber-300/40"
                      >
                        <span>
                          <span className="block font-semibold">{track.title}</span>
                          <span className="mt-1 block text-xs text-amber-200/70">
                            {!track.audioUrl ? 'Missing audio' : 'Audio ok'} · {!track.coverUrl ? 'Missing cover' : 'Cover ok'}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} onConfirm={confirmDelete} />
    </section>
  );
}
