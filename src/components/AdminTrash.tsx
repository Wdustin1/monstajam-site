'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminSaveError, adminFetch, readAdminResponse } from '@/lib/admin-save';

export type TrashKind = 'tracks' | 'videos';
export type TrashItem = {
  id: string;
  slug?: string;
  title: string;
  artist?: string | null;
  deletedAt: string;
  deletedBy?: string | null;
};
type TrashItems = Record<TrashKind, TrashItem[]>;

function validItems(value: unknown): value is TrashItems {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (['tracks', 'videos'] as const).every((kind) => {
    const rows = data[kind];
    if (!Array.isArray(rows)) return false;
    const ids = new Set<string>();
    return rows.every((row) => {
      if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id) ||
        typeof row.title !== 'string' || typeof row.deletedAt !== 'string' || !Number.isFinite(new Date(row.deletedAt).getTime()) ||
        (row.artist != null && typeof row.artist !== 'string') || (row.deletedBy != null && typeof row.deletedBy !== 'string') ||
        (kind === 'tracks' && (typeof row.slug !== 'string' || !row.slug))) return false;
      ids.add(row.id);
      return true;
    });
  });
}

export default function AdminTrash({ disabled, onError, onRestore }: {
  disabled: boolean;
  onError: (error: unknown) => void;
  onRestore: (kind: TrashKind, item: TrashItem) => Promise<boolean>;
}) {
  const [items, setItems] = useState<TrashItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const mounted = useRef(false);
  const version = useRef(0);

  const load = useCallback(async () => {
    if (!mounted.current) return;
    const requestVersion = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const result = await readAdminResponse<unknown>(await adminFetch('/api/admin/trash', { credentials: 'include', cache: 'no-store' }));
      if (!validItems(result)) throw new Error('Incomplete Trash response');
      if (mounted.current && requestVersion === version.current) setItems(result);
    } catch (cause) {
      if (!mounted.current || requestVersion !== version.current) return;
      onError(cause);
      setError(cause instanceof AdminSaveError && cause.status === 401
        ? 'Your sign-in expired. Sign in above, then retry Trash.'
        : 'Trash could not be loaded. Your saved items have not been changed.');
    } finally {
      if (mounted.current && requestVersion === version.current) setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    mounted.current = true;
    const lifetime = ++version.current;
    queueMicrotask(() => { if (mounted.current && version.current === lifetime) void load(); });
    return () => { mounted.current = false; };
  }, [load]);

  async function restore(kind: TrashKind, item: TrashItem) {
    if (restoring || loading || error || disabled) return;
    setRestoring(`${kind}:${item.id}`);
    try {
      if (await onRestore(kind, item) && mounted.current) {
        ++version.current;
        setItems((previous) => previous && { ...previous, [kind]: previous[kind].filter((row) => row.id !== item.id) });
      }
    } finally { if (mounted.current) setRestoring(null); }
  }

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-5" aria-label="Trash">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Trash</h2>
          <p className="mt-2 text-sm text-slate-400">Trashed songs and videos are hidden from the website. Their saved details and files are kept here until you restore them.</p>
          <p className="mt-1 text-sm text-slate-400">Restored items return as drafts. Review them in Tracks or Videos before publishing.</p>
        </div>
        <button type="button" onClick={load} disabled={loading || Boolean(restoring)} className="rounded-md border border-white/20 px-3 py-2 text-sm disabled:opacity-50">Refresh Trash</button>
      </div>
      {loading && <p role="status" className="mt-4 text-sm text-slate-400">Loading Trash…</p>}
      {error && <div role="alert" className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
        <p>{error}</p>
        {items && <p className="mt-1">Showing previously loaded items. Refresh before restoring.</p>}
        <button type="button" onClick={load} className="mt-2 underline">Retry Trash</button>
      </div>}
      {!loading && !error && items && items.tracks.length + items.videos.length === 0 && <p className="mt-6 text-sm text-slate-400">Trash is empty.</p>}
      {items && (['tracks', 'videos'] as const).map((kind) => items[kind].length > 0 && <div key={kind} className="mt-5">
        <h3 className="text-sm font-semibold text-slate-300">{kind === 'tracks' ? 'Tracks in Trash' : 'Videos in Trash'}</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {items[kind].map((item) => <article key={item.id} className="rounded-md border border-white/10 bg-slate-950/50 p-4">
            <h3 className="font-semibold text-white">{item.title}</h3>
            {item.artist && <p className="mt-1 text-sm text-slate-400">{item.artist}</p>}
            <p className="mt-2 text-xs text-slate-400">Moved to Trash <time dateTime={item.deletedAt}>{new Date(item.deletedAt).toLocaleString()}</time>{item.deletedBy ? ` by ${item.deletedBy}` : ''}.</p>
            <button type="button" onClick={() => restore(kind, item)} disabled={disabled || loading || Boolean(error) || Boolean(restoring)} className="mt-3 rounded-md border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50">
              {restoring === `${kind}:${item.id}` ? 'Restoring…' : 'Restore as draft'}
            </button>
          </article>)}
        </div>
      </div>)}
    </section>
  );
}
