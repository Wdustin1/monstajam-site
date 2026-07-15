import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-grow flex flex-col items-center justify-center text-center px-5 py-32 relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div style={{
            width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }} />
        </div>

        {/* 404 number */}
        <div className="relative mb-6">
          <span
            className="text-[8rem] font-black leading-none select-none sm:text-[10rem]"
            style={{
              background: 'linear-gradient(135deg, #ff00ff, #00ffff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(255,0,255,0.5))',
            }}
          >
            404
          </span>
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-wider mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-400 text-base max-w-md mb-10 leading-relaxed">
          This page never made it to the vault. It may have moved, or the link may be out of date.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/#library"
            className="font-bold py-3 px-8 rounded-full text-black transition-all"
            style={{
              background: 'linear-gradient(135deg, #ff00ff, #b026ff)',
              boxShadow: '0 0 20px rgba(255,0,255,0.5)',
            }}
          >
            Explore the Library
          </Link>
          <Link
            href="/community"
            className="font-bold py-3 px-8 rounded-full text-white border transition-all hover:bg-white/5"
            style={{ borderColor: '#00ffff', boxShadow: '0 0 10px rgba(0,255,255,0.3)' }}
          >
            Join the Community
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
