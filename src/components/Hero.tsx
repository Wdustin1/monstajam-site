import Image from 'next/image';
import type { PlayerTrack } from '@/context/PlayerContext';
import VinylRecord from './VinylRecord';

export default function Hero({ featuredTrack = null }: { featuredTrack?: PlayerTrack | null }) {
  return (
    <section
      data-mobile-layout="home-hero"
      data-design-concept="cinematic-soundstage"
      data-hero-stage="cinematic-motion"
      className="relative isolate h-[calc(100svh-6rem)] w-full overflow-hidden bg-black text-left"
    >
      <h1 className="sr-only">Monsta Jam Productions</h1>

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
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.06)_38%,rgba(0,0,0,0.78)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-85"
        style={{
          background: 'radial-gradient(circle at 50% 48%, transparent 0%, rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.72) 100%)',
        }}
      />
      <div
        data-cinematic-grain="true"
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] mix-blend-soft-light motion-reduce:hidden"
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

        <div className="relative my-auto flex min-h-0 flex-1 flex-col items-center justify-center">
          <div
            data-hero-brand="monstajam-lockup"
            data-brand-placement="mobile-above-desktop-side"
            className="relative z-20 -mb-1"
          >
            <Image
              src="/monstajam-logo.png"
              alt="Monsta Jam Productions"
              width={256}
              height={256}
              priority
              className="h-auto w-28 drop-shadow-[0_0_24px_rgba(236,72,153,0.28)] sm:w-32 lg:w-36"
            />
          </div>

          <div className="relative z-20 mb-1 text-center sm:mb-2">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.34em] text-white/85 sm:text-[11px]">
              DROP THE NEEDLE
            </p>
            <p className="mt-1 text-[10px] text-white/45 sm:text-[11px]">Press the deck to listen</p>
          </div>

          <div data-turntable-stage="lowered" className="cinematic-turntable-stage">
            <div className="cinematic-turntable-wrapper">
              <VinylRecord featuredTrack={featuredTrack} />
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-6">
          <p className="hidden max-w-[18rem] text-[11px] leading-relaxed text-white/55 sm:block">
            Monsta Jam Productions · music that never waited for permission.
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

      <style>{`
        .cinematic-turntable-stage {
          transform: translateY(16px);
        }

        .cinematic-turntable-wrapper {
          position: relative;
          z-index: 12;
          width: 300px;
          height: 204px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: visible;
        }

        .cinematic-turntable-wrapper > * {
          transform: scale(0.536);
          transform-origin: center center;
          flex-shrink: 0;
        }

        @media (min-width: 360px) {
          .cinematic-turntable-wrapper {
            width: 360px;
            height: 244px;
          }

          .cinematic-turntable-wrapper > * {
            transform: scale(0.643);
          }
        }

        @media (min-width: 480px) {
          .cinematic-turntable-wrapper {
            width: 430px;
            height: 292px;
          }

          .cinematic-turntable-wrapper > * {
            transform: scale(0.768);
          }
        }

        @media (min-width: 640px) {
          .cinematic-turntable-stage {
            transform: translateY(22px);
          }

          .cinematic-turntable-wrapper {
            width: 510px;
            height: 346px;
          }

          .cinematic-turntable-wrapper > * {
            transform: scale(0.911);
          }
        }

        @media (min-width: 1024px) {
          [data-hero-brand="monstajam-lockup"] {
            left: clamp(-410px, -27vw, -370px);
            top: 104px;
          }

          .cinematic-turntable-stage {
            transform: translateY(28px);
          }

          .cinematic-turntable-wrapper {
            width: 560px;
            height: 380px;
          }

          .cinematic-turntable-wrapper > * {
            transform: scale(1);
          }
        }

        @media (min-width: 1024px) and (max-height: 800px) {
          [data-hero-brand="monstajam-lockup"] img {
            width: 112px;
          }

          .cinematic-turntable-stage {
            transform: translateY(12px);
          }

          .cinematic-turntable-wrapper {
            width: 459px;
            height: 312px;
          }

          .cinematic-turntable-wrapper > * {
            transform: scale(0.82);
          }
        }
      `}</style>
    </section>
  );
}
