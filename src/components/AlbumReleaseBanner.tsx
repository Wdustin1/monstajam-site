'use client';

import Image from 'next/image';

export default function AlbumReleaseBanner() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 pt-5 relative z-10" aria-labelledby="cold-world-volume-2-heading">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#080A12] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(112,82,255,0.28),transparent_34%),radial-gradient(circle_at_72%_20%,rgba(0,229,255,0.18),transparent_30%),linear-gradient(100deg,rgba(6,8,18,0.96),rgba(8,10,18,0.86)_50%,rgba(11,8,20,0.98))]" />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
          }}
        />

        <div className="relative grid gap-5 md:grid-cols-[116px_1fr_auto] items-center px-4 py-4 md:px-6">
          <div className="relative mx-auto md:mx-0 h-28 w-28 overflow-hidden rounded-lg border border-white/15 bg-black shadow-[0_0_28px_rgba(95,120,255,0.22)]">
            <Image
              src="/releases/cold-world-volume-2-cover.jpg"
              alt="Tyler J Cold World Volume 2 release artwork"
              fill
              className="object-cover object-center"
              sizes="112px"
              priority
            />
          </div>

          <div className="text-center md:text-left">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                Latest album
              </span>
              <span className="border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Out now
              </span>
            </div>
            <h2 id="cold-world-volume-2-heading" className="text-balance text-2xl font-black leading-[0.95] tracking-tight text-white md:text-4xl">
              Tyler J - Cold World Volume 2
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Cold World Volume 2 is out now. Produced by Monsta Jam Productions.
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
