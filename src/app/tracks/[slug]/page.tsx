import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPublishedTrack } from '@/lib/published-track';
import { toPublicTrack } from '@/lib/track-playback';
import TrackPageView from '@/components/TrackPageView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const track = await getPublishedTrack(slug);
  if (!track) notFound();
  return {
    title: `${track.title}${track.subtitle ? ` (${track.subtitle})` : ''} — MonstaJam`,
    description: track.story?.slice(0, 160) ?? 'Exclusive unreleased content on MonstaJam.',
  };
}

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const track = await getPublishedTrack(slug);
  if (!track) notFound();

  // Fetch all published tracks for the player queue
  const allTracks = await prisma.track.findMany({
    where: { published: true },
    select: {
      slug: true,
      title: true,
      artist: true,
      genre: true,
      bpm: true,
      subtitle: true,
      color: true,
      audioUrl: true,
      audioAssetId: true,
      playbackMode: true,
      updatedAt: true,
      coverUrl: true,
      number: true,
    },
    orderBy: { number: 'asc' },
  });

  return <TrackPageView track={toPublicTrack(track)} allTracks={allTracks.map(toPublicTrack)} />;
}
