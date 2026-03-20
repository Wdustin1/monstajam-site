// Update these when real URLs are available
const SOCIAL_LINKS = [
  { label: 'Instagram', href: '', icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/> },
  { label: 'X / Twitter', href: '', icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/> },
  { label: 'YouTube', href: '', icon: <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/> },
];

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
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-lg font-black tracking-widest text-white">
                MONSTA<span className="text-cyan-400">JAM</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 max-w-xs">
              The exclusive home for unreleased tracks and raw sessions. For real fans only.
            </p>
          </div>

          {/* Social icons — only render if href is set */}
          <div className="flex items-center gap-4">
            {SOCIAL_LINKS.filter((s) => s.href).map((s) => (
              <a key={s.label}
                className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-gray-500 hover:text-white hover:border-white/25 transition-all"
                href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">{s.icon}</svg>
              </a>
            ))}
          </div>
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
