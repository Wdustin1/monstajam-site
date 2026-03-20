import GenreBrowser from '@/components/GenreBrowser';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Browse Genres — MonstaJam',
  description: 'Browse exclusive tracks by genre on MonstaJam.',
};

export default function GenresPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar />
      <div className="flex-grow pt-24 pb-32">
        <GenreBrowser />
      </div>
      <Footer />
    </div>
  );
}
