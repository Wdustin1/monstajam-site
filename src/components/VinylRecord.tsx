'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer, PlayerTrack } from '@/context/PlayerContext';

interface VinylRecordProps {
  tracks?: PlayerTrack[];
  featuredTrack?: PlayerTrack | null;
}

// ── Tonearm geometry (520×520 container) ────────────────────────────────────
const PIVOT = { x: 494.8, y: 62 };   // pivot point in container coords
const ARM_REST = 5;                    // lifted-off angle (degrees)
const ARM_MIN  = 10;                   // outermost groove angle
const ARM_MAX  = 38;                   // innermost groove angle

// ── Disc geometry ─────────────────────────────────────────────────────────────
const DISC_CX = 260;
const DISC_CY = 260;
const ZONE_OUTER_R = 232;
const ZONE_INNER_R = 180;

// Precomputed zone center angles on disc (0° = east, clockwise)
// Derived from actual needle geometry: at arm angle θ, needle hits disc at these angles
const ZONE_CENTER_ANGLES_BASE = [47.2, 54.3, 63.4, 75.7, 95.0];
const ZONE_ARC_DEG = 6.5;
const ZONE_COLORS  = ['#00e5ff', '#44aaff', '#aa44ff', '#ff44aa', '#ff8822'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toRad(d: number) { return (d * Math.PI) / 180; }

function donutArc(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number
): string {
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const ox1 = cx + outerR * Math.cos(s); const oy1 = cy + outerR * Math.sin(s);
  const ox2 = cx + outerR * Math.cos(e); const oy2 = cy + outerR * Math.sin(e);
  const ix1 = cx + innerR * Math.cos(e); const iy1 = cy + innerR * Math.sin(e);
  const ix2 = cx + innerR * Math.cos(s); const iy2 = cy + innerR * Math.sin(s);
  return `M${ox1} ${oy1} A${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L${ix1} ${iy1} A${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2}Z`;
}

function angleToZone(armDeg: number, count: number): number {
  const clamped = Math.max(ARM_MIN, Math.min(ARM_MAX, armDeg));
  return Math.min(count - 1, Math.floor(((clamped - ARM_MIN) / (ARM_MAX - ARM_MIN)) * count));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VinylRecord({ tracks = [], featuredTrack }: VinylRecordProps) {
  const { currentTrack, isPlaying, toggle, play } = usePlayer();

  const zoneTracks = tracks.slice(0, 5);
  const hasZones   = zoneTracks.length > 1;

  // Arm state
  const [armAngle,  setArmAngle]  = useState(ARM_REST);
  const [isDragging, setIsDragging] = useState(false);
  const [dragZone,  setDragZone]  = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt]                     = useState({ x: 0, y: 0 });
  const [anisotropyShift, setAnisotropyShift] = useState({ x: 0, y: 0 });

  const discControls  = useAnimation();
  const labelControls = useAnimation();

  // Spin animation
  useEffect(() => {
    if (isPlaying) {
      discControls.start({  rotate: 360,  transition: { duration: 4, repeat: Infinity, ease: 'linear' } });
      labelControls.start({ rotate: -360, transition: { duration: 4, repeat: Infinity, ease: 'linear' } });
    } else {
      discControls.stop();
      labelControls.stop();
    }
  }, [isPlaying, discControls, labelControls]);

  // Arm follows playing track when not dragging
  useEffect(() => {
    if (isDragging) return;
    if (isPlaying && currentTrack && hasZones) {
      const idx = zoneTracks.findIndex(t => t.slug === currentTrack.slug);
      if (idx >= 0) {
        const frac = (idx + 0.5) / zoneTracks.length;
        setArmAngle(ARM_MIN + frac * (ARM_MAX - ARM_MIN));
        return;
      }
      setArmAngle(ARM_MIN + 0.5 * (ARM_MAX - ARM_MIN));
      return;
    }
    if (!isPlaying) setArmAngle(ARM_REST);
  }, [isPlaying, currentTrack, isDragging, hasZones, zoneTracks]);

  // Mouse tilt (skip when dragging)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging) return;
      setTilt({ x: (window.innerHeight / 2 - e.pageY) / 50, y: (window.innerWidth / 2 - e.pageX) / 50 });
      setAnisotropyShift({ x: (window.innerWidth / 2 - e.pageX) / 25, y: (window.innerHeight / 2 - e.pageY) / 25 });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isDragging]);

  // Convert pointer pos → arm angle (clockwise from straight-down pivot)
  const ptrToArmAngle = useCallback((e: MouseEvent | React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return ARM_REST;
    const dx = (e.clientX - rect.left)  - PIVOT.x;
    const dy = (e.clientY - rect.top)   - PIVOT.y;
    return Math.atan2(dx, dy) * (180 / Math.PI);
  }, []);

  const handleArmMouseDown = useCallback((e: React.MouseEvent) => {
    if (!hasZones) return;
    e.preventDefault();
    setIsDragging(true);
    const a = ptrToArmAngle(e);
    const clamped = Math.max(ARM_MIN - 6, Math.min(ARM_MAX + 4, a));
    setArmAngle(clamped);
    setDragZone(angleToZone(clamped, zoneTracks.length));
  }, [hasZones, ptrToArmAngle, zoneTracks.length]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const clamped = Math.max(ARM_MIN - 6, Math.min(ARM_MAX + 4, ptrToArmAngle(e)));
      setArmAngle(clamped);
      setDragZone(angleToZone(clamped, zoneTracks.length));
    };
    const onUp = (e: MouseEvent) => {
      setIsDragging(false);
      const zone  = angleToZone(ptrToArmAngle(e), zoneTracks.length);
      const track = zoneTracks[zone];
      if (track) play(track);
      setDragZone(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, ptrToArmAngle, zoneTracks, play]);

  // What to show on the label
  const displayTrack = dragZone !== null
    ? (zoneTracks[dragZone] ?? featuredTrack)
    : (currentTrack ?? featuredTrack ?? null);

  const activeZoneIdx = dragZone !== null
    ? dragZone
    : (currentTrack ? zoneTracks.findIndex(t => t.slug === currentTrack.slug) : -1);

  const trackTitle  = displayTrack?.title  ?? 'MONSTA JAM';
  const trackArtist = displayTrack?.artist ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative select-none"
      style={{ width: 520, height: 520, cursor: isDragging ? 'grabbing' : 'default' }}
    >
      {/* Sparkle particles */}
      {[
        { top: '6%',  left: '14%', size: 3, delay: 0   },
        { top: '15%', left: '84%', size: 2, delay: 0.4 },
        { top: '70%', left: '90%', size: 3, delay: 0.9 },
        { top: '87%', left: '12%', size: 2, delay: 1.3 },
        { top: '44%', left: '3%',  size: 2, delay: 0.7 },
        { top: '28%', left: '94%', size: 3, delay: 1.6 },
        { top: '93%', left: '56%', size: 2, delay: 0.2 },
        { top: '4%',  left: '52%', size: 2, delay: 1.1 },
      ].map((s, i) => (
        <motion.div key={i} className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* Neon halo drift */}
      <motion.div className="absolute inset-0 rounded-full pointer-events-none" style={{
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
      <div className="absolute" style={{
        inset: 0, zIndex: 5, transformStyle: 'preserve-3d',
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.1s ease-out',
      }}>
        {/* Spinning disc */}
        <motion.div className="absolute inset-0 rounded-full overflow-hidden" animate={discControls}
          style={{
            background: '#040404',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,1), 0 0 0 10px rgba(255,255,255,0.015), inset 0 0 40px rgba(0,0,0,0.9)',
          }}>

          {/* Ultra-fine grooves */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-radial-gradient(circle at center, rgba(8,8,8,1) 0px, rgba(40,40,40,0.6) 0.8px, rgba(8,8,8,1) 2px)',
          }} />

          {/* Groove rings */}
          {[28,44,60,76,92,108,124,140,155,168].map((inset, i, arr) => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{
              inset,
              border: `1px solid rgba(255,255,255,${[0.18,0.13,0.16,0.11,0.15,0.12,0.17,0.10,0.14,0.09][i]})`,
            }} />
          ))}

          {/* Wide groove band */}
          {[38,54,70,86,102,118,134,150].map((inset, i) => (
            <div key={`w${i}`} className="absolute rounded-full pointer-events-none" style={{ inset, border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}

          {/* Anisotropic conic highlight */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `conic-gradient(from 0deg at 50% 50%,
              transparent 0%, rgba(255,255,255,0.04) 10%, rgba(255,255,255,0.14) 15%,
              rgba(255,255,255,0.04) 20%, transparent 40%, rgba(0,240,255,0.04) 45%,
              transparent 55%, transparent 60%, rgba(255,255,255,0.04) 65%,
              rgba(255,255,255,0.14) 70%, rgba(255,255,255,0.04) 75%, transparent 100%)`,
            mixBlendMode: 'overlay',
            transform: `translate(${anisotropyShift.x}px, ${anisotropyShift.y}px)`,
            transition: 'transform 0.1s ease-out',
          }} />

          {/* Neon colour reflections */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(circle at 10% 50%, rgba(255,0,170,0.18) 0%, transparent 60%),
                         radial-gradient(circle at 90% 50%, rgba(0,240,255,0.18) 0%, transparent 60%)`,
            mixBlendMode: 'screen',
          }} />

          {/* Inner cyan surface ring */}
          <div className="absolute pointer-events-none" style={{
            inset: 15, borderRadius: '50%',
            border: '1px solid rgba(0,240,255,0.4)',
            boxShadow: '0 0 15px rgba(0,240,255,0.3), inset 0 0 15px rgba(0,240,255,0.3)',
          }} />

          {/* Center label — counter-rotates */}
          <motion.div className="absolute flex flex-col items-center justify-center overflow-hidden"
            animate={labelControls}
            style={{
              inset: '34%', borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, #1e1025, #05000A)',
              border: '2px solid rgba(255,0,170,0.25)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,1), 0 0 30px rgba(0,240,255,0.12)',
              zIndex: 20, cursor: 'pointer',
            }}
            onClick={() => {
              if (currentTrack) toggle(currentTrack);
              else if (featuredTrack) play(featuredTrack);
            }}
          >
            {/* Play/Pause icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full mb-1" style={{
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
              fontSize: 7, fontWeight: 900, color: 'rgba(255,255,255,0.9)',
              letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.3,
              padding: '0 6px', maxWidth: '100%', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {trackTitle.toUpperCase()}
            </span>

            {trackArtist ? (
              <span style={{
                fontSize: 5.5, color: 'rgba(0,240,255,0.7)', letterSpacing: '0.1em',
                marginTop: 2, padding: '0 4px', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{trackArtist}</span>
            ) : (
              <span style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginTop: 2 }}>
                VOL. 1 • 2025
              </span>
            )}

            {/* Pin hole */}
            <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#000', border: '1px solid rgba(255,255,255,0.12)' }} />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Zone arc overlay (non-spinning SVG) ── */}
      {hasZones && (
        <svg
          style={{ position: 'absolute', inset: 0, width: 520, height: 520, zIndex: 18, pointerEvents: 'none' }}
          viewBox="0 0 520 520"
        >
          <defs>
            {ZONE_COLORS.map((color, i) => (
              <filter key={i} id={`glow${i}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            ))}
          </defs>
          {zoneTracks.map((track, i) => {
            const centerDeg = ZONE_CENTER_ANGLES_BASE[i] ?? (47 + i * 13);
            const half      = ZONE_ARC_DEG / 2;
            const isActive  = i === activeZoneIdx;
            const color     = ZONE_COLORS[i % ZONE_COLORS.length];
            // Label anchor point just outside outer ring
            const labelR    = ZONE_OUTER_R + 16;
            const labelX    = DISC_CX + labelR * Math.cos(toRad(centerDeg));
            const labelY    = DISC_CY + labelR * Math.sin(toRad(centerDeg));
            const labelAng  = centerDeg + 90; // rotate text to follow arc
            return (
              <g key={track.slug} filter={isActive ? `url(#glow${i})` : undefined}>
                {/* Zone donut arc */}
                <path
                  d={donutArc(DISC_CX, DISC_CY, ZONE_OUTER_R, ZONE_INNER_R, centerDeg - half, centerDeg + half)}
                  fill={color}
                  fillOpacity={isActive ? 0.22 : 0.07}
                  stroke={color}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  strokeOpacity={isActive ? 0.9 : 0.4}
                />
                {/* Track title label, rotated along the arc */}
                <text
                  x={labelX} y={labelY}
                  fill={color}
                  fontSize={isActive ? '7.5' : '6'}
                  fontWeight="900"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  letterSpacing="0.08em"
                  fillOpacity={isActive ? 1 : 0.5}
                  transform={`rotate(${labelAng}, ${labelX}, ${labelY})`}
                >
                  {track.title.toUpperCase().slice(0, 14)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* ── Tonearm ── */}
      <motion.div
        className="absolute"
        style={{ top: 20, right: 0, width: 140, height: 420, zIndex: 30, transformOrigin: '82% 10%' }}
        animate={{ rotate: armAngle }}
        transition={isDragging ? { duration: 0 } : { duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
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

        {/* LED when playing */}
        {isPlaying && (
          <div style={{
            position: 'absolute', bottom: 12, right: 14,
            width: 6, height: 6, borderRadius: '50%',
            background: '#00F0FF',
            boxShadow: '0 0 8px #00F0FF, 0 0 16px rgba(0,240,255,0.6)',
          }} />
        )}

        {/* Drag hint ring on pivot (visible when hasZones, not dragging) */}
        {hasZones && !isDragging && (
          <motion.div style={{
            position: 'absolute', top: 5, right: 5,
            width: 60, height: 60, borderRadius: '50%',
            border: '1px dashed rgba(0,229,255,0.3)',
            pointerEvents: 'none',
          }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Invisible drag handle over entire arm */}
        {hasZones && (
          <div
            onMouseDown={handleArmMouseDown}
            style={{
              position: 'absolute', inset: 0,
              cursor: isDragging ? 'grabbing' : 'grab',
              zIndex: 50,
              borderRadius: 8,
            }}
          />
        )}
      </motion.div>

      {/* Drag tooltip */}
      {isDragging && dragZone !== null && zoneTracks[dragZone] && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50, pointerEvents: 'none',
          background: 'rgba(0,0,0,0.85)',
          border: `1px solid ${ZONE_COLORS[dragZone % ZONE_COLORS.length]}`,
          boxShadow: `0 0 12px ${ZONE_COLORS[dragZone % ZONE_COLORS.length]}60`,
          borderRadius: 8, padding: '6px 14px',
          color: ZONE_COLORS[dragZone % ZONE_COLORS.length],
          fontSize: 11, fontWeight: 900, letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
        }}>
          ▶ {zoneTracks[dragZone].title.toUpperCase()}
          <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: 6 }}>
            {zoneTracks[dragZone].artist}
          </span>
        </div>
      )}
    </div>
  );
}
