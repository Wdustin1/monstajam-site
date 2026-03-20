'use client';

import { useState, useCallback, useEffect } from 'react';
import { CloudUpload, Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PublishedTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  published: boolean;
  createdAt: string;
  slug: string;
}

// ─── Neon input wrapper ────────────────────────────────────────────────────────

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
        : <XCircle className="w-5 h-5 text-pink-500 flex-shrink-0" />
      }
      {message}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UploadDashboard() {
  // Form state
  const [title, setTitle]           = useState('');
  const [artist, setArtist]         = useState('Monsta Jam');
  const [genre, setGenre]           = useState('Hip-Hop');
  const [bpm, setBpm]               = useState('');
  const [mood, setMood]             = useState('');
  const [story, setStory]           = useState('');
  const [ytLink, setYtLink]         = useState('');
  const [spotifyLink, setSpotify]   = useState('');
  const [appleLink, setApple]       = useState('');
  const [audioFile, setAudioFile]   = useState<File | null>(null);
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [audioDrag, setAudioDrag]   = useState(false);
  const [publishNow, setPublishNow] = useState(false);

  // UI state
  const [submitting, setSubmitting]       = useState(false);
  const [toast, setToast]                 = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [tracks, setTracks]               = useState<PublishedTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);

  // Load published tracks
  const loadTracks = useCallback(async () => {
    try {
      setTracksLoading(true);
      const res = await fetch('/api/tracks?all=true');
      if (res.ok) {
        const data = await res.json();
        setTracks(data);
      }
    } catch {
      // silently fail — not critical
    } finally {
      setTracksLoading(false);
    }
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  // File handlers
  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setAudioDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.wav') || f.name.endsWith('.mp3'))) setAudioFile(f);
  }, []);

  // Upload file to Supabase via our API
  async function uploadFile(file: File, bucket: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bucket', bucket);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'x-admin-secret': ADMIN_SECRET },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    const { url } = await res.json();
    return url;
  }

  // Submit handler
  const handleSubmit = async () => {
    if (!title.trim()) {
      setToast({ type: 'error', msg: 'Track title is required.' });
      return;
    }

    setSubmitting(true);
    try {
      // Upload files if provided
      let audioUrl: string | undefined;
      let coverUrl: string | undefined;

      if (audioFile) audioUrl = await uploadFile(audioFile, 'audio');
      if (coverFile) coverUrl = await uploadFile(coverFile, 'covers');

      // Build track payload
      const nextNumber = tracks.length > 0 ? Math.max(...tracks.map(t => 0)) + tracks.length + 1 : 1;
      const payload = {
        slug: slugify(title),
        number: nextNumber,
        title: title.trim(),
        artist: artist.trim() || 'Monsta Jam',
        genre,
        bpm: bpm ? parseInt(bpm) : undefined,
        mood: mood.trim() || undefined,
        color: '#00ffff',
        story: story.trim() || undefined,
        audioUrl: audioUrl || undefined,
        coverUrl: coverUrl || undefined,
        spotifyUrl: spotifyLink.trim() || undefined,
        appleMusicUrl: appleLink.trim() || undefined,
        ytLink: ytLink.trim() || undefined,
        published: publishNow,
      };

      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create track');
      }

      setToast({ type: 'success', msg: `"${title}" is ${publishNow ? 'live 🔥' : 'saved as draft'}.` });

      // Reset form
      setTitle(''); setArtist('Monsta Jam'); setGenre('Hip-Hop');
      setBpm(''); setMood(''); setStory(''); setYtLink('');
      setSpotify(''); setApple(''); setAudioFile(null); setCoverFile(null);
      setPublishNow(false);

      // Refresh track list
      await loadTracks();

    } catch (err) {
      setToast({ type: 'error', msg: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSubmitting(false);
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
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ border: '2px solid #00FFFF', boxShadow: '0 0 10px rgba(0,255,255,0.5)', background: 'linear-gradient(135deg, #00FFFF33, #FF007F33)' }}
        >
          AK
        </div>
      </header>

      {/* ── Two-panel layout ── */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1" style={{ height: 'calc(100vh - 120px)' }}>

        {/* LEFT: Drop New Heat */}
        <section
          className="lg:col-span-2 rounded-xl p-6 flex flex-col overflow-y-auto"
          style={{
            backgroundColor: '#12123A',
            border: '1px solid #00FFFF',
            boxShadow: '0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.3)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#00FFFF transparent',
          }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: '#00FFFF', textShadow: '0 0 10px #00FFFF' }}>
            Drop New Heat
          </h2>

          <div className="flex flex-col gap-5 flex-grow">

            {/* Title + Artist row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <NeonInput label="Track Title *">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="e.g. Midnight City"
                  style={inputStyle}
                />
              </NeonInput>
              <NeonInput label="Artist Name">
                <input
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  type="text"
                  placeholder="Monsta Jam"
                  style={inputStyle}
                />
              </NeonInput>
            </div>

            {/* Genre + BPM + Mood row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <NeonInput label="Genre">
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </NeonInput>
              <NeonInput label="BPM">
                <input
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  type="number"
                  placeholder="e.g. 140"
                  style={inputStyle}
                />
              </NeonInput>
              <NeonInput label="Mood">
                <input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  type="text"
                  placeholder="e.g. Dark, Hyped"
                  style={inputStyle}
                />
              </NeonInput>
            </div>

            {/* Audio upload */}
            <NeonInput label="Audio File (WAV, MP3)">
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
                  : <span className="text-gray-300 text-sm group-hover:text-white">
                      Drag &amp; Drop or <span style={{ color: '#00FFFF' }}>Browse</span>
                    </span>
                }
              </label>
            </NeonInput>

            {/* Cover art upload */}
            <NeonInput label="Cover Art (JPEG, PNG, 3000×3000px recommended)">
              <label
                className="flex justify-center items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-slate-800"
                style={{ ...inputStyle, padding: '16px' }}
              >
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCoverFile(f); }} />
                <Upload className="w-5 h-5 text-gray-400" />
                {coverFile
                  ? <span className="text-white text-sm">{coverFile.name}</span>
                  : <span className="text-gray-400 text-sm">Browse image</span>
                }
              </label>
            </NeonInput>

            {/* Track story/lyrics */}
            <NeonInput label="Track Story / Lyrics (Share the vibe)">
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Type your story or lyrics here..."
                rows={4}
                className="placeholder-gray-500 resize-none"
                style={{ ...inputStyle, minHeight: 100 }}
              />
            </NeonInput>

            {/* YouTube link */}
            <NeonInput label="YouTube Link (Official Video/Visualizer)">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5" fill="#00FFFF" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <input value={ytLink} onChange={(e) => setYtLink(e.target.value)} type="text" placeholder="https://youtube.com/watch?v=..." className="placeholder-gray-600" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </NeonInput>

            {/* Streaming links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <NeonInput label="Spotify Link">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4" fill="#00FFFF" viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.48-3.48C15.12 7.02 8.76 6.84 5.1 7.92c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.2 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.24.54-.9.72-1.5.42z"/>
                    </svg>
                  </div>
                  <input value={spotifyLink} onChange={(e) => setSpotify(e.target.value)} type="text" placeholder="https://open.spotify.com/..." className="placeholder-gray-600" style={{ ...inputStyle, paddingLeft: 36 }} />
                </div>
              </NeonInput>
              <NeonInput label="Apple Music Link">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4" fill="#00FFFF" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  </div>
                  <input value={appleLink} onChange={(e) => setApple(e.target.value)} type="text" placeholder="https://music.apple.com/..." className="placeholder-gray-600" style={{ ...inputStyle, paddingLeft: 36 }} />
                </div>
              </NeonInput>
            </div>

            {/* Publish toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setPublishNow(!publishNow)}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{ backgroundColor: publishNow ? '#FF007F' : '#1e293b', boxShadow: publishNow ? '0 0 10px rgba(255,0,127,0.6)' : 'none' }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: publishNow ? 'translateX(28px)' : 'translateX(4px)' }}
                />
              </div>
              <span className="text-sm font-medium" style={{ color: publishNow ? '#FF007F' : '#94a3b8' }}>
                {publishNow ? 'Publish immediately 🔥' : 'Save as draft'}
              </span>
            </label>

            {/* GO LIVE */}
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
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
                : publishNow ? '🔥 Go Live' : 'Save Draft'
              }
            </button>
          </div>
        </section>

        {/* RIGHT: Published Tracks */}
        <section
          className="rounded-xl p-6 flex flex-col"
          style={{
            backgroundColor: '#12123A',
            border: '1px solid #FF007F',
            boxShadow: '0 0 10px rgba(255,0,127,0.5), 0 0 20px rgba(255,0,127,0.3)',
            height: 'calc(100vh - 160px)',
          }}
        >
          <h2 className="text-2xl font-bold mb-6 flex-shrink-0" style={{ color: '#FF007F', textShadow: '0 0 10px #FF007F' }}>
            Published Tracks
          </h2>

          <div className="flex-grow overflow-y-auto space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#00FFFF transparent' }}>
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
                  className="flex justify-between items-start p-4 rounded-lg gap-3"
                  style={{
                    border: `1px solid ${track.published ? '#FF007F' : '#334155'}`,
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    boxShadow: track.published ? 'inset 0 0 10px rgba(255,0,127,0.1)' : 'none',
                    opacity: track.published ? 1 : 0.6,
                  }}
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold mb-1 text-sm leading-tight truncate" style={{ color: '#00FFFF' }}>
                      {track.title}
                    </h3>
                    <p className="text-xs text-gray-400">{track.genre}</p>
                    <p className="text-xs mt-0.5" style={{ color: track.published ? '#FF007F' : '#64748b' }}>
                      {track.published ? '● Live' : '○ Draft'}
                    </p>
                  </div>
                  <a
                    href={`/tracks/${track.slug}`}
                    target="_blank"
                    className="text-xs font-bold py-1.5 px-3 rounded text-white flex-shrink-0 transition-all hover:scale-105 whitespace-nowrap"
                    style={{ backgroundColor: '#FF007F', boxShadow: '0 0 8px rgba(255,0,127,0.4)' }}
                  >
                    VIEW
                  </a>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.msg} onDismiss={() => setToast(null)} />}
    </div>
  );
}
