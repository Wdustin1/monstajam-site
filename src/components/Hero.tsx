import VinylRecord from './VinylRecord';

export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-8 pt-20 pb-32 flex flex-col lg:flex-row items-center justify-between">
      {/* Hero Text */}
      <div className="w-full lg:w-1/2 flex flex-col gap-6 z-10">
        <h1 className="text-6xl md:text-8xl font-black leading-none tracking-tight flex flex-col">
          <span className="neon-text-cyan">UNRELEASED.</span>
          <span className="neon-text-purple">EXCLUSIVE.</span>
          <span className="text-white" style={{ textShadow: '0 0 15px rgba(0,255,255,0.8), 0 0 30px rgba(0,255,255,0.4)' }}>YOURS.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-md mt-4">
          Discover the beats and tracks that never made it to the mainstream. Curated for true fans.
        </p>
        <div className="flex items-center gap-4 mt-8">
          <button className="neon-border-purple px-8 py-3.5 rounded-full font-bold flex items-center gap-2 hover:bg-fuchsia-900/30 transition-colors">
            <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            Explore Library
          </button>
          <button className="neon-bg-cyan px-8 py-3.5 rounded-full font-bold flex items-center gap-2 hover:brightness-110 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            Go Premium
          </button>
        </div>
      </div>

      {/* Hero Graphic */}
      <div className="w-full lg:w-1/2 flex justify-center lg:justify-end mt-16 lg:mt-0 relative">
        <VinylRecord />
      </div>
    </section>
  );
}
