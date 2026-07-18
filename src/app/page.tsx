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

  const featuredSource = [...tracks]
    .filter((track) => Boolean(track.audioUrl))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  const featuredTrack = featuredSource ? {
    slug: featuredSource.slug,
    title: featuredSource.title,
    artist: featuredSource.artist,
    color: featuredSource.color ?? '#00e5ff',
    audioUrl: featuredSource.audioUrl ?? null,
    coverUrl: featuredSource.coverUrl ?? null,
    genre: featuredSource.genre ?? null,
    bpm: featuredSource.bpm ?? null,
    number: featuredSource.number ?? null,
  } : null;

  return (
    <>
      <Navbar activeLink="home" />
      <main id="main-content" tabIndex={-1} className="flex-grow pt-24 hero-bg-gradient">
        <Hero featuredTrack={featuredTrack} />
        <ScrollIndicator />
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
