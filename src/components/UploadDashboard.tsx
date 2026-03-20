'use client';

import { useState, useCallback, useEffect } from 'react';
import { CloudUpload, Upload, CheckCircle, XCircle, Loader2, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PublishedTrack {
  id: string;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number | null;
  mood: string | null;
  story: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  published: boolean;
  createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function NeonInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-2 font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0F172A',
  border: '1px solid #00FFFF',
  boxShadow: 'inset 0 0 5px rgba(0,255,255,0.5)',
  color: 'white',
  borderRadius: 8,
  width: '100%',
  padding: '12px 16px',
  outline: 'none',
  transition: 'box-shadow 0.3s',
};

const GENRES = ['Hip-Hop', 'R&B', 'Electronic', 'Lo-Fi', 'Pop', 'Trap', 'Afrobeat', 'Other'];
const ADMIN_SECRET = 'monstajam-admin-2024';

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ type, message, onDismiss }: { type: 'success' | 'error'; message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed bottom-24 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl text-white text-sm font-medium shadow-2xl"
      style={{
        background: type === 'success' ? 'rgba(0,30,15,0.95)' : 'rgba(30,0,15,0.95)',
        border: `1px solid ${type === 'success' ? '#00FFCF' : '#FF007F'}`,
        boxShadow: `0 0 20px ${type === 'success' ? 'rgba(0,255,207,0.4)' : 'rgba(255,0,127,0.4)'}`,
      }}
    >
      {type === 'success'
        ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        : <XCircle className="w-5 h-5 text-pink-500 flex-shrink-0" />}
      {message}
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ track, onConfirm, onCancel }: { track: PublishedTrack; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div
        className="rounded-xl p-8 max-w-sm w-full mx-4 text-center"
        style={{ background: '#12123A', border: '1px solid #FF007F', boxShadow: '0 0 30px rgba(255,0,127,0.4)' }}
      >
        <Trash2 className="w-10 h-10 mx-auto mb-4 text-pink-500" />
        <h3 className="text-xl font-bold mb-2 text-white">Delete Track?</h3>
        <p className="text-gray-400 text-sm mb-6">
          <span style={{ color: '#00FFFF' }}>&quot;{track.title}&quot;</span> will be permanently removed from the database.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg font-semibold text-sm text-gray-300 transition-colors hover:text-white"
            style={{ border: '1px solid #334155', background: 'transparent' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg font-bold text-sm text-white transition-all hover:scale-105"
            style={{ background: '#FF007F', boxShadow: '0 0 12px rgba(255,0,127,0.5)' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UploadDashboard() {
  // Edit mode
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  // Form state
  const [title, setTitle]         = useState('');
  const [artist, setArtist]       = useState('Monsta Jam');
  const [genre, setGenre]         = useState('Hip-Hop');
  const [bpm, setBpm]             = useState('');
  const [mood, setMood]           = useState('');
  const [story, setStory]         = useState('');
  const [ytLink, setYtLink]       = useState('');
  const [spotifyLink, setSpotify] = useState('');
  const [appleLink, setApple]     = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioDrag, setAudioDrag] = useState(false);
  const [publishNow, setPublish]  = useState(false);

  // UI state
  const [submitting, setSubmitting]   = useState(false);
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [tracks, setTracks]           = useState<PublishedTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<PublishedTrack | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => setToast({ type, msg });

  // Load tracks
  const loadTracks = useCallback(async () => {
    try {
      setTracksLoading(true);
      const res = await fetch('/api/tracks?all=true');
      if (res.ok) setTracks(await res.json());
    } catch { /* silent */ } finally {
      setTracksLoading(false);
    }
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  // Reset form
  const resetForm = () => {
    setEditingSlug(null);
    setTitle(''); setArtist('Monsta Jam'); setGenre('Hip-Hop');
    setBpm(''); setMood(''); setStory(''); setYtLink('');
    setSpotify(''); setApple(''); setAudioFile(null); setCoverFile(null);
    setPublish(false);
  };

  // Load track into form for editing
  const startEdit = (track: PublishedTrack) => {
    setEditingSlug(track.slug);
    setTitle(track.title);
    setArtist(track.artist);
    setGenre(track.genre);
    setBpm(track.bpm ? String(track.bpm) : '');
    setMood(track.mood || '');
    setStory(track.story || '');
    setYtLink('');
    setSpotify(track.spotifyUrl || '');
    setApple(track.appleMusicUrl || '');
    setAudioFile(null); setCoverFile(null);
    setPublish(track.published);
    // Scroll form into view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // File drop
  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setAudioDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.wav') || f.name.endsWith('.mp3'))) setAudioFile(f);
  }, []);

  // Upload file to Supabase
  async function uploadFile(file: File, bucket: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file); fd.append('bucket', bucket);
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'x-admin-secret': ADMIN_SECRET }, body: fd });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Upload failed'); }
    return (await res.json()).url;
  }

  // Submit (create or update)
  const handleSubmit = async () => {
    if (!title.trim()) { showToast('error', 'Track title is required.'); return; }

    setSubmitting(true);
    try {
      let audioUrl: string | undefined;
      let coverUrl: string | undefined;
      if (audioFile) audioUrl = await uploadFile(audioFile, 'audio');
      if (coverFile) coverUrl = await uploadFile(coverFile, 'covers');

      const payload: Record<string, unknown> = {
        title: title.trim(),
        artist: artist.trim() || 'Monsta Jam',
        genre,
        bpm: bpm ? parseInt(bpm) : undefined,
        mood: mood.trim() || undefined,
        color: '#00ffff',
        story: story.trim() || undefined,
        spotifyUrl: spotifyLink.trim() || undefined,
        appleMusicUrl: appleLink.trim() || undefined,
        published: publishNow,
      };
      if (audioUrl) payload.audioUrl = audioUrl;
      if (coverUrl) payload.coverUrl = coverUrl;

      if (editingSlug) {
        // UPDATE
        const res = await fetch(`/api/tracks/${editingSlug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Update failed'); }
        showToast('success', `"${title}" updated ✓`);
      } else {
        // CREATE
        const nextNum = tracks.length + 1;
        const res = await fetch('/api/tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
          body: JSON.stringify({ ...payload, slug: slugify(title), number: nextNum }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to create track'); }
        showToast('success', `"${title}" is ${publishNow ? 'live 🔥' : 'saved as draft'}.`);
      }

      resetForm();
      await loadTracks();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle publish
  const togglePublish = async (track: PublishedTrack) => {
    try {
      const res = await fetch(`/api/tracks/${track.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
        body: JSON.stringify({ published: !track.published }),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('success', `"${track.title}" ${!track.published ? 'published 🔥' : 'set to draft'}.`);
      await loadTracks();
    } catch {
      showToast('error', 'Failed to toggle publish status.');
    }
  };

  // Delete
  const handleDelete = async (track: PublishedTrack) => {
    try {
      const res = await fetch(`/api/tracks/${track.slug}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': ADMIN_SECRET },
      });
      if (!res.ok) throw new Error('Delete failed');
      showToast('success', `"${track.title}" deleted.`);
      if (editingSlug === track.slug) resetForm();
      await loadTracks();
    } catch {
      showToast('error', 'Failed to delete track.');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div
      className="min-h-screen w-full overflow-hidden p-6 font-sans antialiased text-white flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}
    >
      {/* ── Header ── */}
      <header
        className="flex justify-between items-center mb-8 pb-4"
        style={{ borderBottom: '1px solid #FF007F', boxShadow: '0 4px 15px -3px rgba(255,0,127,0.3)' }}
      >
        <h1 className="text-2xl md:text-3xl tracking-wider uppercase font-bold">
          <span style={{ color: '#FF007F', textShadow: '0 0 10px #FF007F' }}>Private Admin </span>
          <span style={{ color: '#00FFFF', textShadow: '0 0 10px #00FFFF' }}>Backstage </span>
          <span style={{ color: '#FF007F', textShadow: '0 0 10px #FF007F' }}>v2</span>
        </h1>
        <div className="flex items-center gap-3">
          {editingSlug && (
            <button
              onClick={resetForm}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-gray-300 hover:text-white transition-colors"
              style={{ border: '1px solid #334155' }}
            >
              + New Track
            </button>
          )}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ border: '2px solid #00FFFF', boxShadow: '0 0 10px rgba(0,255,255,0.5)', background: 'linear-gradient(135deg, #00FFFF33, #FF007F33)' }}
          >
            AK
          </div>
        </div>
      </header>

      {/* ── Two-panel layout ── */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1" style={{ minHeight: 'calc(100vh - 140px)' }}>

        {/* LEFT: Form */}
        <section
          className="lg:col-span-2 rounded-xl p-6 flex flex-col overflow-y-auto"
          style={{
            backgroundColor: '#12123A',
            border: `1px solid ${editingSlug ? '#FF007F' : '#00FFFF'}`,
            boxShadow: editingSlug
              ? '0 0 10px rgba(255,0,127,0.5), 0 0 20px rgba(255,0,127,0.3)'
              : '0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.3)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#00FFFF transparent',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
        >
          <h2
            className="text-2xl font-bold mb-1"
            style={{ color: editingSlug ? '#FF007F' : '#00FFFF', textShadow: editingSlug ? '0 0 10px #FF007F' : '0 0 10px #00FFFF' }}
          >
            {editingSlug ? '✏️ Edit Track' : 'Drop New Heat'}
          </h2>
          {editingSlug && (
            <p className="text-xs text-gray-500 mb-5">Editing: <span style={{ color: '#00FFFF' }}>{editingSlug}</span></p>
          )}
          {!editingSlug && <div className="mb-6" />}

          <div className="flex flex-col gap-5 flex-grow">

            {/* Title + Artist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <NeonInput label="Track Title *">
                <input value={title} onChange={(e) => setTitle(e.target.value)} type="text" placeholder="e.g. Midnight City" style={inputStyle} />
              </NeonInput>
              <NeonInput label="Artist Name">
                <input value={artist} onChange={(e) => setArtist(e.target.value)} type="text" placeholder="Monsta Jam" style={inputStyle} />
              </NeonInput>
            </div>

            {/* Genre + BPM + Mood */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <NeonInput label="Genre">
                <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </NeonInput>
              <NeonInput label="BPM">
                <input value={bpm} onChange={(e) => setBpm(e.target.value)} type="number" placeholder="e.g. 140" style={inputStyle} />
              </NeonInput>
              <NeonInput label="Mood">
                <input value={mood} onChange={(e) => setMood(e.target.value)} type="text" placeholder="e.g. Dark, Hyped" style={inputStyle} />
              </NeonInput>
            </div>

            {/* Audio upload */}
            <NeonInput label={editingSlug ? 'Replace Audio File (optional)' : 'Audio File (WAV, MP3)'}>
              <label
                onDragOver={(e) => { e.preventDefault(); setAudioDrag(true); }}
                onDragLeave={() => setAudioDrag(false)}
                onDrop={handleAudioDrop}
                className="flex justify-center items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-slate-800 group"
                style={{ ...inputStyle, padding: '16px', background: audioDrag ? 'rgba(0,255,255,0.05)' : '#0F172A' }}
              >
                <input type="file" accept=".wav,.mp3" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAudioFile(f); }} />
                <CloudUpload className="w-5 h-5" style={{ color: '#00FFFF' }} />
                {audioFile
                  ? <span className="text-white text-sm">{audioFile.name}</span>
                  : <span className="text-gray-300 text-sm group-hover:text-white">Drag &amp; Drop or <span style={{ color: '#00FFFF' }}>Browse</span></span>}
              </label>
            </NeonInput>

            {/* Cover art */}
            <NeonInput label={editingSlug ? 'Replace Cover Art (optional)' : 'Cover Art (JPEG, PNG)'}>
              <label className="flex justify-center items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-slate-800" style={{ ...inputStyle, padding: '16px' }}>
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCoverFile(f); }} />
                <Upload className="w-5 h-5 text-gray-400" />
                {coverFile
                  ? <span className="text-white text-sm">{coverFile.name}</span>
                  : <span className="text-gray-400 text-sm">Browse image</span>}
              </label>
            </NeonInput>

            {/* Story */}
            <NeonInput label="Track Story / Lyrics">
              <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="Type your story or lyrics here..." rows={4} className="placeholder-gray-500 resize-none" style={{ ...inputStyle, minHeight: 100 }} />
            </NeonInput>

            {/* YouTube */}
            <NeonInput label="YouTube Link">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5" fill="#00FFFF" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </div>
                <input value={ytLink} onChange={(e) => setYtLink(e.target.value)} type="text" placeholder="https://youtube.com/watch?v=..." className="placeholder-gray-600" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </NeonInput>

            {/* Streaming links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <NeonInput label="Spotify Link">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4" fill="#00FFFF" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.48-3.48C15.12 7.02 8.76 6.84 5.1 7.92c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.2 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.24.54-.9.72-1.5.42z"/></svg>
                  </div>
                  <input value={spotifyLink} onChange={(e) => setSpotify(e.target.value)} type="text" placeholder="https://open.spotify.com/..." className="placeholder-gray-600" style={{ ...inputStyle, paddingLeft: 36 }} />
                </div>
              </NeonInput>
              <NeonInput label="Apple Music Link">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4" fill="#00FFFF" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  </div>
                  <input value={appleLink} onChange={(e) => setApple(e.target.value)} type="text" placeholder="https://music.apple.com/..." className="placeholder-gray-600" style={{ ...inputStyle, paddingLeft: 36 }} />
                </div>
              </NeonInput>
            </div>

            {/* Publish toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setPublish(!publishNow)}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{ backgroundColor: publishNow ? '#FF007F' : '#1e293b', boxShadow: publishNow ? '0 0 10px rgba(255,0,127,0.6)' : 'none' }}
              >
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: publishNow ? 'translateX(28px)' : 'translateX(4px)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: publishNow ? '#FF007F' : '#94a3b8' }}>
                {publishNow ? 'Publish immediately 🔥' : 'Save as draft'}
              </span>
            </label>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-lg py-4 font-bold tracking-widest uppercase text-lg mt-2 text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              style={{ backgroundColor: '#FF007F', boxShadow: '0 0 15px rgba(255,0,127,0.6)' }}
              onMouseEnter={(e) => !submitting && (e.currentTarget.style.boxShadow = '0 0 25px rgba(255,0,127,0.8)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 0 15px rgba(255,0,127,0.6)')}
            >
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> {editingSlug ? 'Saving...' : 'Uploading...'}</>
                : editingSlug
                  ? '💾 Save Changes'
                  : publishNow ? '🔥 Go Live' : 'Save Draft'}
            </button>

          </div>
        </section>

        {/* RIGHT: Track Manager */}
        <section
          className="rounded-xl p-6 flex flex-col"
          style={{
            backgroundColor: '#12123A',
            border: '1px solid #FF007F',
            boxShadow: '0 0 10px rgba(255,0,127,0.5), 0 0 20px rgba(255,0,127,0.3)',
            maxHeight: 'calc(100vh - 160px)',
          }}
        >
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold" style={{ color: '#FF007F', textShadow: '0 0 10px #FF007F' }}>
              Tracks
            </h2>
            {!tracksLoading && (
              <span className="text-xs text-gray-500 font-mono">{tracks.length} total</span>
            )}
          </div>

          <div className="flex-grow overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#00FFFF transparent' }}>
            {tracksLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-gray-500 text-sm text-center mt-8">No tracks yet. Drop the first heat 🔥</div>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.id}
                  className="rounded-lg p-3 transition-all"
                  style={{
                    border: `1px solid ${editingSlug === track.slug ? '#FF007F' : track.published ? '#1e3a2e' : '#1e293b'}`,
                    backgroundColor: editingSlug === track.slug ? 'rgba(255,0,127,0.08)' : 'rgba(0,0,0,0.2)',
                    boxShadow: editingSlug === track.slug ? '0 0 12px rgba(255,0,127,0.2)' : 'none',
                  }}
                >
                  {/* Track info */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate" style={{ color: '#00FFFF' }}>
                        {track.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{track.genre}{track.bpm ? ` · ${track.bpm} BPM` : ''}</p>
                    </div>
                    <span
                      className="text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded"
                      style={{
                        background: track.published ? 'rgba(0,255,100,0.1)' : 'rgba(255,255,255,0.05)',
                        color: track.published ? '#4ade80' : '#64748b',
                        border: `1px solid ${track.published ? 'rgba(0,255,100,0.2)' : '#1e293b'}`,
                      }}
                    >
                      {track.published ? 'LIVE' : 'DRAFT'}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(track)}
                      title="Edit"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-semibold transition-all hover:scale-105"
                      style={{ background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.2)', color: '#00FFFF' }}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => togglePublish(track)}
                      title={track.published ? 'Unpublish' : 'Publish'}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-semibold transition-all hover:scale-105"
                      style={{
                        background: track.published ? 'rgba(255,200,0,0.1)' : 'rgba(255,0,127,0.1)',
                        border: `1px solid ${track.published ? 'rgba(255,200,0,0.2)' : 'rgba(255,0,127,0.2)'}`,
                        color: track.published ? '#fbbf24' : '#FF007F',
                      }}
                    >
                      {track.published ? <><EyeOff className="w-3 h-3" /> Unpublish</> : <><Eye className="w-3 h-3" /> Publish</>}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(track)}
                      title="Delete"
                      className="p-1.5 rounded transition-all hover:scale-105"
                      style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.2)', color: '#f87171' }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          track={confirmDelete}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.msg} onDismiss={() => setToast(null)} />}
    </div>
  );
}
