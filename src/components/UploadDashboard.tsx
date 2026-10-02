'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { AdminSaveError, adminFetch, formChanged, readAdminResponse } from '@/lib/admin-save';
import type { AdminIdentity } from '@/lib/admin-account-client';
import { initialPlaybackMode, loadAdminAudioAsset, prepareAdminAudio, type AdminAudioAsset, type AudioPreparation, type PlaybackMode } from '@/lib/admin-audio';
import { usePlayer } from '@/context/PlayerContext';
import { useAdminNavigationGuard } from './useAdminNavigationGuard';
import { useDiscardConfirmation } from './useDiscardConfirmation';
import { useAdminLibrary, type LibraryState } from './useAdminLibrary';
import SelectedMediaPreview from './SelectedMediaPreview';
import AdminTrash, { type TrashItem, type TrashKind } from './AdminTrash';
import PublishingReviewDialog, { type PublishingTarget } from './PublishingReviewDialog';
import type { PublishingReview } from '@/lib/publishing-types';
import { extractYouTubeId } from '@/lib/youtube';
import { slugifyTrackTitle, TRACK_TITLE_CONFLICT } from '@/lib/track-title';
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
  audioAssetId?: string | null;
  playbackMode?: PlaybackMode | null;
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

type AdminTab = 'tracks' | 'videos' | 'trash' | 'ops';
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
  playbackMode: PlaybackMode;
  previewStart: string;
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
  playbackMode: 'preview',
  previewStart: '0',
});

const emptyVideoForm = (): VideoFormState => ({
  title: '',
  artist: '',
  youtubeUrl: '',
  duration: '',
  published: false,
});

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

