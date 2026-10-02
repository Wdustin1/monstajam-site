export const dynamic = 'force-dynamic';

import Navbar from '@/components/Navbar';
import AlbumReleaseBanner from '@/components/AlbumReleaseBanner';
import Hero from '@/components/Hero';
import ScrollIndicator from '@/components/ScrollIndicator';
import MusicLibrary from '@/components/MusicLibrary';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { toPublicTrack } from '@/lib/track-playback';
import { activeContentWhere } from '@/lib/content-trash';

export default async function Home() {
  const [trackRecords, videoCount] = await Promise.all([
    prisma.track.findMany({
      where: { published: true, ...activeContentWhere() },
      include: { credits: true },
      orderBy: { number: 'asc' },
    }),
    prisma.video.count({ where: { published: true, ...activeContentWhere() } }),
  ]);
  const tracks = trackRecords.map(toPublicTrack);
  const artistCount = new Set(tracks.map((t: { artist: string }) => t.artist)).size;

  // Featured track = most recently added (highest createdAt)
  const latestRecord = trackRecords.length
    ? [...trackRecords].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    : null;
  const latest = latestRecord ? toPublicTrack(latestRecord) : null;

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
    playbackMode: latest.playbackMode,
  } : null;

  return (
    <>
      <Navbar activeLink="home" />
      <main id="main-content" className="flex-grow pt-24 hero-bg-gradient">
        <AlbumReleaseBanner />
        <Hero trackCount={tracks.length} artistCount={artistCount} videoCount={videoCount} featuredTrack={featuredTrack} />
        <ScrollIndicator />
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
