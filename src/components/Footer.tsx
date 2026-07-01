import Image from 'next/image';
import React from 'react';

// Add real URLs here when social accounts are ready
// Example: { label: 'Instagram', href: 'https://instagram.com/monstajam', icon: <path d="..." /> }
const SOCIAL_LINKS: { label: string; href: string; icon: React.ReactNode }[] = [];

export default function Footer() {
  return (
    <footer className="w-full relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#07070d' }}>

      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-32 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(176,38,255,0.08) 0%, transparent 70%)', filter: 'blur(20px)' }} />

      <div className="relative max-w-7xl mx-auto px-8 py-12 flex flex-col gap-8">

        {/* Top: Logo + tagline */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                src="/monstajam-logo.png"
                alt="MonstaJam"
                width={36}
                height={36}
                className="rounded-full object-cover"
              />
              <span className="text-lg font-black tracking-widest text-white">
                MONSTA<span className="text-cyan-400">JAM</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 max-w-xs">
              The exclusive home for unreleased tracks and raw sessions. For real fans only.
            </p>
          </div>

          {/* Social icons — only render when URLs are configured */}
          {SOCIAL_LINKS.length > 0 ? (
            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map((s) => (
                <a key={s.label}
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:text-white hover:border-white/25 transition-all"
                  href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">{s.icon}</svg>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-700 italic">Social links coming soon</p>
          )}
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

        {/* Bottom: copyright + links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} MonstaJam. All rights reserved.</span>
        </div>

      </div>
    </footer>
  );
}
