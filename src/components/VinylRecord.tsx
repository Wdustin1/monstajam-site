'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export default function VinylRecord() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [anisotropyShift, setAnisotropyShift] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(true);

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

      {/* Neon halo (drift-animated glow behind disc) */}
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

      {/* Outer magenta glow ring */}
      <div className="absolute pointer-events-none" style={{
        inset: -10,
        borderRadius: '50%',
        border: '2px solid rgba(255,0,170,0.5)',
        boxShadow: '0 0 25px rgba(255,0,170,0.4), inset 0 0 10px rgba(255,0,170,0.2)',
        zIndex: 1,
      }} />

      {/* 3D-tilting vinyl disc wrapper */}
      <div
        className="absolute"
        style={{
          inset: 0,
          zIndex: 5,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Spinning disc */}
        <motion.div
          className="absolute inset-0 rounded-full overflow-hidden"
          animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
          transition={isPlaying ? { duration: 4, repeat: Infinity, ease: 'linear' } : { duration: 0.8 }}
          style={{
            background: '#040404',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,1), 0 0 0 10px rgba(255,255,255,0.015), inset 0 0 40px rgba(0,0,0,0.9)',
          }}
        >
          {/* Ultra-fine repeating-radial-gradient grooves */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-radial-gradient(circle at center, rgba(10,10,10,1) 0px, rgba(35,35,35,0.5) 0.5px, rgba(10,10,10,1) 1.5px)',
            opacity: 0.95,
          }} />

          {/* Conic anisotropic highlight — simulates vinyl's light-catching surface */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `conic-gradient(
                from 0deg at 50% 50%,
                transparent 0%,
                rgba(255,255,255,0.04) 10%,
                rgba(255,255,255,0.13) 15%,
                rgba(255,255,255,0.04) 20%,
                transparent 40%,
                rgba(0,240,255,0.03) 45%,
                transparent 55%,
                transparent 60%,
                rgba(255,255,255,0.04) 65%,
                rgba(255,255,255,0.13) 70%,
                rgba(255,255,255,0.04) 75%,
                transparent 100%
              )`,
              mixBlendMode: 'overlay',
              transform: `translate(${anisotropyShift.x}px, ${anisotropyShift.y}px)`,
              transition: 'transform 0.1s ease-out',
            }}
          />

          {/* Neon color reflection (magenta left, cyan right) */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `
              radial-gradient(circle at 10% 50%, rgba(255,0,170,0.18) 0%, transparent 60%),
              radial-gradient(circle at 90% 50%, rgba(0,240,255,0.18) 0%, transparent 60%)
            `,
            mixBlendMode: 'screen',
          }} />

          {/* Inner cyan surface ring */}
          <div className="absolute pointer-events-none" style={{
            inset: 15,
            borderRadius: '50%',
            border: '1px solid rgba(0,240,255,0.4)',
            boxShadow: '0 0 15px rgba(0,240,255,0.3), inset 0 0 15px rgba(0,240,255,0.3)',
          }} />

          {/* Center label */}
          <motion.div
            className="absolute flex flex-col items-center justify-center"
            style={{
              inset: '37%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at center, #1a1a1a 0%, #05000A 100%)',
              border: '2px solid #222',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,1), 0 0 30px rgba(0,240,255,0.1)',
              zIndex: 20,
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            {/* Play icon */}
            <svg width="18" height="20" viewBox="0 0 18 20" fill="rgba(0,240,255,0.9)" style={{ marginBottom: 4 }}>
              <path d="M1 1l16 9L1 19z"/>
            </svg>
            <span style={{ fontSize: 7, fontWeight: 900, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.15em', textAlign: 'center', lineHeight: 1.3 }}>
              LOST TAPES
            </span>
            <span style={{ fontSize: 6, color: 'rgba(136,130,145,0.8)', fontWeight: 700, letterSpacing: '0.12em', marginTop: 2 }}>
              VOL. 1 • 2024
            </span>
            {/* Pin hole */}
            <div style={{
              position: 'absolute', width: 8, height: 8, borderRadius: '50%',
              background: '#000', border: '1px solid rgba(255,255,255,0.15)',
            }} />
          </motion.div>
        </motion.div>

        {/* Clickable overlay (toggles play) */}
        <button
          onClick={() => setIsPlaying(p => !p)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full z-40 cursor-pointer bg-transparent"
          aria-label="Toggle playback"
        />
      </div>

      {/* Mechanical Tonearm — does NOT spin, sits above disc */}
      <div className="absolute pointer-events-none" style={{ top: 30, right: 10, width: 140, height: 420, zIndex: 30 }}>
        {/* Pivot base */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 70, height: 70, borderRadius: '50%',
          background: 'linear-gradient(145deg, #333, #0a0a0a)',
          border: '3px solid #1a1a1a',
          boxShadow: '0 15px 30px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 15, height: 15, background: '#111', borderRadius: '50%',
            boxShadow: 'inset 0 0 5px rgba(0,0,0,1)',
          }} />
        </div>

        {/* Counterweight */}
        <div style={{
          position: 'absolute', top: -10, right: 20,
          width: 30, height: 40, borderRadius: 4,
          background: 'linear-gradient(to right, #222, #444, #222)',
          border: '1px solid #111',
        }} />

        {/* Arm shaft — angled */}
        <div style={{
          position: 'absolute', top: 35, right: 30,
          width: 10, height: 340,
          background: 'linear-gradient(to right, #1a1a1a, #444, #1a1a1a)',
          borderRadius: 5,
          transformOrigin: 'top center',
          transform: 'rotate(22deg)',
          boxShadow: '6px 0 15px rgba(0,0,0,0.5)',
        }} />

        {/* Headshell / cartridge */}
        <div style={{
          position: 'absolute', bottom: 10, right: 18,
          width: 36, height: 60,
          background: 'linear-gradient(145deg, #1a1a1a, #050505)',
          borderRadius: '4px 4px 15px 15px',
          transform: 'rotate(-10deg)',
          boxShadow: '8px 8px 20px rgba(0,0,0,0.6)',
          borderBottom: '2px solid #00F0FF',
        }} />

        {/* Stylus needle */}
        <div style={{
          position: 'absolute', bottom: -2, right: 41,
          width: 2, height: 14,
          background: '#555',
          borderRadius: 1,
        }} />
      </div>

    </div>
  );
}
