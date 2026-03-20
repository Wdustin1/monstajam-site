import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GenreBrowser from '@/components/GenreBrowser';

export const metadata = {
  title: 'Browse Genres — MonstaJam',
  description: 'Explore exclusive tracks by genre on MonstaJam.',
};

export default function GenresPage() {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden pt-[88px] pb-[80px] relative">
        {/* Ambient purple glow */}
        <div className="absolute bottom-0 left-0 w-1/3 h-64 rounded-full pointer-events-none"
          style={{ background: '#b026ff', filter: 'blur(150px)', opacity: 0.2, mixBlendMode: 'screen' }}
        />
        <GenreBrowser />
      </div>
      <Footer />
    </div>
  );
}
