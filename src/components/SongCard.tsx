'use client';

import Link from 'next/link';
import { Track } from '@/lib/tracks';

interface SongCardProps {
  track: Track;
}

export default function SongCard({ track }: SongCardProps) {
  return (
    <article className="bg-[#0a0a0a] rounded-2xl p-4 card-neon-border relative group flex flex-col">
      <span className="absolute top-4 right-4 text-xs font-bold text-gray-500">{track.number}</span>
      <div className="flex items-center gap-4 mb-4">
        {/* Album art placeholder */}
        <div className="w-20 h-20 rounded-lg overflow-hidden relative shrink-0">
          <div className={`w-full h-full ${track.color}`} />
        </div>
        <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4l12 6-12 6z" />
          </svg>
        </button>
      </div>
      <div className="flex-grow flex flex-col justify-between">
        <div>
          <Link href={`/tracks/${track.slug}`} className="hover:text-[#00ffff] transition-colors">
            <h3 className="font-bold text-white leading-tight truncate group-hover:text-[#00ffff] transition-colors">
              {track.title}{track.subtitle ? ` (${track.subtitle})` : ''}
            </h3>
          </Link>
          <p className="text-sm text-gray-400 mt-1 truncate">{track.artist}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cyan-500/50 bg-cyan-500/10 text-xs font-semibold text-cyan-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            EXCLUSIVE
          </span>
          <div className="flex gap-2">
            {/* Spotify */}
            {track.spotifyUrl && (
              <a
                href={track.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500/20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zM20.16 9.6C16.32 7.38 9.48 7.14 5.52 8.34c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.56-1.38 12.06-1.08 16.56 1.62.54.3.72 1.02.42 1.56-.24.54-.84.72-1.68.18z" />
                </svg>
              </a>
            )}
            {/* Apple Music */}
            {track.appleMusicUrl && (
              <a
                href={track.appleMusicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 18V5l12-2v13M9 18c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-2" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
