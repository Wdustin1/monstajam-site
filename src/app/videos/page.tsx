import VideoGallery from '@/components/VideoGallery';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Music Video Gallery — MonstaJam',
  description: 'Watch exclusive music videos and live sessions.',
};

export default function VideosPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0b0f19' }}>
      <Navbar activeLink="videos" />
      <main className="flex-grow px-6 md:px-12 py-8 max-w-[1600px] mx-auto w-full pt-28">
        <VideoGallery />
      </main>
      <Footer />
    </div>
  );
}
