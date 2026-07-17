'use client';

import { motion, useAnimation } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { usePlayer, PlayerTrack } from '@/context/PlayerContext';
import {
  getControlledTurntableTrack,
  getTonearmRotation,
} from './vinylRecordMotion';

interface VinylRecordProps {
  featuredTrack?: PlayerTrack | null;
}

const TURNTABLE_WIDTH = 560;
const TURNTABLE_HEIGHT = 380;
const PLATTER_SIZE = 342;
const RECORD_SIZE = 312;
const RECORD_LEFT = 56;
const RECORD_TOP = 34;
const LABEL_SIZE = 168;
const PIVOT_X = 418;
const PIVOT_Y = 84;
const TONEARM_PIVOT_X = 58;
const TONEARM_PIVOT_Y = 56;

export default function VinylRecord({ featuredTrack }: VinylRecordProps) {
  const { currentTrack, isPlaying, progress, toggle, play } = usePlayer();
  const [hovered, setHovered] = useState(false);
  const platterControls = useAnimation();
  const {
    displayTrack,
    clickTrack,
    isTurntablePlaying,
  } = getControlledTurntableTrack({ currentTrack, featuredTrack, isPlaying });
  const tonearmRotation = getTonearmRotation(isTurntablePlaying, progress);
  const hasPlayableTrack = Boolean(clickTrack?.audioUrl);

  useEffect(() => {
    if (isTurntablePlaying) {
      platterControls.start({
        rotate: [0, 360],
        transition: { duration: 3.8, repeat: Infinity, ease: 'linear' },
      });
      return;
    }

    platterControls.stop();
  }, [isTurntablePlaying, platterControls]);

  const handleToggle = () => {
    if (!clickTrack?.audioUrl) return;

    if (currentTrack?.slug === clickTrack.slug) {
      toggle(clickTrack);
      return;
    }

    play(clickTrack);
  };

  const handlePointerStart = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handleToggle();
  };

  const handleKeyStart = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleToggle();
  };

  const ariaLabel = !clickTrack
    ? 'Turntable'
    : !clickTrack.audioUrl
      ? `${clickTrack.title} has no audio available`
      : isTurntablePlaying
      ? `Pause ${clickTrack.title}`
      : `Play ${clickTrack.title}`;

  return (
    <button
      type="button"
      data-turntable-id="hero-turntable"
      aria-label={ariaLabel}
      disabled={!hasPlayableTrack}
      onPointerDown={handlePointerStart}
      onKeyDown={handleKeyStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative block select-none text-left outline-none disabled:cursor-default"
      style={{
        width: TURNTABLE_WIDTH,
        height: TURNTABLE_HEIGHT,
        border: 0,
        padding: 0,
        background: 'transparent',
        cursor: hasPlayableTrack ? 'pointer' : 'default',
      }}
    >
      <span
        className="absolute inset-[-36px] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 29% 48%, rgba(0,229,255,0.20), transparent 38%), radial-gradient(circle at 88% 43%, rgba(255,0,170,0.22), transparent 34%)',
          filter: 'blur(38px)',
          opacity: isTurntablePlaying ? 0.95 : 0.62,
          transition: 'opacity 500ms ease',
        }}
      />

      <span
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: 28,
          background:
            'linear-gradient(145deg, #25272d 0%, #0a0b0f 42%, #171117 100%)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow:
            '0 34px 70px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -22px 34px rgba(0,0,0,0.56)',
        }}
      >
        <span
          className="absolute inset-[12px]"
          style={{
            borderRadius: 21,
            background:
              'radial-gradient(circle at 29% 28%, rgba(255,255,255,0.075), transparent 26%), radial-gradient(circle at 78% 22%, rgba(255,255,255,0.05), transparent 30%), linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.012) 38%, rgba(0,0,0,0.24)), repeating-linear-gradient(92deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 8px)',
            border: '1px solid rgba(255,255,255,0.055)',
          }}
        />
        <span
          className="absolute left-0 top-10 h-[280px] w-[3px]"
          style={{
            background: 'linear-gradient(180deg, transparent, #00e5ff, transparent)',
            boxShadow: '0 0 12px rgba(0,229,255,0.58)',
            opacity: hovered || isTurntablePlaying ? 0.54 : 0.24,
          }}
        />
        <span
          className="absolute right-0 top-10 h-[280px] w-[3px]"
          style={{
            background: 'linear-gradient(180deg, transparent, #ff00aa, transparent)',
            boxShadow: '0 0 12px rgba(255,0,170,0.58)',
            opacity: hovered || isTurntablePlaying ? 0.54 : 0.24,
          }}
        />
        {[
          [24, 22],
          [516, 22],
          [24, 334],
          [516, 334],
        ].map(([left, top]) => (
          <span
            key={`${left}-${top}`}
            className="absolute rounded-full"
            style={{
              left,
              top,
              width: 9,
              height: 9,
              background:
                'radial-gradient(circle at 38% 30%, #aeb8c0, #333941 52%, #050608 100%)',
              boxShadow:
                'inset 0 0 0 1px rgba(255,255,255,0.16), 0 2px 5px rgba(0,0,0,0.65)',
              opacity: 0.62,
            }}
          />
        ))}
        <span
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.038) 34%, transparent 36%), repeating-linear-gradient(0deg, transparent 0 9px, rgba(255,255,255,0.012) 10px)',
            mixBlendMode: 'screen',
          }}
        />
        <span
          className="absolute left-8 right-8 top-[18px] h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)',
            opacity: 0.72,
          }}
        />
      </span>

      <span
        className="absolute rounded-full"
        style={{
          left: 38,
          top: 18,
          width: PLATTER_SIZE,
          height: PLATTER_SIZE,
          zIndex: 7,
          background:
            'radial-gradient(circle at 50% 50%, #050506 0 43%, #20222a 44% 46%, #070709 47% 50%, #d3dde4 50.6%, #58616a 52%, #08090b 53% 100%)',
          boxShadow:
            '0 30px 44px rgba(0,0,0,0.74), inset 0 0 0 2px rgba(255,255,255,0.12), inset 0 0 18px rgba(255,255,255,0.08)',
        }}
      />
      <span
        className="absolute rounded-full"
        style={{
          left: 40,
          top: 20,
          width: PLATTER_SIZE - 4,
          height: PLATTER_SIZE - 4,
          zIndex: 8,
          background:
            'repeating-conic-gradient(from 3deg, rgba(255,255,255,0.18) 0deg 1deg, rgba(255,255,255,0.02) 1deg 4deg)',
          opacity: 0.09,
          mixBlendMode: 'screen',
        }}
      />

      <motion.span
        className="absolute overflow-hidden rounded-full"
        animate={platterControls}
        style={{
          left: RECORD_LEFT,
          top: RECORD_TOP,
          width: RECORD_SIZE,
          height: RECORD_SIZE,
          background: '#030304',
          zIndex: 12,
          boxShadow:
            '0 18px 36px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 0 0 8px rgba(0,0,0,0.72)',
        }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, #121319 0 16%, #08090d 18% 42%, #040407 58%, #010102 100%)',
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'repeating-radial-gradient(circle at center, transparent 0 3.4px, rgba(255,255,255,0.14) 3.7px 3.95px, rgba(0,0,0,0.48) 4.2px 4.6px, transparent 4.95px 7.2px)',
            opacity: 0.44,
          }}
        />
        <span
          className="absolute inset-[9px] rounded-full"
          style={{
            background:
              'repeating-radial-gradient(circle at center, transparent 0 10px, rgba(255,255,255,0.055) 10.8px 11.25px, rgba(0,0,0,0.38) 11.7px 12.25px, transparent 13px 24px)',
            opacity: 0.64,
          }}
        />
        <span
          className="absolute inset-[14px] rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, transparent 0 27%, rgba(255,255,255,0.075) 28.4% 29%, transparent 30.2% 39%, rgba(255,255,255,0.05) 40.4% 40.9%, transparent 42.1% 55.6%, rgba(255,255,255,0.06) 57.2% 57.8%, transparent 59% 68%, rgba(255,255,255,0.045) 70% 70.6%, transparent 71.8% 82%, rgba(0,0,0,0.42) 90%, rgba(0,0,0,0.78) 100%)',
            opacity: 0.84,
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, transparent 0 25%, rgba(0,0,0,0.28) 26% 31%, transparent 32% 82%, rgba(0,0,0,0.48) 88%, rgba(0,0,0,0.9) 100%)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 0 0 5px rgba(0,0,0,0.75), inset 0 0 22px rgba(255,255,255,0.045)',
            pointerEvents: 'none',
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, transparent 0 86%, rgba(255,255,255,0.13) 88%, rgba(55,58,67,0.46) 90%, rgba(0,0,0,0.9) 96%, rgba(255,255,255,0.08) 97%, rgba(0,0,0,0.96) 100%)',
            pointerEvents: 'none',
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            left: 63,
            top: 63,
            width: RECORD_SIZE - 126,
            height: RECORD_SIZE - 126,
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.08), 0 0 0 4px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.045)',
            pointerEvents: 'none',
          }}
        />
        <span
          className="absolute overflow-hidden rounded-full"
          style={{
            left: (RECORD_SIZE - LABEL_SIZE) / 2,
            top: (RECORD_SIZE - LABEL_SIZE) / 2,
            width: LABEL_SIZE,
            height: LABEL_SIZE,
            background: '#090912',
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow:
              '0 0 0 2px rgba(255,0,170,0.25), 0 0 0 5px rgba(0,0,0,0.34), 0 0 18px rgba(0,229,255,0.24), inset 0 0 18px rgba(0,0,0,0.48)',
          }}
        >
          <Image
            src="/monstajam-record-label.png"
            alt="Monsta Jam Productions vinyl label"
            width={LABEL_SIZE}
            height={LABEL_SIZE}
            priority
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
            }}
          />
        </span>
        <span
          className="absolute rounded-full"
          style={{
            left: 139,
            top: 139,
            width: 34,
            height: 34,
            background:
              'radial-gradient(circle at 37% 30%, rgba(255,255,255,0.16), rgba(0,0,0,0.1) 28%, rgba(0,0,0,0.74) 64%, rgba(0,0,0,0.9) 100%)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.12), 0 3px 8px rgba(0,0,0,0.74)',
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            left: 149,
            top: 149,
            width: 14,
            height: 14,
            background:
              'radial-gradient(circle at 38% 30%, #ffffff, #c5ccd4 22%, #252a30 54%, #030304 100%)',
            boxShadow:
              '0 1px 5px rgba(255,255,255,0.35), 0 6px 10px rgba(0,0,0,0.85)',
          }}
        />
      </motion.span>

      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          left: RECORD_LEFT,
          top: RECORD_TOP,
          width: RECORD_SIZE,
          height: RECORD_SIZE,
          zIndex: 16,
          background:
            'radial-gradient(ellipse at 30% 18%, rgba(255,255,255,0.14), transparent 28%), radial-gradient(ellipse at 62% 82%, rgba(255,255,255,0.045), transparent 34%), linear-gradient(124deg, transparent 0 33%, rgba(255,255,255,0.038) 43%, transparent 53%)',
          opacity: hovered || isTurntablePlaying ? 0.42 : 0.28,
          mixBlendMode: 'screen',
          transition: 'opacity 400ms ease',
        }}
      />

      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          left: RECORD_LEFT,
          top: RECORD_TOP,
          width: RECORD_SIZE,
          height: RECORD_SIZE,
          zIndex: 17,
          boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 0 0 8px rgba(0,0,0,0.34), 0 10px 20px rgba(0,0,0,0.42)',
        }}
      />

      <span
        className="absolute rounded-full"
        style={{
          left: 78,
          top: 318,
          width: 48,
          height: 48,
          background:
            'radial-gradient(circle at 38% 30%, #646a70, #181b20 52%, #020203 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow:
            '0 10px 18px rgba(0,0,0,0.54), inset 0 2px 5px rgba(255,255,255,0.11)',
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            left: 7,
            top: 7,
            width: 34,
            height: 34,
            background:
              'repeating-conic-gradient(from 20deg, #373b40 0deg 5deg, #111215 5deg 10deg)',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        />
      </span>
      <span
        className="absolute rounded-full"
        style={{
          left: 57,
          top: 336,
          width: 7,
          height: 7,
          background: isTurntablePlaying ? '#00e5ff' : 'rgba(255,255,255,0.45)',
          boxShadow: isTurntablePlaying
            ? '0 0 9px #00e5ff, 0 0 22px rgba(0,229,255,0.95)'
            : '0 0 8px rgba(255,255,255,0.25)',
        }}
      />

      <span
        className="absolute"
        style={{
          left: PIVOT_X - 62,
          top: PIVOT_Y - 62,
          width: 124,
          height: 124,
          zIndex: 24,
        }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.16), rgba(36,38,43,0.95) 35%, rgba(9,10,13,0.97) 63%, rgba(1,1,2,0.98) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow:
              '0 20px 30px rgba(0,0,0,0.62), inset 0 0 0 8px rgba(0,0,0,0.45), inset 0 2px 6px rgba(255,255,255,0.11)',
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            left: 38,
            top: 38,
            width: 48,
            height: 48,
            background:
              'radial-gradient(circle at 36% 30%, #e2edf4, #77838c 26%, #252a30 58%, #030304 100%)',
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow:
              '0 12px 18px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.32)',
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            left: 52,
            top: 52,
            width: 20,
            height: 20,
            background:
              'radial-gradient(circle at 38% 30%, #101216, #030304 65%)',
            boxShadow:
              'inset 0 0 0 2px rgba(255,255,255,0.14), 0 5px 12px rgba(0,0,0,0.68)',
          }}
        />
      </span>

      <span
        className="absolute pointer-events-none"
        style={{
          left: 485,
          top: 244,
          width: 42,
          height: 52,
          zIndex: 22,
        }}
      >
        <span
          className="absolute left-[18px] top-[8px] h-[35px] w-[7px] rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #111318, #757d85 48%, #15171b)',
            boxShadow:
              '0 8px 12px rgba(0,0,0,0.45), inset 1px 0 2px rgba(255,255,255,0.18)',
          }}
        />
        <span
          className="absolute left-[8px] top-[30px] h-[13px] w-[27px] rounded-[5px]"
          style={{
            background:
              'linear-gradient(180deg, #252933, #06070a)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 12px rgba(0,0,0,0.52)',
          }}
        />
      </span>

      <span
        className="absolute"
        style={{
          right: 36,
          top: 142,
          width: 84,
          height: 166,
          borderRadius: 18,
          zIndex: 18,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01) 35%, rgba(0,0,0,0.25)), rgba(0,0,0,0.16)',
          border: '1px solid rgba(255,255,255,0.045)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 18px rgba(0,0,0,0.28)',
        }}
      />

      <span
        className="absolute flex items-center justify-center gap-2"
        style={{
          left: 386,
          top: 278,
          width: 88,
          height: 34,
          borderRadius: 999,
          zIndex: 26,
          background: !hasPlayableTrack
            ? 'linear-gradient(180deg, rgba(28,31,36,0.96), rgba(4,5,7,0.96))'
            : isTurntablePlaying
            ? 'linear-gradient(180deg, rgba(255,42,170,0.34), rgba(32,4,22,0.96))'
            : 'linear-gradient(180deg, rgba(16,36,42,0.98), rgba(3,7,10,0.96))',
          border: !hasPlayableTrack
            ? '1px solid rgba(255,255,255,0.16)'
            : isTurntablePlaying
            ? '1px solid rgba(255,105,200,0.55)'
            : '1px solid rgba(0,229,255,0.46)',
          boxShadow: !hasPlayableTrack
            ? '0 10px 18px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -8px 14px rgba(0,0,0,0.52)'
            : isTurntablePlaying
            ? '0 10px 18px rgba(0,0,0,0.48), 0 0 18px rgba(255,0,170,0.34), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -8px 14px rgba(0,0,0,0.4)'
            : '0 10px 18px rgba(0,0,0,0.48), 0 0 16px rgba(0,229,255,0.24), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -8px 14px rgba(0,0,0,0.5)',
        }}
      >
        <span
          className="flex items-center justify-center rounded-full"
          style={{
            width: 17,
            height: 17,
            background: !hasPlayableTrack
              ? 'radial-gradient(circle at 38% 30%, #8b929a, #353a42 48%, #050608 100%)'
              : isTurntablePlaying
              ? 'radial-gradient(circle at 38% 30%, #ffd8f3, #ff2aa9 45%, #260414 100%)'
              : 'radial-gradient(circle at 38% 30%, #d9fbff, #00d8ff 45%, #04161b 100%)',
            color: '#050608',
            boxShadow: !hasPlayableTrack
              ? 'inset 0 1px 2px rgba(255,255,255,0.28)'
              : isTurntablePlaying
              ? '0 0 10px rgba(255,0,170,0.7), inset 0 1px 2px rgba(255,255,255,0.55)'
              : '0 0 10px rgba(0,229,255,0.68), inset 0 1px 2px rgba(255,255,255,0.55)',
            flex: '0 0 auto',
          }}
        >
          {isTurntablePlaying ? <Pause size={10} strokeWidth={3} /> : <Play size={10} fill="currentColor" strokeWidth={3} />}
        </span>
        <span
          style={{
            color: !hasPlayableTrack ? 'rgba(255,255,255,0.52)' : isTurntablePlaying ? '#ffd7ef' : '#c9fbff',
            fontSize: 9,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '0.08em',
            textShadow: !hasPlayableTrack
              ? 'none'
              : isTurntablePlaying
              ? '0 0 7px rgba(255,0,170,0.62)'
              : '0 0 7px rgba(0,229,255,0.62)',
          }}
        >
          {!hasPlayableTrack ? 'NO AUDIO' : isTurntablePlaying ? 'PAUSE' : 'START'}
        </span>
      </span>

      <motion.span
        className="absolute pointer-events-none"
        initial={false}
        animate={{
          rotate: tonearmRotation,
          y: isTurntablePlaying ? 0 : -3,
        }}
        transition={{
          rotate: { duration: isTurntablePlaying ? 1.25 : 0.9, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 0.35, ease: 'easeOut', delay: isTurntablePlaying ? 0.58 : 0 },
        }}
        style={{
          left: PIVOT_X - TONEARM_PIVOT_X,
          top: PIVOT_Y - TONEARM_PIVOT_Y,
          width: 190,
          height: 264,
          transformOrigin: `${TONEARM_PIVOT_X}px ${TONEARM_PIVOT_Y}px`,
          zIndex: 30,
        }}
      >
        <svg
          width="190"
          height="264"
          viewBox="0 0 190 264"
          aria-hidden="true"
          style={{ overflow: 'visible', filter: 'drop-shadow(8px 14px 12px rgba(0,0,0,0.6))' }}
        >
          <defs>
            <linearGradient id="armTubeChrome" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#f9fdff" />
              <stop offset="20%" stopColor="#c4ced6" />
              <stop offset="44%" stopColor="#57616b" />
              <stop offset="58%" stopColor="#171b20" />
              <stop offset="78%" stopColor="#e7f1f7" />
              <stop offset="100%" stopColor="#5c6670" />
            </linearGradient>
            <linearGradient id="armTubeHighlight" x1="0" x2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="48%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <linearGradient id="counterweightChrome" x1="0" x2="1">
              <stop offset="0%" stopColor="#22262d" />
              <stop offset="22%" stopColor="#aab5bd" />
              <stop offset="43%" stopColor="#39414a" />
              <stop offset="65%" stopColor="#111318" />
              <stop offset="100%" stopColor="#737e87" />
            </linearGradient>
            <linearGradient id="headshellBody" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#3c424b" />
              <stop offset="52%" stopColor="#11151b" />
              <stop offset="100%" stopColor="#030405" />
            </linearGradient>
            <linearGradient id="cartridgeBody" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#262a31" />
              <stop offset="100%" stopColor="#050608" />
            </linearGradient>
          </defs>

          <path
            d="M23 55 H52"
            fill="none"
            stroke="rgba(0,0,0,0.62)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M23 55 H52"
            fill="none"
            stroke="url(#counterweightChrome)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <ellipse
            cx="20"
            cy="55"
            rx="19"
            ry="17"
            fill="url(#counterweightChrome)"
            stroke="rgba(255,255,255,0.20)"
            strokeWidth="1.2"
          />
          <path
            d="M11 39 V71 M18 38 V72 M25 40 V70"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="1"
          />

          <path
            d="M58 56 C76 73 96 101 105 132 C114 166 108 194 122 216"
            fill="none"
            stroke="rgba(0,0,0,0.58)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M58 56 C76 73 96 101 105 132 C114 166 108 194 122 216"
            fill="none"
            stroke="url(#armTubeChrome)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M62 58 C79 76 97 102 105 133 C111 160 108 190 120 212"
            fill="none"
            stroke="url(#armTubeHighlight)"
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.78"
          />
          <circle
            cx="58"
            cy="56"
            r="17"
            fill="#06070a"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
          />
          <circle
            cx="58"
            cy="56"
            r="8"
            fill="url(#armTubeChrome)"
            stroke="rgba(0,0,0,0.48)"
            strokeWidth="1"
          />
          <path
            d="M47 44 C54 39 64 39 70 45"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          <g transform="translate(100 202) rotate(20)">
            <path
              d="M1 4 L43 1 C49 1 55 5 56 11 L60 29 C61 34 57 38 52 37 L6 30 C2 29 0 26 0 22 Z"
              fill="rgba(0,0,0,0.52)"
              transform="translate(3 5)"
              opacity="0.75"
            />
            <path
              d="M0 3 L42 0 C48 0 54 4 55 10 L59 28 C60 33 56 37 51 36 L5 29 C1 28 -1 25 -1 21 Z"
              fill="url(#headshellBody)"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.2"
            />
            <path
              d="M6 7 L46 5"
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="15" cy="17" r="3.5" fill="#06070a" stroke="rgba(255,255,255,0.32)" />
            <circle cx="31" cy="16" r="3.5" fill="#06070a" stroke="rgba(255,255,255,0.32)" />
            <rect
              x="37"
              y="24"
              width="23"
              height="14"
              rx="3"
              fill="url(#cartridgeBody)"
              stroke="rgba(255,255,255,0.20)"
            />
            <path
              d="M44 37 L56 47"
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M55 46 L62 51"
              stroke={isTurntablePlaying ? '#e8f8ff' : '#9aa0a7'}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity={isTurntablePlaying ? 1 : 0.55}
            />
            <circle
              cx="63"
              cy="52"
              r="1.8"
              fill={isTurntablePlaying ? '#f4fbff' : '#7f858c'}
              opacity={isTurntablePlaying ? 1 : 0.65}
            />
          </g>
        </svg>
      </motion.span>

      <span
        className="absolute rounded-full"
        style={{
          right: 54,
          top: 154,
          width: 36,
          height: 36,
          zIndex: 23,
          background:
            'conic-gradient(from 10deg, #1b1d22, #838b92, #17191d, #d8e1e7, #1b1d22)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 8px 14px rgba(0,0,0,0.55)',
        }}
      >
        <span
          className="absolute inset-[8px] rounded-full"
          style={{ background: '#070709', boxShadow: 'inset 0 0 5px rgba(0,0,0,0.8)' }}
        />
      </span>

      <span
        className="absolute flex items-center gap-2 overflow-hidden"
        style={{
          left: 380,
          bottom: 26,
          width: 142,
          minHeight: 32,
          padding: '7px 10px',
          borderRadius: 8,
          background:
            'linear-gradient(180deg, rgba(4,8,10,0.92), rgba(0,0,0,0.78))',
          border: '1px solid rgba(122,238,255,0.16)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 16px rgba(0,0,0,0.46), 0 8px 16px rgba(0,0,0,0.34)',
          backdropFilter: 'blur(10px)',
          opacity: displayTrack ? 1 : 0.52,
          zIndex: 20,
        }}
      >
        <span
          className="rounded-full"
          style={{
            width: 7,
            height: 7,
            background: isTurntablePlaying ? '#00e5ff' : 'rgba(255,255,255,0.24)',
            boxShadow: isTurntablePlaying
              ? '0 0 8px rgba(0,229,255,0.9), 0 0 14px rgba(255,0,170,0.32)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
            flex: '0 0 auto',
          }}
        />
        <span className="min-w-0">
          <span
            className="block truncate"
            style={{
              color: isTurntablePlaying ? '#b8fbff' : 'rgba(248,251,255,0.72)',
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {displayTrack?.title ?? 'No featured track'}
          </span>
          <span
            className="block truncate"
            style={{
              color: isTurntablePlaying ? '#ff83d4' : 'rgba(255,255,255,0.36)',
              fontSize: 8,
              fontWeight: 600,
              lineHeight: 1.15,
              marginTop: 2,
            }}
          >
            {displayTrack?.artist ?? 'Upload audio to cue the deck'}
          </span>
        </span>
      </span>

      <span
        className="absolute left-10 bottom-[-8px] h-4 w-28 rounded-full"
        style={{ background: 'rgba(0,0,0,0.68)', filter: 'blur(8px)' }}
      />
      <span
        className="absolute right-12 bottom-[-8px] h-4 w-32 rounded-full"
        style={{ background: 'rgba(0,0,0,0.68)', filter: 'blur(8px)' }}
      />
    </button>
  );
}
