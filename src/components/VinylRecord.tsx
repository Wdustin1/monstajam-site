'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePlayer, PlayerTrack } from '@/context/PlayerContext';

interface VinylRecordProps {
  featuredTrack?: PlayerTrack | null;
}

const DISC  = 520;
const R     = DISC / 2;  // 260
const LABEL = 160;

// Tonearm pivot: right side at (535, 90)
// ARM_LEN=185. At ANGLE_PLAY=-27°: needle lands ~191px from disc center = outer groove ✓
// At ANGLE_REST=+20°: arm parked right, clear of disc
const PIVOT_X    = 535;
const PIVOT_Y    = 90;
const ARM_LEN    = 185;
const ANGLE_REST = 20;
const ANGLE_PLAY = -27;

export default function VinylRecord({ featuredTrack }: VinylRecordProps) {
  const { currentTrack, isPlaying, toggle, play } = usePlayer();
  const displayTrack = currentTrack ?? featuredTrack ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const discControls   = useAnimation();

  // ── Spin ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      discControls.start({
        rotate: [0, 360],
        transition: { duration: 6, repeat: Infinity, ease: 'linear' },
      });
    } else {
      discControls.stop();
    }
  }, [isPlaying, discControls]);

  // ── 3D tilt on mouse ──────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => setTilt({
      x:  (window.innerHeight / 2 - e.pageY) / 70,
      y: -(window.innerWidth  / 2 - e.pageX) / 70,
    });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Needle tip world coords (for sparks)
  const toneAngle = isPlaying ? ANGLE_PLAY : ANGLE_REST;
  const rad = (toneAngle * Math.PI) / 180;
  const needleX = PIVOT_X + ARM_LEN * Math.sin(rad);
  const needleY = PIVOT_Y + ARM_LEN * Math.cos(rad);

  const handleToggle = () => {
    if (currentTrack) toggle(currentTrack);
    else if (featuredTrack) play(featuredTrack);
  };

  return (
    // Container: disc (520) + space for tonearm pivot (120)
    <div ref={containerRef} className="relative select-none"
      style={{ width: DISC + 120, height: DISC }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* ── Outer glow halo ──────────────────────────────────────── */}
      <motion.div className="absolute pointer-events-none" style={{
        left: 0, top: 0, width: DISC, height: DISC,
        borderRadius: '50%', zIndex: 0,
        filter: 'blur(60px)',
        background: 'radial-gradient(circle at center, transparent 28%, rgba(120,0,255,0.28) 48%, rgba(0,180,255,0.20) 68%, transparent 100%)',
      }}
        animate={{ scale: [1, 1.10, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Ambient sparkles ─────────────────────────────────────── */}
      {[
        { top: '5%',  left: '6%',  size: 3, delay: 0.0 },
        { top: '11%', left: '58%', size: 2, delay: 0.5 },
        { top: '79%', left: '63%', size: 3, delay: 1.0 },
        { top: '87%', left: '7%',  size: 2, delay: 1.4 },
        { top: '50%', left: '1%',  size: 2, delay: 0.8 },
        { top: '92%', left: '43%', size: 2, delay: 0.3 },
        { top: '2%',  left: '38%', size: 2, delay: 1.2 },
      ].map((s, i) => (
        <motion.div key={`sp-${i}`} className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, zIndex: 0 }}
          animate={{ opacity: [0.1, 1, 0.1], scale: [0.6, 1.8, 0.6] }}
          transition={{ duration: 2.8, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* ── 3D tilt wrapper (disc only — NOT button, to avoid pointer-event issues) */}
      <div className="absolute" style={{
        left: 0, top: 0, width: DISC, height: DISC,
        zIndex: 10,
        transformStyle: 'preserve-3d',
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.12s ease-out',
      }}>
        {/* ── Spinning vinyl disc ──────────────────────────────── */}
        <motion.div
          animate={discControls}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            cursor: 'default',
            overflow: 'hidden',
            background: '#080808',
          }}
        >
          {/* Groove base */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            background: `repeating-radial-gradient(
              circle at center,
              #0a0a0a 0px,
              #141414 1.5px,
              #0a0a0a 3px,
              #181818 4.5px,
              #0a0a0a 6px
            )`,
          }} />

          {/* Iridescent diffraction band */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            background: `conic-gradient(
              from 200deg at 42% 38%,
              transparent 0%,
              rgba(80,0,160,0.18)   8%,
              rgba(0,120,255,0.22) 14%,
              rgba(0,200,180,0.18) 20%,
              rgba(80,0,160,0.14) 26%,
              transparent          34%,
              transparent          60%,
              rgba(0,80,200,0.10)  68%,
              rgba(120,0,200,0.14) 74%,
              transparent          82%,
              transparent          100%
            )`,
            mixBlendMode: 'screen',
          }} />

          {/* Second iridescent sweep */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            background: `conic-gradient(
              from 340deg at 58% 62%,
              transparent 0%,
              rgba(0,160,255,0.10) 10%,
              rgba(80,0,180,0.16)  18%,
              rgba(0,220,200,0.12) 24%,
              transparent          34%,
              transparent          100%
            )`,
            mixBlendMode: 'screen',
          }} />

          {/* Specular highlight top-left */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            background: `radial-gradient(
              ellipse 55% 28% at 28% 22%,
              rgba(255,255,255,0.12) 0%,
              rgba(255,255,255,0.04) 50%,
              transparent 100%
            )`,
          }} />

          {/* Specular bottom-right */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            background: `radial-gradient(
              ellipse 40% 20% at 75% 80%,
              rgba(180,100,255,0.08) 0%,
              transparent 100%
            )`,
          }} />

          {/* Edge vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            background: `radial-gradient(
              circle at center,
              transparent 55%,
              rgba(0,0,0,0.55) 80%,
              rgba(0,0,0,0.88) 100%
            )`,
          }} />

          {/* Chrome rim */}
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: '50%',
            boxShadow: `
              inset 0 0 0 3px rgba(255,255,255,0.06),
              inset 0 0 0 6px rgba(0,0,0,0.4),
              0 0 40px rgba(0,0,0,0.9)
            `,
          }} />

          {/* Lead-in zone near label */}
          <div className="absolute pointer-events-none" style={{
            width: LABEL + 48, height: LABEL + 48,
            borderRadius: '50%',
            top: R - (LABEL + 48) / 2,
            left: R - (LABEL + 48) / 2,
            background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 100%)',
            boxShadow: `0 0 0 2px rgba(255,255,255,0.04)`,
          }} />

          {/* Center label */}
          <div style={{
            position: 'absolute',
            width: LABEL, height: LABEL,
            borderRadius: '50%',
            top: R - LABEL / 2, left: R - LABEL / 2,
            overflow: 'hidden',
            boxShadow: `
              0 0 0 3px rgba(255,255,255,0.09),
              0 0 0 6px rgba(0,0,0,0.6),
              0 0 30px rgba(0,0,0,0.95)
            `,
          }}>
            <Image src="/monstajam-logo.png" alt="Monsta Jam Productions"
              width={LABEL} height={LABEL}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
              priority
            />
          </div>

          {/* Spindle hole */}
          <div style={{
            position: 'absolute',
            width: 11, height: 11, borderRadius: '50%',
            top: R - 5.5, left: R - 5.5,
            background: 'radial-gradient(circle, #020202, #111)',
            boxShadow: 'inset 0 0 6px rgba(0,0,0,1)',
            zIndex: 5,
          }} />
        </motion.div>

        {/* Track badge */}
        {isPlaying && displayTrack && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              bottom: '13%', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.80)',
              border: '1px solid rgba(255,0,170,0.45)',
              borderRadius: 20, padding: '3px 12px',
              zIndex: 25, whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.09em' }}>
              {displayTrack.title.toUpperCase()}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Play / Pause ── OUTSIDE preserve-3d wrapper so pointer events work */}
      <button
        onClick={handleToggle}
        style={{
          position: 'absolute',
          top: R - 26, left: R - 26,
          width: 52, height: 52, borderRadius: '50%',
          background: isPlaying ? 'rgba(255,0,170,0.20)' : 'rgba(0,220,255,0.16)',
          border: `2px solid ${isPlaying ? 'rgba(255,0,170,0.75)' : 'rgba(0,220,255,0.65)'}`,
          boxShadow: isPlaying
            ? '0 0 24px rgba(255,0,170,0.65), inset 0 0 12px rgba(255,0,170,0.18)'
            : '0 0 24px rgba(0,220,255,0.50), inset 0 0 12px rgba(0,220,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 30,
          backdropFilter: 'blur(6px)',
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.25s ease, box-shadow 0.3s ease, background 0.3s ease',
        }}
      >
        {isPlaying
          ? <svg width="13" height="15" viewBox="0 0 14 16" fill="white"><rect x="1" y="0" width="4" height="16" rx="1.5"/><rect x="9" y="0" width="4" height="16" rx="1.5"/></svg>
          : <svg width="13" height="15" viewBox="0 0 14 16" fill="white" style={{ marginLeft: 2 }}><path d="M1 0l13 8-13 8z"/></svg>
        }
      </button>

      {/* ── Tonearm ──────────────────────────────────────────────── */}
      {/* Tonearm — pure CSS transition, no FM arc-direction bug */}
      <div
        className="absolute pointer-events-none"
        style={{
          top:  PIVOT_Y,
          left: PIVOT_X - 5,
          width: 10,
          height: ARM_LEN,
          transformOrigin: '50% 0%',
          zIndex: 40,
          transform: `rotate(${isPlaying ? ANGLE_REST : ANGLE_PLAY}deg)`,
          transition: 'transform 1.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Shaft */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: 10, height: ARM_LEN - 40,
          background: 'linear-gradient(to right, #0e0e0e, #505050, #3a3a3a, #0e0e0e)',
          borderRadius: 5,
          boxShadow: '3px 0 12px rgba(0,0,0,0.7), -1px 0 4px rgba(255,255,255,0.04)',
        }} />
        {/* Headshell */}
        <div style={{
          position: 'absolute',
          top: ARM_LEN - 50,
          left: -8,
          width: 26, height: 46,
          background: 'linear-gradient(160deg, #1a1a1a 0%, #070707 100%)',
          borderRadius: '3px 3px 10px 10px',
          boxShadow: '4px 4px 14px rgba(0,0,0,0.75)',
          borderBottom: '2px solid rgba(0,240,255,0.6)',
        }} />
        {/* LED */}
        <div style={{
          position: 'absolute',
          top: ARM_LEN - 44,
          left: 12,
          width: 6, height: 6, borderRadius: '50%',
          background: isPlaying ? '#00F0FF' : '#1c1c1c',
          boxShadow: isPlaying ? '0 0 8px #00F0FF, 0 0 20px rgba(0,240,255,0.7)' : 'none',
          transition: 'background 0.4s, box-shadow 0.4s',
        }} />
        {/* Stylus */}
        <div style={{
          position: 'absolute',
          top: ARM_LEN - 6,
          left: 2,
          width: 2, height: 14,
          background: 'linear-gradient(to bottom, #606060, #222)',
          borderRadius: 1,
        }} />
      </div>

      {/* Pivot base cap */}
      <div className="absolute pointer-events-none" style={{
        top:  PIVOT_Y - 28,
        left: PIVOT_X - 28,
        width: 56, height: 56, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #3a3a3a, #080808)',
        border: '2px solid rgba(255,255,255,0.06)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.9), inset 0 2px 4px rgba(255,255,255,0.06)',
        zIndex: 45,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute',
          bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 2,
          width: 18, height: 26, borderRadius: 3,
          background: 'linear-gradient(to right, #1c1c1c, #444, #1c1c1c)',
          border: '1px solid #080808',
        }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#040404', boxShadow: 'inset 0 0 6px black' }} />
      </div>

      {/* ── Needle sparks when playing ────────────────────────────── */}
      {isPlaying && [
        { dx: -3, dy: 2,  rot: 50,  delay: 0    },
        { dx:  3, dy: 5,  rot: 70,  delay: 0.13 },
        { dx:  0, dy: -3, rot: 30,  delay: 0.26 },
      ].map((s, i) => (
        <motion.div key={`spark-${i}`} className="absolute pointer-events-none" style={{
          top: needleY + s.dy, left: needleX + s.dx,
          width: 2, height: 10,
          background: 'linear-gradient(to bottom, #ffe844, rgba(255,100,0,0))',
          rotate: s.rot, zIndex: 50, borderRadius: 2,
        }}
          animate={{ opacity: [0, 1, 0], scaleY: [0.5, 1.7, 0.5], y: [0, 5, 0] }}
          transition={{ duration: 0.32, repeat: Infinity, delay: s.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
