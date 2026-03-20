'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';

export default function VinylRecord() {
  const { currentTrack, isPlaying, toggle } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [anisotropyShift, setAnisotropyShift] = useState({ x: 0, y: 0 });

  const discControls = useAnimation();
  const labelControls = useAnimation();

  // Drive spin via useAnimation so toggling between infinite/stopped works correctly
  useEffect(() => {
    if (isPlaying) {
      discControls.start({
        rotate: 360,
        transition: { duration: 4, repeat: Infinity, ease: 'linear' },
      });
      labelControls.start({
        rotate: -360,
        transition: { duration: 4, repeat: Infinity, ease: 'linear' },
      });
    } else {
      discControls.stop();
      labelControls.stop();
    }
  }, [isPlaying, discControls, labelControls]);

  // Mouse tilt effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 50;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 50;
      setTilt({ x: yAxis, y: xAxis });
      setAnisotropyShift({ x: xAxis * 2, y: yAxis * 2 });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const tonearmAngle = isPlaying ? 24 : 8;
  const trackTitle = currentTrack?.title ?? 'LOST TAPES';
  const trackArtist = currentTrack?.artist ?? null;

  return (
    <div ref={containerRef} className="relative select-none" style={{ width: 520, height: 520 }}>

      {/* Sparkle particles */}
      {[
        { top: '6%',  left: '14%', size: 3, delay: 0 },
        { top: '15%', left: '84%', size: 2, delay: 0.4 },
        { top: '70%', left: '90%', size: 3, delay: 0.9 },
        { top: '87%', left: '12%', size: 2, delay: 1.3 },
        { top: '44%', left: '3%',  size: 2, delay: 0.7 },
        { top: '28%', left: '94%', size: 3, delay: 1.6 },
        { top: '93%', left: '56%', size: 2, delay: 0.2 },
        { top: '4%',  left: '52%', size: 2, delay: 1.1 },
      ].map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* Neon halo drift */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          filter: 'blur(40px)',
          background: 'radial-gradient(circle at center, transparent 38%, rgba(255,0,170,0.18) 52%, rgba(0,240,255,0.15) 68%, transparent 100%)',
          zIndex: 0,
        }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.6, 0.85, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Outer magenta ring */}
      <div className="absolute pointer-events-none" style={{
        inset: -10, borderRadius: '50%',
        border: '2px solid rgba(255,0,170,0.5)',
        boxShadow: '0 0 25px rgba(255,0,170,0.4), inset 0 0 10px rgba(255,0,170,0.2)',
        zIndex: 1,
      }} />

      {/* 3D tilt wrapper */}
      <div
        className="absolute"
        style={{
          inset: 0, zIndex: 5,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* ── Spinning disc ── */}
        <motion.div
          className="absolute inset-0 rounded-full overflow-hidden"
          animate={discControls}
          style={{
            background: '#040404',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,1), 0 0 0 10px rgba(255,255,255,0.015), inset 0 0 40px rgba(0,0,0,0.9)',
          }}
        >
          {/* ── Ultra-fine repeating-radial grooves (base layer) ── */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-radial-gradient(circle at center, rgba(8,8,8,1) 0px, rgba(40,40,40,0.6) 0.8px, rgba(8,8,8,1) 2px)',
            opacity: 1,
          }} />

          {/* ── Visible groove rings — concentric bands at key radii ── */}
          {[
            { inset: 28,  opacity: 0.18 },
            { inset: 44,  opacity: 0.13 },
            { inset: 60,  opacity: 0.16 },
            { inset: 76,  opacity: 0.11 },
            { inset: 92,  opacity: 0.15 },
            { inset: 108, opacity: 0.12 },
            { inset: 124, opacity: 0.17 },
            { inset: 140, opacity: 0.10 },
            { inset: 155, opacity: 0.14 },
            { inset: 168, opacity: 0.09 },
          ].map((g, i) => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{
              inset: g.inset,
              border: `1px solid rgba(255,255,255,${g.opacity})`,
              boxShadow: `0 0 1px rgba(255,255,255,${g.opacity * 0.5})`,
            }} />
          ))}

          {/* ── Slightly wider grooves in the playable area band ── */}
          {[38, 54, 70, 86, 102, 118, 134, 150].map((inset, i) => (
            <div key={`w${i}`} className="absolute rounded-full pointer-events-none" style={{
              inset,
              border: '1px solid rgba(255,255,255,0.06)',
            }} />
          ))}

          {/* ── Anisotropic conic highlight ── */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `conic-gradient(
              from 0deg at 50% 50%,
              transparent 0%, rgba(255,255,255,0.04) 10%, rgba(255,255,255,0.14) 15%,
              rgba(255,255,255,0.04) 20%, transparent 40%, rgba(0,240,255,0.04) 45%,
              transparent 55%, transparent 60%, rgba(255,255,255,0.04) 65%,
              rgba(255,255,255,0.14) 70%, rgba(255,255,255,0.04) 75%, transparent 100%
            )`,
            mixBlendMode: 'overlay',
            transform: `translate(${anisotropyShift.x}px, ${anisotropyShift.y}px)`,
            transition: 'transform 0.1s ease-out',
          }} />

          {/* ── Neon color reflections ── */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(circle at 10% 50%, rgba(255,0,170,0.18) 0%, transparent 60%),
                         radial-gradient(circle at 90% 50%, rgba(0,240,255,0.18) 0%, transparent 60%)`,
            mixBlendMode: 'screen',
          }} />

          {/* ── Inner cyan surface ring ── */}
          <div className="absolute pointer-events-none" style={{
            inset: 15, borderRadius: '50%',
            border: '1px solid rgba(0,240,255,0.4)',
            boxShadow: '0 0 15px rgba(0,240,255,0.3), inset 0 0 15px rgba(0,240,255,0.3)',
          }} />

          {/* ── Center label — counter-rotates to stay readable ── */}
          <motion.div
            className="absolute flex flex-col items-center justify-center overflow-hidden"
            animate={labelControls}
            style={{
              inset: '34%', borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, #1e1025, #05000A)',
              border: '2px solid rgba(255,0,170,0.25)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,1), 0 0 30px rgba(0,240,255,0.12)',
              zIndex: 20,
              cursor: 'pointer',
            }}
            onClick={() => currentTrack && toggle(currentTrack)}
          >
            {/* Play/Pause icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full mb-1"
              style={{
                background: isPlaying ? 'rgba(255,0,170,0.2)' : 'rgba(0,229,255,0.15)',
                border: `1px solid ${isPlaying ? 'rgba(255,0,170,0.5)' : 'rgba(0,229,255,0.4)'}`,
              }}>
              {isPlaying ? (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
                  <rect x="1" y="0" width="3" height="12" rx="1"/>
                  <rect x="6" y="0" width="3" height="12" rx="1"/>
                </svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
                  <path d="M1 0l9 6-9 6z"/>
                </svg>
              )}
            </div>

            {/* Track name */}
            <span style={{
              fontSize: 7, fontWeight: 900,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '0.1em', textAlign: 'center',
              lineHeight: 1.3, padding: '0 6px',
              maxWidth: '100%', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {trackTitle.toUpperCase()}
            </span>

            {trackArtist ? (
              <span style={{
                fontSize: 5.5, color: 'rgba(0,240,255,0.7)',
                letterSpacing: '0.1em', marginTop: 2,
                padding: '0 4px', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {trackArtist}
              </span>
            ) : (
              <span style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginTop: 2 }}>
                VOL. 1 • 2024
              </span>
            )}

            {/* Pin hole */}
            <div style={{
              position: 'absolute', width: 6, height: 6, borderRadius: '50%',
              background: '#000', border: '1px solid rgba(255,255,255,0.12)',
            }} />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Mechanical Tonearm ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: 20, right: 0, width: 140, height: 420, zIndex: 30, transformOrigin: '82% 10%' }}
        animate={{ rotate: tonearmAngle }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Pivot base */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 70, height: 70, borderRadius: '50%',
          background: 'linear-gradient(145deg, #333, #0a0a0a)',
          border: '3px solid #1a1a1a',
          boxShadow: '0 15px 30px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 14, height: 14, background: '#111', borderRadius: '50%', boxShadow: 'inset 0 0 5px rgba(0,0,0,1)' }} />
        </div>

        {/* Counterweight */}
        <div style={{
          position: 'absolute', top: -8, right: 21,
          width: 28, height: 38, borderRadius: 4,
          background: 'linear-gradient(to right, #222, #444, #222)',
          border: '1px solid #111',
        }} />

        {/* Arm shaft */}
        <div style={{
          position: 'absolute', top: 34, right: 30,
          width: 10, height: 340,
          background: 'linear-gradient(to right, #1a1a1a, #555, #1a1a1a)',
          borderRadius: 5,
          boxShadow: '6px 0 15px rgba(0,0,0,0.5)',
        }} />

        {/* Headshell */}
        <div style={{
          position: 'absolute', bottom: 8, right: 17,
          width: 36, height: 58,
          background: 'linear-gradient(145deg, #1a1a1a, #050505)',
          borderRadius: '4px 4px 15px 15px',
          transform: 'rotate(-10deg)',
          boxShadow: '8px 8px 20px rgba(0,0,0,0.6)',
          borderBottom: '2px solid #00F0FF',
        }} />

        {/* Stylus needle */}
        <div style={{
          position: 'absolute', bottom: -2, right: 40,
          width: 2, height: 14,
          background: '#555', borderRadius: 1,
        }} />

        {/* LED on headshell when playing */}
        {isPlaying && (
          <div style={{
            position: 'absolute', bottom: 12, right: 14,
            width: 6, height: 6, borderRadius: '50%',
            background: '#00F0FF',
            boxShadow: '0 0 8px #00F0FF, 0 0 16px rgba(0,240,255,0.6)',
          }} />
        )}
      </motion.div>

    </div>
  );
}
