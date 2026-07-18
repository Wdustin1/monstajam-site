export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import ScrollIndicator from '@/components/ScrollIndicator';
import MusicLibrary from '@/components/MusicLibrary';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function Home() {
  const tracks = await prisma.track.findMany({
    where: { published: true },
    include: { credits: true },
    orderBy: { number: 'asc' },
  });

  return (
    <>
      <Navbar activeLink="home" />
      <main id="main-content" tabIndex={-1} className="flex-grow pt-24 hero-bg-gradient">
        <Hero />
        <ScrollIndicator />
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
