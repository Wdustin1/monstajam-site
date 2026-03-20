import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center text-center px-8 py-32">
        {/* Ambient glows */}
        <div className="absolute pointer-events-none"
          style={{
            width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
            top: '30%', left: '50%', transform: 'translateX(-50%)',
          }} />

        {/* 404 number */}
        <div className="relative mb-6">
          <span
            className="text-[10rem] font-black leading-none select-none"
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
          Track Not Found
        </h1>
        <p className="text-gray-400 text-base max-w-md mb-10 leading-relaxed">
          This one never made it to the vault. The track you&apos;re looking for doesn&apos;t exist or was removed.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="font-bold py-3 px-8 rounded-full text-black transition-all"
            style={{
              background: 'linear-gradient(135deg, #ff00ff, #b026ff)',
              boxShadow: '0 0 20px rgba(255,0,255,0.5)',
            }}
          >
            Back to Library
          </Link>
          <Link
            href="/videos"
            className="font-bold py-3 px-8 rounded-full text-white border transition-all hover:bg-white/5"
            style={{ borderColor: '#00ffff', boxShadow: '0 0 10px rgba(0,255,255,0.3)' }}
          >
            Watch Videos
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
