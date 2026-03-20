import VinylRecord from './VinylRecord';

export default function Hero() {
  return (
    <section
      className="max-w-7xl mx-auto px-8 pt-32 pb-24 flex flex-col lg:flex-row items-center justify-between gap-12 relative"
      style={{ minHeight: '100vh' }}
    >
      {/* Ambient glow blobs behind content */}
      <div className="absolute top-1/3 left-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute top-1/4 right-0 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.10) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* ── Left: Text ── */}
      <div className="w-full lg:w-1/2 flex flex-col gap-6 z-10">

        {/* Eyebrow tag */}
        <div className="flex items-center gap-2">
          <span className="w-8 h-[2px]" style={{ background: '#ff00ff', boxShadow: '0 0 8px #ff00ff' }} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#ff00ff' }}>
            Official Fan Site
          </span>
        </div>

        <h1 className="font-black leading-none tracking-tight flex flex-col gap-1"
          style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}>
          <span style={{
            background: 'linear-gradient(90deg, #00ffff, #0088ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 14px rgba(0,255,255,0.55))',
          }}>
            UNRELEASED.
          </span>
          <span style={{
            background: 'linear-gradient(90deg, #ff44ff, #aa00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 14px rgba(255,0,255,0.55))',
          }}>
            EXCLUSIVE.
          </span>
          <span style={{
            background: 'linear-gradient(90deg, #ffffff, #aaddff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(100,200,255,0.5))',
          }}>
            YOURS.
          </span>
        </h1>

        <p className="text-base text-gray-400 max-w-md mt-2 leading-relaxed">
          Discover the beats and tracks that never made it to the mainstream.
          Curated for true fans — no algorithms, no gatekeepers.
        </p>

        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {/* Explore Library — cyan glow */}
          <button
            className="px-8 py-3.5 rounded-full font-bold flex items-center gap-2 text-white transition-all hover:scale-105"
            style={{
              border: '2px solid #00e5ff',
              background: 'rgba(0,229,255,0.07)',
              boxShadow: '0 0 16px rgba(0,229,255,0.35), inset 0 0 12px rgba(0,229,255,0.08)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#00e5ff" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M10 8l6 4-6 4V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#00e5ff" stroke="none"/>
            </svg>
            Explore Library
          </button>

          {/* Watch Videos — magenta hollow */}
          <a
            href="/videos"
            className="px-8 py-3.5 rounded-full font-bold flex items-center gap-2 text-white transition-all hover:scale-105 no-underline"
            style={{
              border: '1px solid rgba(255,0,255,0.4)',
              background: 'rgba(255,0,255,0.05)',
              boxShadow: '0 0 12px rgba(255,0,255,0.2)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#ff44ff" viewBox="0 0 24 24">
              <rect x="2" y="4" width="20" height="16" rx="3" strokeWidth="2"/>
              <path d="M10 9l5 3-5 3V9z" fill="#ff44ff" stroke="none"/>
            </svg>
            <span style={{ color: '#ff99ff' }}>Watch Videos</span>
          </a>
        </div>

        {/* Social proof strip */}
        <div className="flex items-center gap-5 mt-2 pt-6 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-white font-black text-lg leading-none">12+</span>
            <span className="text-gray-500 text-xs mt-0.5">Exclusive Tracks</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white font-black text-lg leading-none">8</span>
            <span className="text-gray-500 text-xs mt-0.5">Music Videos</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-white font-black text-lg leading-none">1</span>
            <span className="text-gray-500 text-xs mt-0.5">Artist</span>
          </div>
        </div>
      </div>

      {/* ── Right: Vinyl ── */}
      <div className="w-full lg:w-1/2 flex justify-center lg:justify-end mt-8 lg:mt-0 relative">
        {/* Glow behind vinyl */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 70%)', filter: 'blur(30px)' }} />
        </div>
        <VinylRecord />
      </div>
    </section>
  );
}
