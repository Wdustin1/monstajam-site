'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import SongCard from './SongCard';
import { usePlayer, type PlayerTrack } from '@/context/PlayerContext';

export interface Credit {
  id: string;
  trackId: string;
  role: string;
  name: string;
}

export type TrackWithCredits = PlayerTrack & {
  id?: string;
  number?: number | null;
  mood?: string | null;
  accentCyan?: boolean | null;
  story?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  published?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  credits?: Credit[];
};

const GENRES = ['All', 'Full Songs', 'Hip-Hop', 'R&B', 'Electronic', 'Lo-Fi'];
const BPMS = ['All', '< 80', '80–100', '100–120', '120+'];
const MOODS = ['All', 'Chill', 'Energetic', 'Dark'];

interface DropdownProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

function Dropdown({ label, options, value, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const display = value === 'All' ? label : value;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[104px] items-center justify-between gap-3 rounded-full border border-white/10 bg-[#151515] px-4 py-3 text-sm transition-colors hover:border-white/25"
      >
        <span className={value === 'All' ? 'text-zinc-400' : 'text-cyan-200'}>{display}</span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 ${value === opt ? 'text-cyan-200' : 'text-zinc-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MusicLibrary({ tracks }: { tracks: TrackWithCredits[] }) {
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('All');
  const [bpm, setBpm] = useState('All');
  const [mood, setMood] = useState('All');
  const { setQueue } = usePlayer();

  const filtered = useMemo(() => {
    return tracks.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) return false;
      if (genre !== 'All' && t.genre !== genre) return false;
      if (mood !== 'All' && t.mood !== mood) return false;
      if (bpm !== 'All' && t.bpm != null) {
        const b = t.bpm;
        if (bpm === '< 80' && b >= 80) return false;
        if (bpm === '80–100' && (b < 80 || b > 100)) return false;
        if (bpm === '100–120' && (b < 100 || b > 120)) return false;
        if (bpm === '120+' && b < 120) return false;
      }
      return true;
    });
  }, [search, genre, bpm, mood, tracks]);

  const fullSongs = useMemo(() => tracks.filter((track) => track.genre === 'Full Songs'), [tracks]);
  const showingFullSongsLane = fullSongs.length > 0 && genre === 'All' && !search && bpm === 'All' && mood === 'All';
  const libraryTracks = showingFullSongsLane
    ? filtered.filter((track) => track.genre !== 'Full Songs')
    : filtered;

  useEffect(() => {
    setQueue(filtered);
  }, [filtered, setQueue]);

  return (
    <section id="library" className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-44 pt-8 md:gap-10 md:px-6 md:pb-40">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-white/20" />
          <span className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Producer vault</span>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className="font-black uppercase leading-none tracking-[-0.04em] text-white"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
            >
              Label archive
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Every track file carries the cover, catalog number, artist, stream links, and a short note pulled from the record.
            </p>
          </div>
          <span className="text-sm uppercase tracking-[0.18em] text-zinc-500">{filtered.length} track{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:flex-wrap xl:flex-nowrap">
        <div className="relative w-full md:min-w-[320px] md:flex-1">
          <div className="flex w-full items-center rounded-full border border-white/10 bg-[#111] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <Search className="h-5 w-5 flex-shrink-0 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
              placeholder="Search the vault..."
              className="ml-3 w-full border-none bg-transparent text-sm text-white outline-none placeholder-zinc-600 focus:ring-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="ml-2 flex-shrink-0 text-zinc-500 transition-colors hover:text-white" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-3 overflow-visible pb-1 md:w-auto md:justify-end md:pb-0">
          <Dropdown label="Genre" options={GENRES} value={genre} onChange={setGenre} />
          <Dropdown label="BPM" options={BPMS} value={bpm} onChange={setBpm} />
          <Dropdown label="Mood" options={MOODS} value={mood} onChange={setMood} />
        </div>
      </div>

      {showingFullSongsLane && (
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.045] p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Full song files</p>
              <h3 className="text-xl font-black tracking-tight text-white">Play these past the preview cap</h3>
            </div>
            <span className="text-sm text-emerald-100/60">{fullSongs.length} full song{fullSongs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {fullSongs.map((track) => (
              <SongCard key={`full-${track.slug}`} track={track} />
            ))}
          </div>
        </div>
      )}

      {libraryTracks.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {libraryTracks.map((track) => (
            <SongCard key={track.slug} track={track} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
          <Search className="mb-4 h-12 w-12 opacity-20" />
          <p className="text-lg font-semibold text-zinc-500">No tracks found</p>
          <p className="mt-1 text-sm">Try another title, mood, or BPM range.</p>
        </div>
      )}
    </section>
  );
}
