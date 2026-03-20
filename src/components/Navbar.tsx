interface NavbarProps {
  activeLink?: string;
}

const LINKS = [
  { label: 'Beats',         href: '/',       key: 'home' },
  { label: 'Music',         href: '/#library', key: 'music' },
  { label: 'Featured',      href: '#',        key: 'featured' },
  { label: 'Community',     href: '#',        key: 'community' },
  { label: 'Contact',       href: '#',        key: 'contact' },
  { label: 'Video & Media', href: '/videos',  key: 'videos' },
];

export default function Navbar({ activeLink }: NavbarProps) {
  return (
    <header className="w-full py-5 px-8 flex items-center justify-between z-50 fixed top-0 bg-[#050505]/85 backdrop-blur-md border-b border-white/5">

      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
        <span className="text-xl font-black tracking-widest text-white">
          MONSTA<span className="text-cyan-400">JAM</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
        {LINKS.map(({ label, href, key }) => {
          const isActive = activeLink === key;
          return (
            <a
              key={key}
              href={href}
              className={`transition-colors pb-1 ${
                isActive
                  ? 'text-[#00e5ff] border-b-2 border-[#00e5ff] [box-shadow:0_2px_10px_rgba(0,229,255,0.5)]'
                  : 'text-gray-300 hover:text-white border-b-2 border-transparent'
              }`}
            >
              {label}
            </a>
          );
        })}
      </nav>


    </header>
  );
}
