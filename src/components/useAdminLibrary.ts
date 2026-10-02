'use client';

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { AdminSaveError, adminFetch } from '@/lib/admin-save';
import type { AdminIdentity } from '@/lib/admin-account-client';

export type LibraryState = {
  status: 'loading' | 'ready' | 'error';
  lastSuccessAt: Date | null;
  error: null | { kind: 'auth' | 'connection'; message: string };
};
export type SessionState = 'checking' | 'ready' | 'expired' | 'error';
type LibraryKind = 'tracks' | 'videos';
const SESSION_EXPIRED = 'Your session expired. Your edits are still here. Sign in in a new tab, then recheck access.';
const initialState = (): LibraryState => ({ status: 'loading', lastSuccessAt: null, error: null });

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function nullableText(value: unknown) { return value == null || typeof value === 'string'; }
function nullableDate(value: unknown) { return value == null || (text(value) && Number.isFinite(new Date(value).getTime())); }
function numeric(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

function validRows(value: unknown, kind: LibraryKind): value is Record<string, unknown>[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((row) => {
    if (!record(row) || !text(row.id) || ids.has(row.id) || typeof row.title !== 'string' || typeof row.published !== 'boolean') return false;
    ids.add(row.id);
    if (!nullableDate(row.createdAt) || !nullableDate(row.updatedAt)) return false;
    if (kind === 'videos') return text(row.youtubeId) && typeof row.youtubeUrl === 'string' && numeric(row.order) && nullableText(row.artist) && nullableText(row.duration);
    return text(row.slug) && typeof row.artist === 'string' && typeof row.genre === 'string' && numeric(row.number) &&
      (row.bpm == null || numeric(row.bpm)) &&
      ['mood', 'story', 'spotifyUrl', 'appleMusicUrl', 'audioUrl', 'audioAssetId', 'coverUrl'].every((field) => nullableText(row[field])) &&
      (row.playbackMode == null || row.playbackMode === 'preview' || row.playbackMode === 'full');
  });
}

async function requestJSON(path: string): Promise<unknown> {
  const response = await adminFetch(path, { credentials: 'include', cache: 'no-store' });
  if (response.status === 401) throw new AdminSaveError(SESSION_EXPIRED, {}, 401);
  if (!response.ok) throw new AdminSaveError('The request could not be completed. Please retry.', {}, response.status);
  return response.json();
}

async function requestRows(kind: LibraryKind) {
  const rows = await requestJSON(`/api/${kind}?all=true`);
  if (!validRows(rows, kind)) throw new Error('The library response was incomplete.');
  return rows;
}

async function requestIdentity(): Promise<AdminIdentity> {
  const data = await requestJSON('/api/auth/get-session');
  if (data === null || (record(data) && (data.session === null || data.user === null))) throw new AdminSaveError(SESSION_EXPIRED, {}, 401);
  if (!record(data) || !record(data.user) || !record(data.session)) throw new Error('The session response was incomplete.');
  const user = data.user;
  if (user.accessStatus !== 'active' || user.authLocked === true || user.banned === true || (user.role !== 'owner' && user.role !== 'admin')) {
    throw new AdminSaveError(SESSION_EXPIRED, {}, 401);
  }
  if (!text(user.id) || !text(user.name) || !text(user.username) || typeof data.session.expiresAt !== 'string') throw new Error('The session response was incomplete.');
  const expiry = new Date(data.session.expiresAt).getTime();
  if (!Number.isFinite(expiry)) throw new Error('The session expiry was invalid.');
  if (expiry <= Date.now() || (data.session.userId != null && data.session.userId !== user.id)) throw new AdminSaveError(SESSION_EXPIRED, {}, 401);
  return { id: user.id, name: user.name, username: user.username, role: user.role };
}

function connectionError(kind: LibraryKind): LibraryState['error'] {
  return { kind: 'connection', message: `${kind === 'tracks' ? 'Track' : 'Video'} library could not be refreshed. Please retry.` };
}

export function useAdminLibrary<Track, Video>(initialAdmin: AdminIdentity) {
  const [tracks, setTrackRows] = useState<Track[]>([]);
  const [videos, setVideoRows] = useState<Video[]>([]);
  const [trackState, setTrackState] = useState<LibraryState>(initialState);
  const [videoState, setVideoState] = useState<LibraryState>(initialState);
  const [identity, setIdentity] = useState<AdminIdentity | null>(initialAdmin);
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const trackVersion = useRef(0);
  const videoVersion = useRef(0);
  const reloadVersion = useRef(0);
  const authExpired = useRef(false);
  const trackStatus = useRef(trackState);
  const videoStatus = useRef(videoState);

  const updateStatus = useCallback((kind: LibraryKind, update: (state: LibraryState) => LibraryState) => {
    if (!mounted.current) return;
    const reference = kind === 'tracks' ? trackStatus : videoStatus;
    reference.current = update(reference.current);
    (kind === 'tracks' ? setTrackState : setVideoState)(reference.current);
  }, []);

  const reportError = useCallback((error: unknown) => {
    if (!mounted.current || !(error instanceof AdminSaveError) || error.status !== 401) return;
    authExpired.current = true;
    ++reloadVersion.current;
    ++trackVersion.current;
    ++videoVersion.current;
    setIdentity(null);
    setSessionState('expired');
    for (const kind of ['tracks', 'videos'] as const) updateStatus(kind, (previous) => ({ ...previous, status: 'error', error: { kind: 'auth', message: SESSION_EXPIRED } }));
  }, [updateStatus]);

  const loadLibrary = useCallback(async (kind: LibraryKind): Promise<boolean> => {
    if (!mounted.current || authExpired.current) return false;
    const reference = kind === 'tracks' ? trackVersion : videoVersion;
    const version = ++reference.current;
    const lifetime = lifecycle.current;
    const current = () => mounted.current && lifecycle.current === lifetime && reference.current === version;
    updateStatus(kind, (previous) => ({ ...previous, status: 'loading' }));
    try {
      const rows = await requestRows(kind);
      if (!current() || authExpired.current) return false;
      if (kind === 'tracks') setTrackRows(rows as Track[]);
      else setVideoRows(rows as Video[]);
      updateStatus(kind, () => ({ status: 'ready', lastSuccessAt: new Date(), error: null }));
      return true;
    } catch (error) {
      if (!current()) return false;
      if (error instanceof AdminSaveError && error.status === 401) reportError(error);
      else updateStatus(kind, (previous) => ({ ...previous, status: 'error', error: connectionError(kind) }));
      return false;
    }
  }, [reportError, updateStatus]);

  const loadTracks = useCallback(() => loadLibrary('tracks'), [loadLibrary]);
  const loadVideos = useCallback(() => loadLibrary('videos'), [loadLibrary]);

  const reload = useCallback(async (): Promise<void> => {
    if (!mounted.current) return;
    const version = ++reloadVersion.current;
    const lifetime = lifecycle.current;
    const tracksRequest = ++trackVersion.current;
    const videosRequest = ++videoVersion.current;
    const current = () => mounted.current && lifecycle.current === lifetime && reloadVersion.current === version;
    setIdentity(null);
    setSessionState('checking');
    updateStatus('tracks', (previous) => ({ ...previous, status: 'loading' }));
    updateStatus('videos', (previous) => ({ ...previous, status: 'loading' }));
    const watch = <T,>(promise: Promise<T>, requestCurrent: () => boolean = current) => promise.catch((error: unknown) => {
      if (current() && requestCurrent() && error instanceof AdminSaveError && error.status === 401) reportError(error);
      throw error;
    });
    const [session, nextTracks, nextVideos] = await Promise.allSettled([
      watch(requestIdentity()),
      watch(requestRows('tracks'), () => trackVersion.current === tracksRequest),
      watch(requestRows('videos'), () => videoVersion.current === videosRequest),
    ]);
    // A newer reload, mutation, unmount or401 cannot be undone by this result.
    if (!current()) return;
    const sessionConfirmed = session.status === 'fulfilled';
    if (sessionConfirmed) {
      authExpired.current = false;
      setIdentity(session.value);
      setSessionState('ready');
    } else {
      setIdentity(null);
      setSessionState(authExpired.current ? 'expired' : 'error');
    }
    const tracksCurrent = trackVersion.current === tracksRequest;
    const videosCurrent = videoVersion.current === videosRequest;
    for (const [kind, result, isCurrent] of [
      ['tracks', nextTracks, tracksCurrent], ['videos', nextVideos, videosCurrent],
    ] as const) {
      if (!isCurrent) continue;
      if (authExpired.current) {
        updateStatus(kind, (previous) => ({ ...previous, status: 'error', error: { kind: 'auth', message: SESSION_EXPIRED } }));
      } else if (result.status === 'fulfilled') {
        if (kind === 'tracks') setTrackRows(result.value as Track[]);
        else setVideoRows(result.value as Video[]);
        updateStatus(kind, () => ({ status: 'ready', lastSuccessAt: new Date(), error: null }));
      } else updateStatus(kind, (previous) => ({ ...previous, status: 'error', error: connectionError(kind) }));
    }
    if (sessionConfirmed && tracksCurrent && videosCurrent && nextTracks.status === 'fulfilled' && nextVideos.status === 'fulfilled') setLastLoadedAt(new Date());
  }, [reportError, updateStatus]);

  const finishMutation = useCallback((kind: LibraryKind) => {
    updateStatus(kind, (previous) => ({
      ...previous, status: previous.error || !previous.lastSuccessAt ? 'error' : 'ready',
      error: previous.error ?? (previous.lastSuccessAt ? null : { kind: 'connection', message: `Reload the ${kind === 'tracks' ? 'track' : 'video'} library to confirm its full contents.` }),
    }));
  }, [updateStatus]);
  const setTracks = useCallback((value: SetStateAction<Track[]>) => {
    if (!mounted.current) return;
    ++trackVersion.current;
    setTrackRows(value);
    finishMutation('tracks');
  }, [finishMutation]);
  const setVideos = useCallback((value: SetStateAction<Video[]>) => {
    if (!mounted.current) return;
    ++videoVersion.current;
    setVideoRows(value);
    finishMutation('videos');
  }, [finishMutation]);

  useEffect(() => {
    mounted.current = true;
    const lifetime = ++lifecycle.current;
    const counters = [lifecycle, reloadVersion, trackVersion, videoVersion];
    // Start network synchronization after mount; Strict Mode's discarded mount
    // must not start a duplicate request or update the replacement mount.
    queueMicrotask(() => {
      if (mounted.current && lifecycle.current === lifetime) void reload();
    });
    return () => {
      mounted.current = false;
      for (const counter of counters) ++counter.current;
    };
  }, [reload, initialAdmin.id, initialAdmin.username, initialAdmin.role]);

  return { tracks, videos, setTracks, setVideos, trackState, videoState, loadTracks, loadVideos, reload, lastLoadedAt, identity, sessionState, reportError };
}
