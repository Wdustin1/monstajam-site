import VideoGallery from '@/components/VideoGallery';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Music Video Gallery — MonstaJam',
  description: 'Watch exclusive music videos and live sessions.',
};

export default async function VideosPage() {
  const videos = await prisma.video.findMany({
    where: { published: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar activeLink="videos" />
      <main id="main-content" className="flex-grow px-6 md:px-12 py-8 max-w-[1600px] mx-auto w-full pt-28">
        <VideoGallery videos={videos} />
      </main>
      <Footer />
    </div>
  );
}
