export const dynamic = 'force-dynamic';

import Navbar from '@/components/Navbar';
import AlbumReleaseBanner from '@/components/AlbumReleaseBanner';
import Hero from '@/components/Hero';
import ScrollIndicator from '@/components/ScrollIndicator';
import LabelStory from '@/components/LabelStory';
import MusicLibrary from '@/components/MusicLibrary';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';

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

  // Featured track = most recently added (highest createdAt)
  const latest = tracks.length
    ? [...tracks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;

  const featuredTrack = latest ? {
    slug: latest.slug,
    title: latest.title,
    artist: latest.artist,
    color: latest.color ?? '#00e5ff',
    audioUrl: latest.audioUrl ?? null,
    coverUrl: latest.coverUrl ?? null,
    genre: latest.genre ?? null,
    bpm: latest.bpm ?? null,
    number: latest.number ?? null,
  } : null;

  return (
    <>
      <Navbar activeLink="home" />
      <main id="main-content" className="flex-grow pt-24 hero-bg-gradient">
        <AlbumReleaseBanner />
        <Hero trackCount={tracks.length} artistCount={artistCount} videoCount={videoCount} featuredTrack={featuredTrack} />
        <ScrollIndicator />
        <LabelStory />
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
