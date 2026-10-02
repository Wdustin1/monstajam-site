import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getAdminIdentity } from '@/lib/auth-provider';
import { prisma } from '@/lib/prisma';
import { toPublicTrack } from '@/lib/track-playback';
import TrackPageView from '@/components/TrackPageView';
import { isContentTrashed } from '@/lib/content-trash';

export const dynamic = 'force-dynamic';

// Keep draft titles and stories out of metadata, including unauthenticated requests.
export const metadata: Metadata = {
  title: 'Admin track preview — MonstaJam',
  description: 'Signed-in admin preview of saved track changes.',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function TrackPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!await getAdminIdentity(await headers())) {
    redirect('/upload/login');
  }

  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug }, include: { credits: true } });
  if (!track || isContentTrashed(track)) notFound();

  const publicTrack = toPublicTrack(track);
  const audition = {
    ...publicTrack,
    audioUrl: track.audioAssetId && publicTrack.audioUrl
      ? `${publicTrack.audioUrl}${publicTrack.audioUrl.includes('?') ? '&' : '?'}full=true`
      : track.audioUrl,
    playbackMode: 'full' as const,
  };
  return <TrackPageView track={audition} allTracks={[]} preview />;
}
