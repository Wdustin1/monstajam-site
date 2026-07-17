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
  const [tracks, videoCount] = await Promise.all([
    prisma.track.findMany({
      where: { published: true },
      include: { credits: true },
      orderBy: { number: 'asc' },
    }),
    prisma.video.count({ where: { published: true } }),
  ]);
  const artistCount = new Set(tracks.map((t: { artist: string }) => t.artist)).size;

  const showcaseTracks = [...tracks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .map((track) => ({
      slug: track.slug,
      title: track.title,
      artist: track.artist,
      color: track.color ?? '#00e5ff',
      audioUrl: track.audioUrl ?? null,
      coverUrl: track.coverUrl ?? null,
      genre: track.genre ?? null,
      bpm: track.bpm ?? null,
      number: track.number ?? null,
    }));
  const featuredTrack = showcaseTracks[0] ?? null;

  return (
    <>
      <Navbar activeLink="home" />
      <main id="main-content" tabIndex={-1} className="flex-grow pt-24 hero-bg-gradient">
        <Hero trackCount={tracks.length} artistCount={artistCount} videoCount={videoCount} featuredTrack={featuredTrack} showcaseTracks={showcaseTracks} />
        <ScrollIndicator />
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
