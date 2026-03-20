'use client';

import { Play, Share2, Youtube } from 'lucide-react';

interface VideoCard {
  id: number;
  title: string;
  artist?: string;         // shown above title on bottom row
  views: string;
  duration: string;
  color: string;           // gradient bg placeholder
  showYTBadge?: boolean;   // card 1 gets the "Watch on YouTube" overlay
}

const VIDEOS: VideoCard[] = [
  {
    id: 1,
    title: 'Midnight Cruiser - Official Video',
    views: '1.2M Views',
    duration: '3:45',
    color: 'from-blue-900 via-slate-800 to-black',
    showYTBadge: true,
  },
  {
    id: 2,
    title: 'Neon Nights - Live Session',
    views: '1.2M Views',
    duration: '3:45',
    color: 'from-gray-900 via-slate-800 to-gray-950',
  },
  {
    id: 3,
    title: 'West Coast Vibes - Visualizer',
    views: '1.2M Views',
    duration: '3:45',
    color: 'from-orange-900 via-purple-900 to-teal-900',
  },
  {
    id: 4,
    title: 'Cyber Funk - Exclusive Premiere',
    views: '1.2M Views',
    duration: '3:45',
    color: 'from-purple-900 via-indigo-900 to-gray-900',
  },
  {
    id: 5,
    title: 'Cyber Funk - Exclusive Premiere',
    artist: 'Ariteficst',
    views: '1.2M Views',
    duration: '3:36',
    color: 'from-cyan-950 via-gray-900 to-black',
  },
  {
    id: 6,
    title: 'Neon Nights - Official Video',
    artist: 'Jean Sanior',
    views: '1.2M Views',
    duration: '3:32',
    color: 'from-slate-800 via-gray-900 to-zinc-900',
  },
  {
    id: 7,
    title: 'Music Eyner - Official Video',
    artist: 'West Coast',
    views: '1.2M Views',
    duration: '3:45',
    color: 'from-teal-950 via-slate-800 to-gray-900',
  },
  {
    id: 8,
    title: 'Neon Neon - Official Video',
    artist: 'Artists-rthist',
    views: '1.2M Views',
    duration: '3:58',
    color: 'from-fuchsia-950 via-purple-900 to-gray-950',
  },
];

export default function VideoGallery() {
  return (
    <div className="flex flex-col gap-10">

      {/* ── Hero heading + buttons ── */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <h1
          className="text-5xl md:text-6xl font-black uppercase leading-tight"
          style={{ letterSpacing: '2px' }}
        >
          <span
            style={{
              background: 'linear-gradient(90deg, #ff44ff, #dd88ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 14px rgba(255,0,255,0.8))',
            }}
          >
            MUSIC VIDEO{' '}
          </span>
          <span
            style={{
              background: 'linear-gradient(90deg, #44eeff, #00ffff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 14px rgba(0,229,255,0.8))',
            }}
          >
            GALLERY
          </span>
        </h1>

        <div className="flex gap-4 flex-shrink-0">
          {/* Share — magenta hollow */}
          <button
            className="px-6 py-2 rounded-full flex items-center gap-2 font-medium text-sm text-white transition-all hover:bg-fuchsia-500/10"
            style={{
              border: '2px solid #ff00ff',
              boxShadow: '0 0 10px rgba(255,0,255,0.4), inset 0 0 10px rgba(255,0,255,0.15)',
            }}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          {/* YouTube — cyan hollow */}
          <button
            className="px-6 py-2 rounded-full flex items-center gap-2 font-medium text-sm text-white transition-all hover:bg-cyan-500/10"
            style={{
              border: '2px solid #00e5ff',
              boxShadow: '0 0 10px rgba(0,229,255,0.4), inset 0 0 10px rgba(0,229,255,0.15)',
            }}
          >
            <Youtube className="w-4 h-4" />
            Subscribe to YouTube
          </button>
        </div>
      </section>

      {/* ── Video grid ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {VIDEOS.map((video) => (
          <article key={video.id} className="group cursor-pointer">

            {/* Thumbnail */}
            <div className="relative rounded-xl overflow-hidden mb-3 border border-gray-700/50"
              style={{ aspectRatio: '16/9' }}>

              {/* Gradient placeholder (swapped for real art later) */}
              <div className={`w-full h-full bg-gradient-to-br ${video.color} transition-transform duration-300 group-hover:scale-[1.02]`} />

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center transition-colors duration-300"
                style={{ background: 'rgba(0,0,0,0)' }}>
                <div
                  className="w-12 h-10 rounded flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                </div>
              </div>

              {/* YouTube badge on card 1 */}
              {video.showYTBadge && (
                <div className="absolute bottom-8 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded text-[11px] text-gray-300">
                  <Youtube className="w-3.5 h-3.5 text-red-500" />
                  Watch on YouTube
                </div>
              )}

              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs font-medium text-white">
                {video.duration}
              </div>
            </div>

            {/* Card info */}
            <div>
              {video.artist && (
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-0.5">
                  {video.artist}
                </p>
              )}
              <div className="flex justify-between items-start gap-2">
                <h3
                  className="font-bold leading-tight text-white group-hover:text-cyan-400 transition-colors"
                  style={{ fontSize: 16 }}
                >
                  {video.title}
                </h3>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                  {video.views}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>

    </div>
  );
}
