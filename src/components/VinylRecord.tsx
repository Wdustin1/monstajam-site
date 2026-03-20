'use client';

import { motion } from 'framer-motion';

export default function VinylRecord() {
  return (
    <div className="relative select-none" style={{ width: 460, height: 460 }}>

      {/* ── Ambient glow blobs behind the disc ── */}
      <div className="absolute" style={{
        inset: -40,
        background: 'radial-gradient(ellipse at 40% 60%, rgba(255,0,255,0.25) 0%, transparent 65%), radial-gradient(ellipse at 65% 35%, rgba(0,255,255,0.2) 0%, transparent 65%)',
        filter: 'blur(20px)',
        borderRadius: '50%',
      }} />

      {/* ── Sparkle particles ── */}
      {[
        { top: '8%',  left: '12%', size: 3, delay: 0 },
        { top: '18%', left: '82%', size: 2, delay: 0.4 },
        { top: '72%', left: '88%', size: 3, delay: 0.9 },
        { top: '85%', left: '15%', size: 2, delay: 1.3 },
        { top: '45%', left: '4%',  size: 2, delay: 0.7 },
        { top: '30%', left: '93%', size: 3, delay: 1.6 },
        { top: '92%', left: '55%', size: 2, delay: 0.2 },
        { top: '5%',  left: '55%', size: 2, delay: 1.1 },
      ].map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* ── Outer neon glow ring (cyan → magenta) ── */}
      <div className="absolute inset-0 rounded-full" style={{
        background: 'conic-gradient(from 180deg, #00ffff, #8800ff, #ff00ff, #ff0088, #00ffff)',
        padding: 4,
        borderRadius: '50%',
      }}>
        <div className="w-full h-full rounded-full" style={{ background: '#050505' }} />
      </div>

      {/* ── The spinning disc ── */}
      <motion.div
        className="absolute"
        style={{ inset: 4, borderRadius: '50%' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      >
        {/* Base vinyl — very dark with subtle warm tint */}
        <div className="w-full h-full rounded-full" style={{
          background: 'radial-gradient(circle at 48% 45%, #1a1015 0%, #0a080a 60%, #050505 100%)',
        }}>

          {/* Groove rings — lots of them for density */}
          {Array.from({ length: 22 }, (_, i) => {
            const inset = 6 + i * 8;
            const alpha = 0.06 + (i % 3) * 0.04;
            return (
              <div key={i} className="absolute rounded-full" style={{
                inset,
                border: `1px solid rgba(255,255,255,${alpha})`,
              }} />
            );
          })}

          {/* Rainbow prismatic reflection band across upper-left */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div style={{
              position: 'absolute',
              top: '5%', left: '-10%',
              width: '65%', height: '45%',
              background: 'linear-gradient(135deg, rgba(255,0,200,0.18) 0%, rgba(150,0,255,0.15) 30%, rgba(0,180,255,0.1) 60%, transparent 100%)',
              borderRadius: '50%',
              filter: 'blur(8px)',
              transform: 'rotate(-20deg)',
            }} />
            {/* Second highlight band */}
            <div style={{
              position: 'absolute',
              top: '20%', left: '5%',
              width: '40%', height: '20%',
              background: 'linear-gradient(120deg, rgba(255,180,255,0.12) 0%, rgba(100,220,255,0.1) 50%, transparent 100%)',
              borderRadius: '60%',
              filter: 'blur(6px)',
              transform: 'rotate(-15deg)',
            }} />
          </div>

          {/* Center label */}
          <motion.div
            className="absolute rounded-full flex flex-col items-center justify-center gap-1"
            style={{
              inset: '37%',
              background: 'radial-gradient(circle at 40% 40%, #2a1535, #150d20)',
              border: '1px solid rgba(255,0,255,0.3)',
              boxShadow: '0 0 20px rgba(255,0,255,0.15), inset 0 0 10px rgba(0,0,0,0.5)',
              zIndex: 10,
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          >
            {/* Play button */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
                <path d="M1 1l8 5-8 5z" />
              </svg>
            </div>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#e0aaff', letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.2, padding: '0 4px' }}>
              LOST TAPES<br />VOL. 1
            </span>
            <span style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 }}>
              Various Artists
            </span>
            {/* Center pin hole */}
            <div style={{
              position: 'absolute', width: 5, height: 5, borderRadius: '50%',
              background: '#000', border: '1px solid rgba(255,255,255,0.2)',
              bottom: 8,
            }} />
          </motion.div>

        </div>
      </motion.div>

      {/* ── Tonearm (does NOT spin) ── */}
      <div className="absolute" style={{ top: 14, right: 20, width: 80, height: 180, zIndex: 20 }}>
        {/* Pivot base */}
        <div style={{
          position: 'absolute', top: 0, right: 4,
          width: 22, height: 22, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #888, #333)',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }} />
        {/* Counterweight */}
        <div style={{
          position: 'absolute', top: 18, right: 6,
          width: 10, height: 18, borderRadius: 5,
          background: 'linear-gradient(180deg, #777, #444)',
          border: '1px solid rgba(255,255,255,0.15)',
        }} />
        {/* Arm shaft — angled */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 6, height: 140,
          background: 'linear-gradient(90deg, #888, #555, #888)',
          borderRadius: 3,
          transformOrigin: 'top center',
          transform: 'rotate(38deg)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        }} />
        {/* Headshell / cartridge */}
        <div style={{
          position: 'absolute', bottom: 14, left: 2,
          width: 14, height: 20, borderRadius: 4,
          background: 'linear-gradient(135deg, #999, #555)',
          border: '1px solid rgba(255,255,255,0.2)',
          transform: 'rotate(38deg)',
        }} />
        {/* Stylus needle */}
        <div style={{
          position: 'absolute', bottom: 4, left: 8,
          width: 2, height: 12,
          background: 'linear-gradient(180deg, #aaa, #555)',
          borderRadius: 1,
          transform: 'rotate(38deg)',
        }} />
      </div>

    </div>
  );
}
