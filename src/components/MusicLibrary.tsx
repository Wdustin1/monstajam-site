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

const GENRES = ['All', 'Hip-Hop', 'R&B', 'Electronic', 'Lo-Fi'];
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

  // Close on outside click
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
        className="flex items-center justify-between px-4 py-3 rounded-full bg-[#111118] border border-white/10 hover:border-white/20 transition-colors text-sm gap-3 min-w-[110px]"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <span className={value === 'All' ? 'text-gray-400' : 'text-[#00e5ff]'}>{display}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 bg-[#0e0e14] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl min-w-full"
          style={{ backdropFilter: 'blur(12px)' }}>
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${value === opt ? 'text-[#00e5ff]' : 'text-gray-300'}`}>
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

  // Keep player queue in sync with visible filtered tracks
  useEffect(() => {
    setQueue(filtered);
  }, [filtered, setQueue]);

  return (
    <section id="library" className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-44 md:pb-40 flex flex-col gap-8 md:gap-10 z-10 relative">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-[2px]" style={{ background: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-gray-500">The Collection</span>
        </div>
        <div className="flex items-end justify-between">
          <h2 className="font-black tracking-tight uppercase"
            style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
              background: 'linear-gradient(90deg, #00e5ff, #0088ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 10px rgba(0,229,255,0.4))',
            }}>
            Exclusive Library
          </h2>
          <span className="text-sm text-gray-500 mb-1">{filtered.length} track{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center w-full">
        <div className="relative w-full md:flex-grow">
          <div className="absolute inset-[-1px] rounded-full z-[-1] opacity-60 blur-[5px]"
            style={{ background: 'linear-gradient(90deg, #00e5ff, #ff00ff)' }} />
          <div className="bg-[#0e0e14] border border-white/10 flex items-center px-4 py-3 rounded-full w-full"
            style={{ backdropFilter: 'blur(8px)' }}>
            <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
              placeholder="Search tracks..."
              className="bg-transparent border-none outline-none focus:ring-0 text-white placeholder-gray-600 w-full ml-3 text-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="ml-2 text-gray-500 hover:text-white transition-colors flex-shrink-0" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Dropdown label="Genre" options={GENRES} value={genre} onChange={setGenre} />
          <Dropdown label="BPM" options={BPMS} value={bpm} onChange={setBpm} />
          <Dropdown label="Mood" options={MOODS} value={mood} onChange={setMood} />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((track) => (
            <SongCard key={track.slug} track={track} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <Search className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-lg font-semibold text-gray-500">No tracks found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}
    </section>
  );
}
