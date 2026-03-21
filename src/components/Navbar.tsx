'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface NavbarProps {
  activeLink?: string;
}

const LINKS = [
  { label: 'Beats',         href: '/',        key: 'home' },
  { label: 'Music',         href: '/#library', key: 'music' },
  { label: 'Genres',        href: '/genres',   key: 'genres' },
  { label: 'Video & Media', href: '/videos',   key: 'videos' },
];

export default function Navbar({ activeLink }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full py-5 px-8 flex items-center justify-between z-50 fixed top-0 bg-[#050505]/90 backdrop-blur-md border-b border-white/5">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/monstajam-logo.png"
          alt="MonstaJam"
          width={40}
          height={40}
          className="rounded-full object-cover"
          priority
        />
        <span className="text-xl font-black tracking-widest text-white">
          MONSTA<span className="text-cyan-400">JAM</span>
        </span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
        {LINKS.map(({ label, href, key }) => {
          const isActive = activeLink === key;
          return (
            <Link
              key={key}
              href={href}
              className={`transition-colors pb-1 ${
                isActive
                  ? 'text-[#00e5ff] border-b-2 border-[#00e5ff]'
                  : 'text-gray-300 hover:text-white border-b-2 border-transparent'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile hamburger */}
      <button
        className="md:hidden flex flex-col justify-center gap-[5px] p-2 w-9 h-9 rounded-lg hover:bg-white/5 transition-colors"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <span className={`block w-5 h-0.5 bg-white transition-all duration-300 origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-all duration-300 origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="absolute top-full left-0 right-0 flex flex-col py-4 md:hidden"
          style={{
            background: 'rgba(5,5,5,0.97)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {LINKS.map(({ label, href, key }) => {
            const isActive = activeLink === key;
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`px-8 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'text-[#00e5ff]' : 'text-gray-300 hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
