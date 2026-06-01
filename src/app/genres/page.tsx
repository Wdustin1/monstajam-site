import GenreBrowser from '@/components/GenreBrowser';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Browse Genres — MonstaJam',
  description: 'Browse exclusive tracks by genre on MonstaJam.',
};

export const dynamic = 'force-dynamic';

export default async function GenresPage() {
  const tracks = await prisma.track.findMany({
    where: { published: true },
    include: { credits: true },
    orderBy: { number: 'asc' },
  }).catch((err) => {
    console.warn('Failed to load genre tracks:', err instanceof Error ? err.message : err);
    return [];
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar activeLink="genres" />
      <div className="flex-grow pt-24 pb-32">
        <GenreBrowser tracks={tracks} />
      </div>
      <Footer />
    </div>
  );
}
