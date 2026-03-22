'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, Share2, Check, ExternalLink } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  artist: string | null;
  youtubeUrl: string;
  youtubeId: string;
  duration: string | null;
  published: boolean;
  order: number;
}

interface VideoGalleryProps {
  videos: Video[];
}

export default function VideoGallery({ videos }: VideoGalleryProps) {
  const [copied, setCopied] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const handleShare = async () => {
    const url = 'https://monstajam-site.vercel.app/videos';
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Copy this URL:', url);
    }
  };

  return (
    <div className="flex flex-col gap-10">

      {/* ── Header ── */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <h1 className="text-5xl md:text-6xl font-black uppercase leading-tight" style={{ letterSpacing: '2px' }}>
          <span style={{
            background: 'linear-gradient(90deg, #ff44ff, #dd88ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 14px rgba(255,0,255,0.8))',
          }}>MUSIC VIDEO </span>
          <span style={{
            background: 'linear-gradient(90deg, #44eeff, #00ffff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 14px rgba(0,229,255,0.8))',
          }}>GALLERY</span>
        </h1>

        <div className="flex gap-4 flex-shrink-0">
          <button
            onClick={handleShare}
            className="px-6 py-2 rounded-full flex items-center gap-2 font-medium text-sm text-white transition-all hover:bg-fuchsia-500/10"
            style={{ border: '2px solid #ff00ff', boxShadow: '0 0 10px rgba(255,0,255,0.4), inset 0 0 10px rgba(255,0,255,0.15)' }}
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </section>

      {/* ── Grid or empty state ── */}
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-600">
          <Play className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-semibold text-gray-500">No videos yet</p>
          <p className="text-sm mt-1">Add videos via the admin dashboard</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map((video) => (
            <article key={video.id} className="group flex flex-col">

              {/* Thumbnail / embed */}
              <div className="relative rounded-xl overflow-hidden mb-3 border border-gray-700/50" style={{ aspectRatio: '16/9' }}>
                {activeVideo === video.id ? (
                  /* Inline YouTube embed */
                  <iframe
                    src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <>
                    {/* YouTube maxresdefault thumbnail */}
                    <Image
                      src={`https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`}
                      alt={video.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized // YouTube CDN
                    />
                    {/* Play overlay */}
                    <button
                      onClick={() => setActiveVideo(video.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                      aria-label={`Play ${video.title}`}
                    >
                      <div className="w-14 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: '#ff0000', boxShadow: '0 0 20px rgba(255,0,0,0.6)' }}>
                        <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                      </div>
                    </button>
                    {/* Duration */}
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs font-medium text-white">
                        {video.duration}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-1 flex-1">
                {video.artist && (
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{video.artist}</p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors leading-tight text-sm flex-1">
                    {video.title}
                  </h3>
                  <a
                    href={video.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    aria-label="Open on YouTube"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
