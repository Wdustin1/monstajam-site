'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import type { Track } from '@prisma/client';

const GENRES = [
  'R&B', 'West Coast', 'Global', 'Lo-Fi', 'Trap',
  'Soul', 'Hip-Hop', 'Afrobeats', 'Electronic',
];

// Genre browser cards — separate from the library tracks (these are genre collections)
const GENRE_CARDS = [
  {
    slug: 'midnight-cruiser',
    title: 'Midnight Cruiser',
    subtitle: 'West Coast',
    bpm: 95,
    color: 'bg-gradient-to-br from-purple-800 to-blue-700',
    featured: true,
  },
  { slug: 'neon-nights', title: 'Neon Nights', subtitle: 'R&B Soul', color: 'bg-gradient-to-br from-pink-700 to-fuchsia-600' },
  { slug: 'global-beats', title: 'Global Beats', subtitle: 'World Sounds', color: 'bg-gradient-to-br from-teal-600 to-cyan-500' },
  { slug: 'lofi-dreams', title: 'Lo-Fi Dreams', subtitle: 'Chill', color: 'bg-gradient-to-br from-indigo-600 to-violet-500' },
  { slug: 'trap-empire', title: 'Trap Empire', subtitle: 'Streetz', color: 'bg-gradient-to-br from-gray-800 to-gray-600' },
  { slug: 'soulful-vibes', title: 'Soulful Vibes', subtitle: 'The Collective', color: 'bg-gradient-to-br from-amber-600 to-orange-500' },
  { slug: 'hiphop-legacy', title: 'Hip-Hop Legacy', subtitle: 'Old School', color: 'bg-gradient-to-br from-yellow-700 to-amber-500' },
  { slug: 'afro-rhythms', title: 'Afro Rhythms', subtitle: 'Motherland', color: 'bg-gradient-to-br from-red-600 to-orange-500' },
  { slug: 'electro-pulse', title: 'Electro Pulse', subtitle: 'Synth', color: 'bg-gradient-to-br from-violet-700 to-fuchsia-500' },
];

export default function GenreBrowser() {
  const [activeGenre, setActiveGenre] = useState('R&B');
  const { toggle, currentTrack, isPlaying } = usePlayer();
  // Minimal stub so the player can fire while genre page doesn't have DB access
  const featuredLibraryTrack: Track = {
    id: 'stub', slug: 'city-lights', number: 1, title: 'City Lights',
    subtitle: 'Unreleased Mix', artist: 'Neon Pulse', genre: 'Electronic',
    bpm: 128, mood: 'Dark', color: 'bg-gradient-to-br from-purple-600 to-blue-500',
    accentCyan: true, story: null, spotifyUrl: '#', appleMusicUrl: '#',
    audioUrl: null, coverUrl: null, published: true,
    createdAt: new Date(), updatedAt: new Date(),
  };

  const featured = GENRE_CARDS.find((c) => c.featured)!;
  const rest = GENRE_CARDS.filter((c) => !c.featured);

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col pl-8 pr-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <h2 className="text-gray-500 text-xs font-semibold tracking-widest mb-4 uppercase mt-2">Genres</h2>
        <ul className="space-y-2">
          {GENRES.map((g) => (
            <li key={g}>
              <button
                onClick={() => setActiveGenre(g)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-medium transition-all text-left text-sm ${
                  activeGenre === g
                    ? 'border text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={activeGenre === g ? {
                  borderColor: '#b026ff',
                  boxShadow: '0 0 10px rgba(176,38,255,0.5), inset 0 0 10px rgba(176,38,255,0.2)',
                } : {}}
              >
                <span>{g}</span>
                {activeGenre !== g && (
                  <div className="w-3 h-[3px] rounded-full" style={{ background: 'rgba(176,38,255,0.5)' }} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main grid */}
      <main className="flex-1 overflow-y-auto px-6 pr-10" style={{ scrollbarWidth: 'none' }}>
        <h1 className="text-3xl font-bold mb-6 text-white tracking-wide">Browse All Genres Library</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">

          {/* Featured card — spans 2 columns */}
          <div
            className="col-span-1 md:col-span-2 rounded-2xl p-6 border flex flex-row gap-6 items-center justify-between"
            style={{
              backgroundColor: '#1a1a20',
              borderColor: '#b026ff',
              boxShadow: '0 0 20px rgba(176,38,255,0.2)',
            }}
          >
            <div className={`w-48 h-48 rounded-xl flex-shrink-0 ${featured.color} flex items-center justify-center`}>
              <span className="text-white font-black text-lg uppercase tracking-wider opacity-80 text-center px-3">
                {featured.title}
              </span>
            </div>
            <div className="flex flex-col space-y-3 w-48 ml-auto">
              <button
                onClick={() => toggle(featuredLibraryTrack)}
                className="w-full text-white text-sm font-semibold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-colors"
                style={{ background: '#b026ff' }}
              >
                <Play className="w-4 h-4 fill-current" />
                Play Exclusive
              </button>
              <button className="w-full border border-white/20 text-white text-sm font-medium py-2 px-4 rounded-full flex items-center justify-center gap-2 transition-colors hover:bg-white/10"
                style={{ backgroundColor: '#1a1a20' }}>
                <svg className="w-4 h-4 fill-current text-green-400" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.48-3.48C15.12 7.02 8.76 6.84 5.1 7.92c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.2 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.24.54-.9.72-1.5.42z"/>
                </svg>
                Stream on Spotify
              </button>
              <button className="w-full border border-white/20 text-white text-sm font-medium py-2 px-4 rounded-full flex items-center justify-center gap-2 transition-colors hover:bg-white/10"
                style={{ backgroundColor: '#1a1a20' }}>
                <svg className="w-4 h-4 fill-current text-gray-300" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 6.628 5.373 12 12 12s12-5.372 12-12c0-6.627-5.373-12-12-12zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm-2 14.5v-9l6 3-6 3v3z"/>
                </svg>
                Stream on Apple
              </button>
            </div>
          </div>

          {/* Standard cards */}
          {rest.map((card) => (
            <div
              key={card.slug}
              className="rounded-2xl p-4 flex flex-col justify-center cursor-pointer border border-transparent hover:border-white/10 transition-all group"
              style={{ backgroundColor: '#1a1a20' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#202028')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1a1a20')}
            >
              <div className="flex items-center gap-4">
                <div className={`w-20 h-20 rounded-xl flex-shrink-0 ${card.color} flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold text-center px-1 opacity-70 leading-tight">
                    {card.title}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base mb-1">{card.title}</h3>
                  <p className="text-gray-400 text-sm">{card.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
