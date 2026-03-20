import VinylRecord from './VinylRecord';

export default function Hero() {
  return (
    <section
      className="max-w-7xl mx-auto px-8 pt-32 pb-24 flex flex-col lg:flex-row items-center justify-between gap-12"
      style={{ minHeight: '100vh' }}
    >
      {/* ── Left: Text ── */}
      <div className="w-full lg:w-1/2 flex flex-col gap-6 z-10">

        <h1 className="text-6xl md:text-8xl font-black leading-none tracking-tight flex flex-col gap-1">
          {/* Each line: gradient text + glow */}
          <span style={{
            background: 'linear-gradient(90deg, #00ffff, #0088ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(0,255,255,0.6))',
          }}>
            UNRELEASED.
          </span>
          <span style={{
            background: 'linear-gradient(90deg, #ff00ff, #aa00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(255,0,255,0.6))',
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

        <p className="text-lg text-gray-400 max-w-md mt-2 leading-relaxed">
          Discover the beats and tracks that never made it to the mainstream.
          Curated for true fans.
        </p>

        <div className="flex items-center gap-4 mt-6 flex-wrap">
          {/* Explore Library — hollow cyan */}
          <button
            className="px-8 py-3.5 rounded-full font-bold flex items-center gap-2 text-white transition-all hover:scale-105"
            style={{
              border: '2px solid #00ffff',
              background: 'transparent',
              boxShadow: '0 0 12px rgba(0,255,255,0.4), inset 0 0 12px rgba(0,255,255,0.1)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#00ffff" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M12 8v4l3 3" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Explore Library
          </button>


        </div>
      </div>

      {/* ── Right: Vinyl ── */}
      <div className="w-full lg:w-1/2 flex justify-center lg:justify-end mt-8 lg:mt-0">
        <VinylRecord />
      </div>
    </section>
  );
}
