'use client';

import Image from 'next/image';

export default function AlbumReleaseBanner() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-5 md:px-6 relative z-10" aria-labelledby="cold-world-volume-2-heading">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#080A12] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[1600/520] min-h-[190px] w-full bg-black md:min-h-0">
          <Image
            src="/releases/cold-world-volume-2-banner.png"
            alt="Tyler J Cold World Volume 2. New album release July 1. Produced by Monsta Jam Productions."
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1280px"
            priority
          />
        </div>

        <div className="grid gap-4 border-t border-white/10 bg-black/70 px-4 py-4 backdrop-blur md:grid-cols-[1fr_auto] md:items-center md:px-6">
          <div className="text-center md:text-left">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                New album release
              </span>
              <span className="border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                July 1
              </span>
            </div>
            <h2 id="cold-world-volume-2-heading" className="text-balance text-2xl font-black leading-[0.95] tracking-tight text-white md:text-4xl">
              Tyler J - Cold World Volume 2
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              The next Cold World drop from Tyler J, produced by Monsta Jam Productions, releases July 1.
            </p>
          </div>

          <a
            href="#library"
            className="mx-auto inline-flex items-center justify-center rounded-lg border border-fuchsia-300/30 bg-fuchsia-400/12 px-5 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5 hover:bg-fuchsia-300/18 md:mx-0"
          >
            Listen on MonstaJam
          </a>
        </div>
      </div>
    </section>
  );
}