function hasTrackAudio(track: PublishedTrack) {
  return Boolean(track.audioUrl || track.audioAssetId);
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
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

function LibraryNotice({ state, kind, onRetry }: { state: LibraryState; kind: 'tracks' | 'videos'; onRetry: () => void }) {
  const label = kind === 'tracks' ? 'Track' : 'Video';
  if (state.status === 'loading') return <p role="status" className="mt-4 text-sm text-slate-400">{state.lastSuccessAt ? `Refreshing ${kind}; showing the previous results.` : `Loading ${kind}…`}</p>;
  if (state.status !== 'error') return null;
  return (
    <div role="alert" className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
      <p className="font-semibold">{label} library unavailable</p>
      <p className="mt-1">{state.error?.message}</p>
      {state.lastSuccessAt && <p className="mt-1">Showing previously loaded {kind}. Last loaded <time dateTime={state.lastSuccessAt.toISOString()}>{formatDate(state.lastSuccessAt.toISOString())}</time>.</p>}
      <button type="button" onClick={onRetry} className="mt-2 underline">Retry {kind}</button>
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
    if (!toast || toast.type === 'error') return;
    const timer = window.setTimeout(onDismiss, 4800);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div role={toast.type === 'error' ? 'alert' : 'status'} className="fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-white/10 bg-slate-950/95 p-4 text-sm shadow-2xl shadow-black/40">
      {toast.type === 'success' ? (
        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-300" />
      )}
      <div className="text-slate-100">{toast.message}</div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}

function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
  busy,
}: {
  confirm: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  if (!confirm) return null;

  const title = confirm.kind === 'track' ? confirm.item.title : confirm.item.title;
  const noun = confirm.kind === 'track' ? 'track' : 'video';

  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} aria-label={`Move ${noun} to Trash`} className="fixed inset-0 m-auto bg-transparent p-4 text-white backdrop:bg-black/75">
      <div className="w-full max-w-md rounded-lg border border-rose-400/30 bg-slate-950 p-6 shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-rose-400/10 text-rose-300">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Move {noun} to Trash</h3>
            <p className="mt-1 text-sm text-slate-400">&quot;{title}&quot; will be hidden from the website. Its saved details and files will be kept, and you can restore it as a draft from Trash.</p>
            <p className="mt-1 text-sm text-slate-400">Any unsaved edits to this item will also be discarded.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            {busy ? 'Moving…' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function UploadDashboard({ currentAdmin }: { currentAdmin: AdminIdentity }) {
  const { pause: pausePublicPlayer, isPlaying: publicPlayerPlaying } = usePlayer();
  const [activeTab, setActiveTab] = useState<AdminTab>('tracks');
  const [trashRevision, setTrashRevision] = useState(0);
  const { tracks, videos, setTracks, setVideos, trackState, videoState, reload, lastLoadedAt, identity, sessionState, reportError } = useAdminLibrary<PublishedTrack, VideoRecord>(currentAdmin);
  const tracksLoading = trackState.status === 'loading';
  const videosLoading = videoState.status === 'loading';
  const tracksAvailable = trackState.lastSuccessAt !== null;
  const videosAvailable = videoState.lastSuccessAt !== null;
  const tracksCurrent = trackState.status === 'ready' && sessionState === 'ready';
  const videosCurrent = videoState.status === 'ready' && sessionState === 'ready';
  const libraryCurrent = tracksCurrent && videosCurrent;
  const sessionExpired = sessionState === 'expired';
  const connectionNeedsAttention = sessionState === 'error' || trackState.status === 'error' || videoState.status === 'error';
  const [query, setQuery] = useState('');
  const [trackForm, setTrackForm] = useState<TrackFormState>(() => emptyTrackForm());
  const [videoForm, setVideoForm] = useState<VideoFormState>(() => emptyVideoForm());
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [trackRevision, setTrackRevision] = useState<string | undefined>(undefined);
  const [videoRevision, setVideoRevision] = useState<string | undefined>(undefined);
  const [submittingTrack, setSubmittingTrack] = useState(false);
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('');
  const [uploadTransfer, setUploadTransfer] = useState<{ label: string; percentage: number } | null>(null);
  const uploadAttempt = useRef(0);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [publishingTarget, setPublishingTarget] = useState<PublishingTarget | null>(null);
  const [trackErrors, setTrackErrors] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});
  const [trackBaseline, setTrackBaseline] = useState(emptyTrackForm);
  const [videoBaseline, setVideoBaseline] = useState(emptyVideoForm);
  const [trackFormVersion, setTrackFormVersion] = useState(0);
  const [trackSaveError, setTrackSaveError] = useState<string | null>(null);
  const [videoSaveError, setVideoSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const operation = useRef(false);
  const uploadedFiles = useRef<Partial<Record<'audio' | 'covers', { file: File; url: string }>>>({});
  const preparedAudio = useRef<AudioPreparation | undefined>(undefined);
  const audioDetailVersion = useRef(0);
  const [savedAudio, setSavedAudio] = useState<AdminAudioAsset | null>(null);
  const [audioDetailsLoading, setAudioDetailsLoading] = useState(false);
  const [audioDetailsError, setAudioDetailsError] = useState<string | null>(null);
  const fullAudition = useRef<HTMLAudioElement>(null);
  const previewAudition = useRef<HTMLAudioElement>(null);
  const selectedAudition = useRef<HTMLAudioElement>(null);
  const editingTrack = editingSlug ? tracks.find((track) => track.slug === editingSlug) : undefined;
  const newTrackSlug = slugifyTrackTitle(trackForm.title);
  const conflictingTrack = !editingSlug && newTrackSlug ? tracks.find((track) => track.slug === newTrackSlug) : undefined;
  const canChoosePreviewStart = Boolean(trackForm.audioFile || (editingTrack?.audioAssetId && savedAudio && !audioDetailsLoading));
  const trackDirty = formChanged(trackForm, trackBaseline);
  const videoDirty = formChanged(videoForm, videoBaseline);

  useEffect(() => {
    if (!publicPlayerPlaying) return;
    fullAudition.current?.pause();
    previewAudition.current?.pause();
    selectedAudition.current?.pause();
  }, [publicPlayerPlaying]);

  function playAudition(kind: 'full' | 'preview' | 'selected') {
    pausePublicPlayer();
    if (kind !== 'full') fullAudition.current?.pause();
    if (kind !== 'preview') previewAudition.current?.pause();
    if (kind !== 'selected') selectedAudition.current?.pause();
  }

  const navigationBlocked = useCallback(() => {
    setToast({ type: 'error', message: 'Please wait for the current request to finish before leaving.' });
  }, []);
  const discard = useDiscardConfirmation();
  const approveLeave = useAdminNavigationGuard(trackDirty || videoDirty, Boolean(busy), navigationBlocked, discard.ask);

  function beginOperation(label: string, requiresSession = true) {
    if (operation.current || (requiresSession && sessionExpired)) return false;
    operation.current = true;
    setBusy(label);
    return true;
  }
  function endOperation() {
    operation.current = false;
    setBusy(null);
  }
  async function mayDiscard(dirty: boolean) {
    if (operation.current) return false;
    const approved = !dirty || await discard.ask();
    return approved && !operation.current;
  }

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  const metrics = useMemo(() => {
    const liveTracks = tracks.filter((track) => track.published).length;
    const draftTracks = tracks.length - liveTracks;
    const missingAudio = tracks.filter((track) => !hasTrackAudio(track)).length;
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
    ++audioDetailVersion.current;
    fullAudition.current?.pause();
    previewAudition.current?.pause();
    selectedAudition.current?.pause();
    const empty = emptyTrackForm();
    setEditingSlug(null);
    setTrackRevision(undefined);
    setTrackForm(empty);
    setTrackBaseline(empty);
    setTrackFormVersion((value) => value + 1);
    uploadedFiles.current = {};
    preparedAudio.current = undefined;
    setSavedAudio(null);
    setAudioDetailsLoading(false);
    setAudioDetailsError(null);
    setTrackSaveError(null);
    setTrackErrors({});
    setUploadPhase('');
    setUploadTransfer(null);
  };

  const resetVideoForm = () => {
    const empty = emptyVideoForm();
    setEditingVideoId(null);
    setVideoRevision(undefined);
    setVideoForm(empty);
    setVideoBaseline(empty);
    setVideoSaveError(null);
    setVideoErrors({});
  };

  async function readSavedAudio(assetId: string, version: number) {
    setAudioDetailsLoading(true);
    setAudioDetailsError(null);
    try {
      const asset = await loadAdminAudioAsset(assetId);
      if (version !== audioDetailVersion.current) return;
      setSavedAudio(asset);
      setTrackForm((current) => current.audioFile ? current : { ...current, previewStart: String(asset.previewStart) });
      setTrackBaseline((current) => ({ ...current, previewStart: String(asset.previewStart) }));
    } catch (error) {
      if (version !== audioDetailVersion.current) return;
      reportError(error);
      setAudioDetailsError(error instanceof Error ? error.message : 'Saved preview settings could not be loaded.');
    } finally {
      if (version === audioDetailVersion.current) setAudioDetailsLoading(false);
    }
  }

  const startEditTrack = async (track: PublishedTrack) => {
    if (operation.current) return;
    if (editingSlug === track.slug && trackRevision === track.updatedAt) {
      setActiveTab('tracks');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!await mayDiscard(trackDirty) || operation.current) return;
    fullAudition.current?.pause();
    previewAudition.current?.pause();
    selectedAudition.current?.pause();
    setEditingSlug(track.slug);
    setTrackRevision(track.updatedAt);
    setTrackErrors({});
    setUploadPhase('');
    const form: TrackFormState = {
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      bpm: track.bpm ? String(track.bpm) : '',
      mood: track.mood ?? '',
      story: track.story ?? '',
      spotifyUrl: track.spotifyUrl ?? '',
      appleMusicUrl: track.appleMusicUrl ?? '',
      published: track.published,
      audioFile: null,
      coverFile: null,
      playbackMode: initialPlaybackMode(track),
      previewStart: '0',
    };
    setTrackForm(form);
    setTrackBaseline(form);
    setTrackSaveError(null);
    setTrackFormVersion((value) => value + 1);
    uploadedFiles.current = {};
    preparedAudio.current = undefined;
    setSavedAudio(null);
    setAudioDetailsError(null);
    const audioVersion = ++audioDetailVersion.current;
    setAudioDetailsLoading(Boolean(track.audioAssetId));
    if (track.audioAssetId) {
      void readSavedAudio(track.audioAssetId, audioVersion);
    }
    setActiveTab('tracks');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditVideo = async (video: VideoRecord) => {
    if (operation.current) return;
    if (editingVideoId === video.id && videoRevision === video.updatedAt) {
      fullAudition.current?.pause();
      previewAudition.current?.pause();
      selectedAudition.current?.pause();
      setActiveTab('videos');
      return;
    }
    if (!await mayDiscard(videoDirty) || operation.current) return;
    fullAudition.current?.pause();
    previewAudition.current?.pause();
    selectedAudition.current?.pause();
    setEditingVideoId(video.id);
    setVideoRevision(video.updatedAt);
    setVideoErrors({});
    const form: VideoFormState = {
      title: video.title,
      artist: video.artist ?? '',
      youtubeUrl: video.youtubeUrl,
      duration: video.duration ?? '',
      published: video.published,
    };
    setVideoForm(form);
    setVideoBaseline(form);
    setVideoSaveError(null);
    setActiveTab('videos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function uploadFile(file: File, bucket: 'audio' | 'covers') {
    const cached = uploadedFiles.current[bucket];
    if (cached?.file === file) return cached.url;
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120) || `audio.${ext}`;
    const path = bucket === 'audio'
      ? `monstajam/originals/${crypto.randomUUID()}-${safeName}`
      : `monstajam/covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setUploadPhase(bucket === 'audio' ? 'Uploading your private original…' : 'Uploading cover art…');
    const attempt = ++uploadAttempt.current;
    const label = bucket === 'audio' ? 'Audio upload' : 'Artwork upload';
    setUploadTransfer({ label, percentage: 0 });
    try {
      const blob = await upload(path, file, {
        access: bucket === 'audio' ? 'private' : 'public',
        handleUploadUrl: '/api/upload',
        contentType: file.type || 'application/octet-stream',
        multipart: bucket === 'audio',
        onUploadProgress: ({ percentage }) => {
          if (uploadAttempt.current !== attempt || !Number.isFinite(percentage)) return;
          const value = Math.floor(Math.max(0, Math.min(100, percentage)));
          setUploadTransfer((current) => current?.percentage === value ? current : { label, percentage: value });
        },
      });
      uploadedFiles.current[bucket] = { file, url: blob.url };
      return blob.url;
    } finally {
      // Ignore delayed SDK callbacks after this upload has finished or failed.
      if (uploadAttempt.current === attempt) { ++uploadAttempt.current; setUploadTransfer(null); }
    }
  }

  function validateTrackForm() {
    const errors: Record<string, string> = {};
    const editingTrack = editingSlug ? tracks.find((track) => track.slug === editingSlug) : null;
    const hasAudio = Boolean(editingTrack?.audioUrl || editingTrack?.audioAssetId || trackForm.audioFile);

    if (!trackForm.title.trim()) errors.title = 'Track title is required.';
    else if (trackForm.title.trim().length > 200) errors.title = 'Use a track title of 200 characters or fewer.';
    else if (!editingSlug && !newTrackSlug) errors.title = 'Include at least one letter or number in the track title.';
    else if (conflictingTrack) errors.title = TRACK_TITLE_CONFLICT;
    if (!trackForm.artist.trim()) errors.artist = 'Artist name is required.';
    if (trackForm.bpm && !Number.isInteger(Number(trackForm.bpm))) errors.bpm = 'BPM must be a whole number.';
    if (trackForm.bpm && (Number(trackForm.bpm) < 40 || Number(trackForm.bpm) > 300)) {
      errors.bpm = 'BPM must be between 40 and 300.';
    }
    if (editingTrack?.published && trackForm.published && !hasAudio) {
      errors.audio = 'Live tracks need an audio file. Save as draft if the audio is not ready.';
    }
    if (trackForm.audioFile && trackForm.audioFile.size > 500 * 1024 * 1024) {
      errors.audio = 'Choose an audio file of 500 MB or less.';
    }
    if (canChoosePreviewStart && (!Number.isFinite(Number(trackForm.previewStart)) || Number(trackForm.previewStart) < 0 || Number(trackForm.previewStart) > 7200)) {
      errors.previewStart = 'Choose a start time between 0 and 7,200 seconds.';
    }

    setTrackErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleTrackSubmit() {
    if (operation.current || tracksLoading || !tracksAvailable || !validateTrackForm()) return;
    if (!beginOperation('Saving track…')) return;

    setSubmittingTrack(true);
    setTrackSaveError(null);
    setToast(null);
    setUploadPhase(editingSlug ? 'Saving track changes' : 'Preparing new track');

    try {
      let checkedSlug = newTrackSlug;
      if (!editingSlug) {
        setUploadPhase('Checking track title…');
        try {
          const response = await adminFetch(`/api/admin/track-title?title=${encodeURIComponent(trackForm.title.trim())}`, { credentials: 'include', cache: 'no-store' });
          const result = await readAdminResponse<{ slug: string; available: boolean }>(response);
          if (result.available !== true || result.slug !== newTrackSlug) throw new Error('Incomplete title check');
          checkedSlug = result.slug;
        } catch (error) {
          if (error instanceof AdminSaveError) throw error;
          throw new AdminSaveError('The track title could not be checked. No new files were uploaded. Please retry.');
        }
      }
      let audioAssetId: string | undefined;
      let coverUrl: string | undefined;
      const previewStart = Number(trackForm.previewStart || 0);
      const currentTrack = editingSlug ? tracks.find((track) => track.slug === editingSlug) : undefined;
      const reviewAfterSaving = trackForm.published && !currentTrack?.published;
      if (trackForm.audioFile || (currentTrack?.audioAssetId && savedAudio && previewStart !== savedAudio.previewStart)) {
        const source = trackForm.audioFile
          ? { originalUrl: await uploadFile(trackForm.audioFile, 'audio'), originalName: trackForm.audioFile.name }
          : { audioAssetId: currentTrack!.audioAssetId! };
        const asset = await prepareAdminAudio(source, previewStart, {
          previous: preparedAudio.current,
          onAsset: (preparation) => { preparedAudio.current = preparation; },
          onProgress: setUploadPhase,
        });
        audioAssetId = asset.id;
      }
      if (trackForm.coverFile) coverUrl = await uploadFile(trackForm.coverFile, 'covers');
      setUploadPhase('Saving track changes…');

      const payload: Record<string, unknown> = {
        title: trackForm.title.trim(),
        artist: trackForm.artist.trim(),
        genre: trackForm.genre,
        bpm: trackForm.bpm ? Number(trackForm.bpm) : null,
        mood: trackForm.mood.trim() || null,
        story: trackForm.story.trim() || null,
        spotifyUrl: trackForm.spotifyUrl.trim() || null,
        appleMusicUrl: trackForm.appleMusicUrl.trim() || null,
        color: GENRE_COLORS[trackForm.genre] ?? GENRE_COLORS.Other,
        published: reviewAfterSaving ? false : trackForm.published,
        playbackMode: trackForm.playbackMode,
      };

      if (audioAssetId) payload.audioAssetId = audioAssetId;
      if (coverUrl) payload.coverUrl = coverUrl;
      if (editingSlug) payload.expectedUpdatedAt = trackRevision;

      const res = editingSlug
        ? await adminFetch(`/api/tracks/${editingSlug}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await adminFetch('/api/tracks', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              slug: checkedSlug,
              number: tracks.reduce((max, track) => Math.max(max, track.number), 0) + 1,
            }),
          });

      const saved = await readAdminResponse<PublishedTrack>(res);
      setTracks((current) => [...current.filter((track) => track.id !== saved.id), saved].sort((a, b) => a.number - b.number));

      showToast('success', reviewAfterSaving ? 'Draft saved. Review it before publishing.' : editingSlug ? 'Track changes saved.' : 'Track saved as a draft. Use Review & publish when ready.');
      resetTrackForm();
      if (reviewAfterSaving) openPublishingReview({ kind: 'track', key: saved.slug });
    } catch (error) {
      reportError(error);
      if (error instanceof AdminSaveError) setTrackErrors(error.fields);
      setTrackSaveError(error instanceof AdminSaveError ? error.message : 'The save could not be confirmed. Reload the library to check before retrying.');
    } finally {
      setSubmittingTrack(false);
      setUploadPhase('');
      endOperation();
    }
  }

  async function toggleTrackPublish(track: PublishedTrack) {
    if (editingSlug === track.slug && trackDirty) {
      showToast('error', 'Save or discard your track edits before changing its publish status in the library.');
      return;
    }
    if (!track.published) {
      if (!operation.current && !sessionExpired) openPublishingReview({ kind: 'track', key: track.slug });
      return;
    }
    if (!beginOperation('Updating track status…')) return;
    try {
      const res = await adminFetch(`/api/tracks/${track.slug}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !track.published, expectedUpdatedAt: editingSlug === track.slug ? trackRevision : track.updatedAt }),
      });
      const saved = await readAdminResponse<PublishedTrack>(res);
      setTracks((current) => current.map((item) => item.id === saved.id ? saved : item));
      if (editingSlug === saved.slug) {
        setTrackRevision(saved.updatedAt);
        setTrackForm((form) => ({ ...form, published: saved.published }));
        setTrackBaseline((form) => ({ ...form, published: saved.published }));
      }
      showToast('success', !track.published ? 'Track published.' : 'Track moved to draft.');
    } catch (error) {
      reportError(error);
      showToast('error', error instanceof Error ? error.message : 'Publish status failed to update.');
    } finally { endOperation(); }
  }

  async function handleDeleteTrack(track: PublishedTrack) {
    if (!beginOperation('Moving track to Trash…')) return;
    try {
      const res = await adminFetch(`/api/tracks/${track.slug}`, { method: 'DELETE', credentials: 'include' });
      await readAdminResponse(res);
      setTracks((current) => current.filter((item) => item.id !== track.id));
      showToast('success', 'Track moved to Trash. You can restore it as a draft.');
      if (editingSlug === track.slug) resetTrackForm();
    } catch (error) {
      reportError(error);
      showToast('error', error instanceof Error ? error.message : 'The move to Trash could not be confirmed. Refresh the library before retrying.');
    } finally {
      setConfirm(null);
      endOperation();
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
    if (operation.current || videosLoading || !videosAvailable || !validateVideoForm()) return;
    const youtubeId = extractYouTubeId(videoForm.youtubeUrl);
    if (!youtubeId) return;
    if (!beginOperation('Saving video…')) return;

    setSubmittingVideo(true);
    setVideoSaveError(null);
    setToast(null);
    try {
      const currentVideo = editingVideoId ? videos.find((video) => video.id === editingVideoId) : undefined;
      const reviewAfterSaving = videoForm.published && !currentVideo?.published;
      const payload = {
        title: videoForm.title.trim(),
        artist: videoForm.artist.trim() || null,
        youtubeUrl: videoForm.youtubeUrl.trim(),
        youtubeId,
        duration: videoForm.duration.trim() || null,
        published: reviewAfterSaving ? false : videoForm.published,
        order: editingVideoId ? undefined : videos.length,
        expectedUpdatedAt: editingVideoId ? videoRevision : undefined,
      };

      const res = editingVideoId
        ? await adminFetch(`/api/videos/${editingVideoId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await adminFetch('/api/videos', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const saved = await readAdminResponse<VideoRecord>(res);
      setVideos((current) => [...current.filter((video) => video.id !== saved.id), saved].sort((a, b) => a.order - b.order));
      showToast('success', reviewAfterSaving ? 'Draft saved. Review it before publishing.' : editingVideoId ? 'Video changes saved.' : 'Video saved as a draft. Use Review & publish when ready.');
      resetVideoForm();
      if (reviewAfterSaving) openPublishingReview({ kind: 'video', key: saved.id });
    } catch (error) {
      reportError(error);
      if (error instanceof AdminSaveError) setVideoErrors(error.fields);
      setVideoSaveError(error instanceof AdminSaveError ? error.message : 'The save could not be confirmed. Reload the library to check before retrying.');
    } finally {
      setSubmittingVideo(false);
      endOperation();
    }
  }

  async function toggleVideoPublish(video: VideoRecord) {
    if (editingVideoId === video.id && videoDirty) {
      showToast('error', 'Save or discard your video edits before changing its publish status in the library.');
      return;
    }
    if (!video.published) {
      if (!operation.current && !sessionExpired) openPublishingReview({ kind: 'video', key: video.id });
      return;
    }
    if (!beginOperation('Updating video status…')) return;
    try {
      const res = await adminFetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !video.published, expectedUpdatedAt: editingVideoId === video.id ? videoRevision : video.updatedAt }),
      });
      const saved = await readAdminResponse<VideoRecord>(res);
      setVideos((current) => current.map((item) => item.id === saved.id ? saved : item));
      if (editingVideoId === saved.id) {
        setVideoRevision(saved.updatedAt);
        setVideoForm((form) => ({ ...form, published: saved.published }));
        setVideoBaseline((form) => ({ ...form, published: saved.published }));
      }
      showToast('success', !video.published ? 'Video published.' : 'Video moved to draft.');
    } catch (error) {
      reportError(error);
      showToast('error', error instanceof Error ? error.message : 'Video publish status failed to update.');
    } finally { endOperation(); }
  }

  async function handleDeleteVideo(video: VideoRecord) {
    if (!beginOperation('Moving video to Trash…')) return;
    try {
      const res = await adminFetch(`/api/videos/${video.id}`, { method: 'DELETE', credentials: 'include' });
      await readAdminResponse(res);
      setVideos((current) => current.filter((item) => item.id !== video.id));
      showToast('success', 'Video moved to Trash. You can restore it as a draft.');
      if (editingVideoId === video.id) resetVideoForm();
    } catch (error) {
      reportError(error);
      showToast('error', error instanceof Error ? error.message : 'The move to Trash could not be confirmed. Refresh the library before retrying.');
    } finally {
      setConfirm(null);
      endOperation();
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

  function stopEditorPlayback() {
    pausePublicPlayer();
    fullAudition.current?.pause();
    previewAudition.current?.pause();
    selectedAudition.current?.pause();
  }

  function openPublishingReview(target: PublishingTarget) {
    stopEditorPlayback();
    setPublishingTarget(target);
  }

  async function publishReviewedItem(review: PublishingReview) {
    if (!beginOperation('Publishing reviewed item…')) throw new AdminSaveError('Sign in and wait for the current request to finish before publishing.');
    try {
      if (review.kind === 'track') {
        const res = await adminFetch(`/api/tracks/${encodeURIComponent(review.track.slug)}`, {
          method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: true, expectedUpdatedAt: review.expectedUpdatedAt, reviewedPlaybackMode: review.playbackMode }),
        });
        const saved = await readAdminResponse<PublishedTrack>(res);
        setTracks((current) => [...current.filter((track) => track.id !== saved.id), saved].sort((a, b) => a.number - b.number));
        // Adopt the reviewed saved metadata only for this unchanged editor. Other
        // drafts and local file selections are never reset by publication.
        if (editingSlug === saved.slug) {
          resetTrackForm();
        }
        showToast('success', 'Track published.');
      } else {
        const res = await adminFetch(`/api/videos/${encodeURIComponent(review.video.id)}`, {
          method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: true, expectedUpdatedAt: review.expectedUpdatedAt }),
        });
        const saved = await readAdminResponse<VideoRecord>(res);
        setVideos((current) => [...current.filter((video) => video.id !== saved.id), saved].sort((a, b) => a.order - b.order));
        if (editingVideoId === saved.id) resetVideoForm();
        showToast('success', 'Video published.');
      }
      setPublishingTarget(null);
    } catch (error) {
      reportError(error);
      throw error;
    } finally { endOperation(); }
  }

  async function handleRestore(kind: TrashKind, item: TrashItem): Promise<boolean> {
    if (!beginOperation('Restoring from Trash…')) return false;
    try {
      const identifier = kind === 'tracks' ? item.slug! : item.id;
      const res = await adminFetch(`/api/admin/trash/${kind}/${encodeURIComponent(identifier)}/restore`, { method: 'POST', credentials: 'include' });
      let published: boolean;
      if (kind === 'tracks') {
        const saved = await readAdminResponse<PublishedTrack>(res);
        setTracks((current) => [...current.filter((track) => track.id !== saved.id), saved].sort((a, b) => a.number - b.number));
        published = saved.published;
      } else {
        const saved = await readAdminResponse<VideoRecord>(res);
        setVideos((current) => [...current.filter((video) => video.id !== saved.id), saved].sort((a, b) => a.order - b.order));
        published = saved.published;
      }
      const noun = kind === 'tracks' ? 'Track' : 'Video';
      showToast('success', published ? `${noun} was already restored and is live. Its current status has been kept.` : `${noun} restored as a draft. Review it in ${kind === 'tracks' ? 'Tracks' : 'Videos'} before publishing.`);
      return true;
    } catch (error) {
      reportError(error);
      showToast('error', error instanceof Error ? error.message : 'Restore could not be confirmed. Refresh Trash or retry Restore as draft.');
      return false;
    } finally { endOperation(); }
  }

  async function reloadLibrary() {
    if (!beginOperation('Reloading library…', false)) return;
    try { await reload(); setTrashRevision((value) => value + 1); }
    finally { endOperation(); }
  }

  async function signOut() {
    if (!await mayDiscard(trackDirty || videoDirty) || !beginOperation('Signing out…', false)) return;
    try {
      await readAdminResponse(await adminFetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
      approveLeave();
      window.location.href = '/upload/login';
    } catch (error) {
      reportError(error);
      showToast('error', error instanceof Error ? error.message : 'Sign out failed. Please retry.');
    } finally { endOperation(); }
  }

  return (
    <section className="relative overflow-hidden bg-[#080b12] px-4 pb-10 pt-4 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,199,190,0.14),transparent_28%),radial-gradient(circle_at_86%_2%,rgba(255,80,130,0.12),transparent_24%)]" />
      <fieldset disabled={Boolean(busy)} aria-busy={Boolean(busy)} className="relative mx-auto min-w-0 max-w-7xl">
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
            <p className="mt-2 text-xs text-slate-400">{sessionState === 'ready' && identity
              ? `Signed in as ${identity.name} (${identity.username}) · ${identity.role === 'owner' ? 'Owner' : 'Admin'}`
              : sessionExpired ? 'Your sign-in has expired or access is no longer active.'
                : sessionState === 'checking' ? 'Checking your sign-in…' : 'Your sign-in could not be checked.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/upload/account" className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40">Your account</a>
            {sessionState === 'ready' && identity?.role === 'owner' && <a href="/upload/admins" className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300/40">Admin access</a>}
            <button
              type="button"
              onClick={reloadLibrary}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Sign out
            </button>
          </div>
        </header>

        {(sessionExpired || connectionNeedsAttention) && <div role="alert" className="mt-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">{sessionExpired ? 'Sign-in required' : 'Connection needs attention'}</p>
          <p className="mt-1">{sessionExpired
            ? 'Sign in in a new tab, then return here and retry the connection. Your edits and selected files are still here.'
            : 'Some dashboard information could not be refreshed. Previously loaded results may be out of date. Your edits and selected files are still here.'}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {sessionExpired && <a href="/upload/login" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Sign in in a new tab</a>}
            <button type="button" onClick={reloadLibrary} className="font-semibold underline">Retry connection</button>
          </div>
        </div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tracks" value={tracksAvailable ? tracks.length : '—'} detail={tracksAvailable ? `${metrics.liveTracks} live, ${metrics.draftTracks} draft${tracksCurrent ? '' : ' · Last known'}` : tracksLoading ? 'Loading track library' : 'Track library unavailable'} />
          <StatCard label="Videos" value={videosAvailable ? videos.length : '—'} detail={videosAvailable ? `${metrics.liveVideos} live, ${metrics.draftVideos} draft${videosCurrent ? '' : ' · Last known'}` : videosLoading ? 'Loading video library' : 'Video library unavailable'} />
          <StatCard label="Media flags" value={tracksAvailable ? metrics.missingAudio + metrics.missingCovers : '—'} detail={tracksAvailable ? `${metrics.missingAudio} audio, ${metrics.missingCovers} covers missing${tracksCurrent ? '' : ' · Last known'}` : 'Waiting for track library'} />
          <StatCard label="Last full check" value={lastLoadedAt ? <time dateTime={lastLoadedAt.toISOString()}>{formatDate(lastLoadedAt.toISOString())}</time> : 'Not yet'} detail={libraryCurrent ? 'Sign-in and both libraries checked' : tracksLoading || videosLoading || sessionState === 'checking' ? 'Checking connection…' : 'Latest check incomplete'} />
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {[
            { id: 'tracks' as const, label: 'Tracks', icon: Music },
            { id: 'videos' as const, label: 'Videos', icon: Video },
            { id: 'trash' as const, label: 'Trash', icon: Trash2 },
            { id: 'ops' as const, label: 'Ops', icon: LayoutDashboard },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (operation.current) return;
                if (id !== 'tracks') {
                  fullAudition.current?.pause();
                  previewAudition.current?.pause();
                  selectedAudition.current?.pause();
                }
                setActiveTab(id);
              }}
              className={[
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
                activeTab === id
                  ? 'bg-cyan-300 text-slate-950'
                  : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {label}
              {((id === 'tracks' && trackDirty) || (id === 'videos' && videoDirty)) && ' (unsaved)'}
            </button>
          ))}
        </nav>
        {busy && <p role="status" className="mt-4 text-sm text-cyan-200">{busy} Please wait.</p>}

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
                    onClick={async () => { if (await mayDiscard(trackDirty) && !operation.current) resetTrackForm(); }}
                    className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    New track
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Track title" required error={trackErrors.title ?? (conflictingTrack ? TRACK_TITLE_CONFLICT : undefined)}>
                  <TextInput
                    value={trackForm.title}
                    maxLength={200}
                    onChange={(event) => {
                      setTrackForm((form) => ({ ...form, title: event.target.value }));
                      setTrackErrors((current) => { const next = { ...current }; delete next.title; return next; });
                      setTrackSaveError(null);
                    }}
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
                    {!GENRES.includes(trackForm.genre) && <option value={trackForm.genre}>{trackForm.genre}</option>}
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
                <Field label="Mood" error={trackErrors.mood}>
                  <TextInput
                    value={trackForm.mood}
                    onChange={(event) => setTrackForm((form) => ({ ...form, mood: event.target.value }))}
                    placeholder="Moody"
                  />
                </Field>
                <Field label="Spotify URL" error={trackErrors.spotifyUrl}>
                  <TextInput
                    value={trackForm.spotifyUrl}
                    onChange={(event) => setTrackForm((form) => ({ ...form, spotifyUrl: event.target.value }))}
                    placeholder="https://open.spotify.com/..."
                  />
                </Field>
                <Field label="Apple Music URL" error={trackErrors.appleMusicUrl}>
                  <TextInput
                    value={trackForm.appleMusicUrl}
                    onChange={(event) => setTrackForm((form) => ({ ...form, appleMusicUrl: event.target.value }))}
                    placeholder="https://music.apple.com/..."
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Track story / lyrics" error={trackErrors.story}>
                    <TextArea
                      value={trackForm.story}
                      onChange={(event) => setTrackForm((form) => ({ ...form, story: event.target.value }))}
                      placeholder="Notes, lyrics, release story, or context."
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <Field label={editingSlug ? 'Replace audio file' : 'Audio file'} error={trackErrors.audio ?? trackErrors.audioAssetId ?? trackErrors.originalUrl ?? trackErrors.originalName}>
                    <div className="rounded-md border border-dashed border-cyan-300/30 bg-cyan-300/[0.03] p-4">
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <FileAudio className="h-5 w-5 text-cyan-300" />
                        <span>{fileLabel(trackForm.audioFile, editingSlug ? 'Keep current audio unless replaced' : 'MP3 or WAV')}</span>
                      </div>
                      <input
                        key={`audio-${trackFormVersion}`}
                        type="file"
                        accept=".wav,.mp3,audio/*"
                        className="mt-3 block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                        onChange={(event) => {
                          const audioFile = event.target.files?.[0] ?? null;
                          setTrackForm((form) => ({ ...form, audioFile, previewStart: audioFile ? form.previewStart : String(savedAudio?.previewStart ?? 0) }));
                        }}
                      />
                    </div>
                  </Field>
                  <SelectedMediaPreview kind="audio" file={trackForm.audioFile} audioRef={selectedAudition} onAudioPlay={() => playAudition('selected')} />
                </div>
                <div>
                  <Field label={editingSlug ? 'Replace cover art' : 'Cover art'}>
                    <div className="rounded-md border border-dashed border-white/15 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <ImageIcon className="h-5 w-5 text-slate-300" />
                        <span>{fileLabel(trackForm.coverFile, editingSlug ? 'Keep current cover unless replaced' : 'PNG or JPG')}</span>
                      </div>
                      <input
                        key={`cover-${trackFormVersion}`}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="mt-3 block w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                        onChange={(event) => setTrackForm((form) => ({ ...form, coverFile: event.target.files?.[0] ?? null }))}
                      />
                    </div>
                  </Field>
                  <SelectedMediaPreview kind="image" file={trackForm.coverFile} />
                </div>
              </div>

              <div className="mt-5 space-y-4 rounded-md border border-white/10 bg-slate-950/40 p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={trackForm.playbackMode === 'full'}
                    onChange={(event) => setTrackForm((form) => ({ ...form, playbackMode: event.target.checked ? 'full' : 'preview' }))}
                    className="mt-0.5 h-4 w-4 accent-cyan-400"
                  />
                  <span>
                    <span className="block font-semibold">Allow full-song playback</span>
                    <span className="mt-1 block text-xs text-slate-400">Off by default: visitors hear a 45-second preview. Turn on to let visitors play the entire song. Genre does not change this setting.</span>
                  </span>
                </label>
                <Field label="Preview starts at (seconds)" error={trackErrors.previewStart}>
                  <TextInput
                    type="number"
                    min="0"
                    max="7200"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="0"
                    value={trackForm.previewStart}
                    disabled={!canChoosePreviewStart}
                    onChange={(event) => setTrackForm((form) => ({ ...form, previewStart: event.target.value }))}
                  />
                </Field>
                <p className="text-xs text-slate-400">
                  {audioDetailsLoading ? 'Loading the saved preview settings…' : canChoosePreviewStart
                    ? 'The preview begins here and plays for up to 45 seconds. A new clip is prepared when you save; your saved track stays available until then.'
                    : editingTrack?.audioUrl
                      ? 'This track uses older audio. You can still edit its details. Replace its audio to choose a preview start time.'
                      : 'Choose an audio file to set the preview start. Leave it at 0 to start at the beginning.'}
                </p>
                {audioDetailsError && <div role="alert" className="text-sm text-rose-300">
                  {audioDetailsError} Your saved audio is unchanged.
                  <button type="button" onClick={() => {
                    if (editingTrack?.audioAssetId && !operation.current) void readSavedAudio(editingTrack.audioAssetId, audioDetailVersion.current);
                  }} className="ml-2 underline">Reload preview settings</button>
                </div>}
                {editingTrack?.audioAssetId && <div key={editingTrack.audioAssetId} className="space-y-3 border-t border-white/10 pt-4">
                  <p className="text-xs text-slate-400">Listen to the saved audio. Unsaved changes are not included.</p>
                  <label className="block text-sm text-slate-300">Saved preview
                    <audio ref={previewAudition} aria-label="Saved preview" controls preload="none" src={`/api/audio/${encodeURIComponent(editingTrack.slug)}?preview=true`} onPlay={() => playAudition('preview')} className="mt-2 w-full" />
                  </label>
                  <label className="block text-sm text-slate-300">Full song (admin only)
                    <audio ref={fullAudition} aria-label="Full song (admin only)" controls preload="none" src={`/api/audio/${encodeURIComponent(editingTrack.slug)}?full=true`} onPlay={() => playAudition('full')} className="mt-2 w-full" />
                  </label>
                </div>}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <Toggle
                  checked={trackForm.published}
                  onChange={(published) => setTrackForm((form) => ({ ...form, published }))}
                  label={trackForm.published ? editingTrack?.published ? 'Keep live' : 'Review after saving' : 'Save as draft'}
                  help={trackForm.published ? editingTrack?.published ? 'Saved changes update this published song.' : 'Save a draft, then check the preview before publishing.' : 'Hidden from the public library.'}
                />
                <button
                  type="button"
                  onClick={handleTrackSubmit}
                  disabled={submittingTrack || tracksLoading || sessionExpired || !tracksAvailable}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingTrack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {submittingTrack ? 'Saving…' : trackSaveError ? 'Retry save' : editingSlug ? 'Save changes' : 'Add track'}
                </button>
              </div>
              {uploadPhase && <p role="status" className="mt-3 text-sm text-cyan-200">{uploadPhase}</p>}
              {uploadTransfer && <div className="mt-2 text-sm text-cyan-200">
                <p>{uploadTransfer.label}: {uploadTransfer.percentage}%</p>
                <progress aria-label={uploadTransfer.label} aria-valuenow={uploadTransfer.percentage} aria-valuemin={0} aria-valuemax={100} value={uploadTransfer.percentage} max={100} className="mt-1 h-2 w-full accent-cyan-300" />
              </div>}
              {trackDirty && <p className="mt-3 text-sm text-amber-200">Unsaved track changes</p>}
              {trackSaveError && <div role="alert" className="mt-3 text-sm text-rose-300">{trackSaveError} Your edits have been kept.</div>}
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Track library</h2>
                    <p className="mt-1 text-sm text-slate-400">{tracksAvailable ? `${filteredTracks.length} visible of ${tracks.length}${tracksCurrent ? '' : ' · Last known results'}` : 'Track count unavailable'}</p>
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

              <LibraryNotice state={trackState} kind="tracks" onRetry={reloadLibrary} />
              <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {tracksCurrent && filteredTracks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                    {query.trim() ? 'No tracks match that search.' : 'No tracks yet.'}
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
                      <StatusPill tone={hasTrackAudio(track) ? 'neutral' : 'warn'}>{hasTrackAudio(track) ? 'Audio' : 'No audio'}</StatusPill>
                      <StatusPill tone="neutral">{initialPlaybackMode(track) === 'full' ? 'Full song' : '45-sec preview'}</StatusPill>
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
                        disabled={sessionExpired}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25 disabled:opacity-50"
                      >
                        {track.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {track.published ? 'Draft' : 'Review & publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (!operation.current) setConfirm({ kind: 'track', item: track }); }}
                        disabled={sessionExpired}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-300/20 px-2 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Move to Trash
                      </button>
                    </div>
                    <a
                      href={`/upload/preview/${encodeURIComponent(track.slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 underline"
                      aria-label={`Preview saved version of ${track.title} (opens in a new tab)`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview saved version
                    </a>
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
                  <button type="button" onClick={async () => { if (await mayDiscard(videoDirty) && !operation.current) resetVideoForm(); }} className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white">
                    New video
                  </button>
                )}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Video title" required error={videoErrors.title}>
                  <TextInput value={videoForm.title} onChange={(event) => setVideoForm((form) => ({ ...form, title: event.target.value }))} />
                </Field>
                <Field label="Artist" error={videoErrors.artist}>
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
                <Field label="Duration" error={videoErrors.duration}>
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
                  label={videoForm.published ? videos.find((video) => video.id === editingVideoId)?.published ? 'Keep live' : 'Review after saving' : 'Save video as draft'}
                  help={videoForm.published ? videos.find((video) => video.id === editingVideoId)?.published ? 'Saved changes update this published video.' : 'Save a draft, then check the preview before publishing.' : 'Hidden until reviewed and published.'}
                />
                <button
                  type="button"
                  onClick={handleVideoSubmit}
                  disabled={submittingVideo || videosLoading || sessionExpired || !videosAvailable}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-red-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                  {submittingVideo ? 'Saving…' : videoSaveError ? 'Retry save' : editingVideoId ? 'Save changes' : 'Add video'}
                </button>
              </div>
              {videoDirty && <p className="mt-3 text-sm text-amber-200">Unsaved video changes</p>}
              {videoSaveError && <div role="alert" className="mt-3 text-sm text-rose-300">{videoSaveError} Your edits have been kept.</div>}
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Video library</h2>
                  <p className="mt-1 text-sm text-slate-400">{videosAvailable ? `${videos.length} videos${videosCurrent ? '' : ' · Last known results'}` : 'Video count unavailable'}</p>
                </div>
                {videosLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />}
              </div>
              <LibraryNotice state={videoState} kind="videos" onRetry={reloadLibrary} />
              <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {videosCurrent && videos.length === 0 && (
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
                      <button type="button" disabled={sessionExpired} onClick={() => toggleVideoPublish(video)} className="rounded-md border border-white/10 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25 disabled:opacity-50">
                        {video.published ? 'Draft' : 'Review & publish'}
                      </button>
                      <button type="button" disabled={sessionExpired} onClick={() => { if (!operation.current) setConfirm({ kind: 'video', item: video }); }} className="rounded-md border border-rose-300/20 px-2 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50 disabled:opacity-50">Move to Trash</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'trash' && <AdminTrash key={trashRevision} disabled={sessionExpired} onError={reportError} onRestore={handleRestore} />}

        {activeTab === 'ops' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-white">Release readiness</h2>
              <div className="mt-5 space-y-3">
                {[
                  { label: 'All live tracks have audio', ok: tracksCurrent ? tracks.filter((track) => track.published && !hasTrackAudio(track)).length === 0 : null },
                  { label: 'All live tracks have cover art', ok: tracksCurrent ? tracks.filter((track) => track.published && !track.coverUrl).length === 0 : null },
                  { label: 'Admin library is reachable', ok: libraryCurrent },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-white/10 bg-slate-950/50 p-3">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <span className="ml-3 inline-flex items-center gap-2 text-xs">
                      {item.ok ? <CheckCircle aria-hidden="true" className="h-5 w-5 text-emerald-300" /> : <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-300" />}
                      {item.ok === null ? 'Not checked' : item.ok ? 'Checked' : 'Needs attention'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-semibold text-white">Needs attention</h2>
              <div className="mt-5 space-y-3">
                {!tracksCurrent ? <p className="text-sm text-amber-100">Refresh the track library to check for missing media.</p> : tracks.filter((track) => !hasTrackAudio(track) || !track.coverUrl).length === 0 ? (
                  <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-200">
                    No missing track media found.
                  </div>
                ) : (
                  tracks
                    .filter((track) => !hasTrackAudio(track) || !track.coverUrl)
                    .map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => {
                          startEditTrack(track);
                        }}
                        className="flex w-full items-center justify-between rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-left text-sm text-amber-100 transition hover:border-amber-300/40"
                      >
                        <span>
                          <span className="block font-semibold">{track.title}</span>
                          <span className="mt-1 block text-xs text-amber-200/70">
                            {!hasTrackAudio(track) ? 'Missing audio' : 'Audio ok'} · {!track.coverUrl ? 'Missing cover' : 'Cover ok'}
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
      </fieldset>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <ConfirmDialog confirm={confirm} busy={Boolean(busy)} onCancel={() => setConfirm(null)} onConfirm={confirmDelete} />
      {publishingTarget && <PublishingReviewDialog target={publishingTarget} disabled={sessionExpired} onClose={() => { if (!operation.current) setPublishingTarget(null); }} onPublish={publishReviewedItem} onError={reportError} onPlayback={stopEditorPlayback} />}
      {discard.dialog}
    </section>
  );
}
