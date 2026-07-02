export const dynamic = 'force-dynamic';

import Navbar from '@/components/Navbar';
import AlbumReleaseBanner from '@/components/AlbumReleaseBanner';
import Hero from '@/components/Hero';
import ScrollIndicator from '@/components/ScrollIndicator';
import MusicLibrary from '@/components/MusicLibrary';
import Footer from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import type { TrackWithCredits } from '@/components/MusicLibrary';

const previewTrack: TrackWithCredits = {
  slug: 'cold-world-volume-2',
  title: 'Cold World Volume 2',
  artist: 'Monsta Jam Productions',
  color: '#00e5ff',
  genre: 'Full Songs',
  audioUrl: '/api/preview-audio',
  coverUrl: '/releases/cold-world-volume-2-cover.jpg',
  bpm: 92,
  number: 1,
  createdAt: new Date(0),
};

async function getHomeData() {
  try {
    const [tracks, videoCount] = await Promise.all([
      prisma.track.findMany({
        where: { published: true },
        include: { credits: true },
        orderBy: { number: 'asc' },
      }),
      prisma.video.count({ where: { published: true } }),
    ]);

    return { tracks, videoCount };
  } catch (error) {
    console.error('Failed to load homepage data; rendering preview fallback.', error);
    return { tracks: [previewTrack], videoCount: 0 };
  }
}

function createdAtMs(track: { createdAt?: Date | string | null }) {
  return track.createdAt ? new Date(track.createdAt).getTime() : 0;
}

export default async function Home() {
  const { tracks, videoCount } = await getHomeData();
  const artistCount = new Set(tracks.map((t: { artist: string }) => t.artist)).size;

  // Featured track = most recently added (highest createdAt)
  const latest = tracks.length
    ? [...tracks].sort((a, b) => createdAtMs(b) - createdAtMs(a))[0]
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
        <MusicLibrary tracks={tracks} />
      </main>
      <Footer />
    </>
  );
}
