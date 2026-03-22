import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import ScrollIndicator from '@/components/ScrollIndicator';
import MusicLibrary from '@/components/MusicLibrary';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';

export default async function Home() {
  const tracks = await prisma.track.findMany({
    where: { published: true },
    include: { credits: true },
    orderBy: { number: 'asc' },
  });

  // Derive stats from DB
  const artistCount = new Set(tracks.map((t: { artist: string }) => t.artist)).size;
  // Video count: tracks that have a YouTube/video URL could be counted here.
  // For now use the static VideoGallery count until a videos table exists.
  const videoCount = 8;

  return (
    <>
      <Navbar activeLink="home" />
      <main id="main-content" className="flex-grow pt-24 hero-bg-gradient">
        <Hero trackCount={tracks.length} artistCount={artistCount} videoCount={videoCount} />
        <ScrollIndicator />
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
