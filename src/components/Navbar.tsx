'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface NavbarProps {
  activeLink?: string;
}

const LINKS = [
  { label: 'Beats',         href: '/',          key: 'home' },
  { label: 'Music',         href: '/#library',  key: 'music' },
  { label: 'Community',     href: '/community', key: 'community' },
  { label: 'Genres',        href: '/genres',    key: 'genres' },
  { label: 'Video & Media', href: '/videos',    key: 'videos' },
];

export default function Navbar({ activeLink }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/5 bg-[#050505]/90 px-4 py-4 backdrop-blur-md sm:px-8 sm:py-5">

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
        type="button"
        className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-xl transition-colors hover:bg-white/5 md:hidden"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-controls="mobile-navigation"
        aria-expanded={menuOpen}
      >
        <span className={`block w-5 h-0.5 bg-white transition-all duration-300 origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-all duration-300 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-all duration-300 origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="absolute left-0 right-0 top-full flex flex-col border-b border-white/[0.06] bg-[#050505]/[0.98] py-3 backdrop-blur-xl md:hidden"
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
        </nav>
      )}
    </header>
  );
}
