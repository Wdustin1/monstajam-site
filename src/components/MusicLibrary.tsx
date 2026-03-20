'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { tracks } from '@/lib/tracks';
import SongCard from './SongCard';

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
  const display = value === 'All' ? label : value;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 rounded-full bg-[#1a1a24] border border-gray-700 hover:bg-gray-800 transition-colors text-sm gap-3 min-w-[110px]"
      >
        <span className={value === 'All' ? 'text-gray-300' : 'text-white'}>{display}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 bg-[#111114] border border-gray-700 rounded-xl overflow-hidden z-20 shadow-xl min-w-full">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                value === opt ? 'text-[#00ffff]' : 'text-gray-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MusicLibrary() {
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('All');
  const [bpm, setBpm] = useState('All');
  const [mood, setMood] = useState('All');

  const filtered = useMemo(() => {
    return tracks.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) return false;
      if (genre !== 'All' && t.genre !== genre) return false;
      if (mood !== 'All' && t.mood !== mood) return false;
      if (bpm !== 'All' && t.bpm !== undefined) {
        if (bpm === '< 80' && t.bpm >= 80) return false;
        if (bpm === '80–100' && (t.bpm < 80 || t.bpm > 100)) return false;
        if (bpm === '100–120' && (t.bpm < 100 || t.bpm > 120)) return false;
        if (bpm === '120+' && t.bpm < 120) return false;
      }
      return true;
    });
  }, [search, genre, bpm, mood]);

  return (
    <section className="max-w-7xl mx-auto px-6 pt-8 pb-40 flex flex-col gap-10 z-10 relative">

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center w-full">
        {/* Glow search bar */}
        <div className="relative w-full md:flex-grow">
          <div
            className="absolute inset-[-2px] rounded-full z-[-1] opacity-80 blur-[4px]"
            style={{ background: 'linear-gradient(90deg, #00ffff, #ff00ff)' }}
          />
          <div className="bg-[#111114] border border-white/10 flex items-center px-4 py-3 rounded-full w-full">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracks..."
              className="bg-transparent border-none outline-none focus:ring-0 text-white placeholder-gray-500 w-full ml-3 text-sm"
            />
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Dropdown label="Genre" options={GENRES} value={genre} onChange={setGenre} />
          <Dropdown label="BPM" options={BPMS} value={bpm} onChange={setBpm} />
          <Dropdown label="Mood" options={MOODS} value={mood} onChange={setMood} />
        </div>
      </div>

      {/* Section heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black tracking-tight text-white uppercase">Exclusive Library</h2>
        <span className="text-sm text-gray-500">{filtered.length} track{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((track) => (
            <SongCard key={track.slug} track={track} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Search className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-semibold">No tracks found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}
    </section>
  );
}
