export default function Hero() {
  return (
    <section
      data-mobile-layout="home-hero"
      data-design-concept="cinematic-soundstage"
      data-hero-stage="cinematic-motion"
      className="relative isolate h-[calc(100svh-6rem)] w-full overflow-hidden bg-black text-left"
    >
      <div
        data-cinematic-poster="true"
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-[url('/media/monstajam-cinematic-mobile.webp')] md:bg-[url('/media/monstajam-cinematic-desktop.webp')]"
      />

      <video
        data-cinematic-motion="true"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
      >
        <source
          media="(max-width: 767px)"
          src="/media/monstajam-cinematic-mobile.mp4"
          type="video/mp4"
        />
        <source
          src="/media/monstajam-cinematic-desktop.mp4"
          type="video/mp4"
        />
      </video>

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.14)_0%,rgba(0,0,0,0.04)_42%,rgba(0,0,0,0.72)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          background: 'radial-gradient(circle at 50% 42%, transparent 0%, rgba(0,0,0,0.08) 44%, rgba(0,0,0,0.68) 100%)',
        }}
      />
      <div
        data-cinematic-grain="true"
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08] mix-blend-soft-light motion-reduce:hidden"
        style={{
          backgroundImage: [
            'repeating-radial-gradient(circle at 17% 32%, rgba(255,255,255,0.55) 0 0.45px, transparent 0.6px 3px)',
            'repeating-radial-gradient(circle at 73% 61%, rgba(255,255,255,0.35) 0 0.4px, transparent 0.55px 4px)',
          ].join(', '),
          backgroundSize: '5px 5px, 7px 7px',
        }}
      />

      <div className="relative z-10 flex h-full flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-9">
        <div className="flex items-start justify-between gap-4 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/65 sm:text-[10px]">
          <p>Independent sound archive</p>
          <p className="text-right">Originals / Unreleased / Sessions</p>
        </div>

        <div
          data-hero-type="monsta-jam"
          className="pointer-events-none my-auto flex select-none flex-col items-center justify-center text-center"
        >
          <p className="mb-4 font-mono text-[9px] font-bold uppercase tracking-[0.36em] text-white/60 sm:text-[10px]">
            Built behind closed doors
          </p>
          <h1 className="flex flex-col items-center font-black uppercase leading-[0.72] tracking-[-0.085em] text-white [text-shadow:0_4px_36px_rgba(0,0,0,0.72)]">
            <span className="text-[clamp(4.65rem,17vw,15rem)]">MONSTA</span>
            <span className="mt-[0.14em] text-[clamp(6.2rem,22vw,19rem)] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.92)] sm:[-webkit-text-stroke:2px_rgba(255,255,255,0.92)]">
              JAM
            </span>
          </h1>
        </div>

        <div className="flex items-end justify-between gap-6">
          <p className="hidden max-w-[18rem] text-[11px] leading-relaxed text-white/55 sm:block">
            Music that never waited for permission.
          </p>
          <a
            href="#library"
            className="group ml-auto flex min-h-11 items-center gap-4 border-b border-white/50 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            Enter the archive
            <span aria-hidden="true" className="transition-transform group-hover:translate-y-1">↓</span>
          </a>
        </div>
      </div>

    </section>
  );
}
