import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TrackPageView from '@/components/TrackPageView';

export const dynamic = 'force-dynamic';

// Keep draft titles and stories out of metadata, including unauthenticated requests.
export const metadata: Metadata = {
  title: 'Admin track preview — MonstaJam',
  description: 'Signed-in admin preview of saved track changes.',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function TrackPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  // Check here as well as in middleware: direct server renders must be protected.
  const cookieStore = await cookies();
  if (!isAdminSession(cookieStore.get('admin_session')?.value)) {
    redirect('/upload/login');
  }

  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug }, include: { credits: true } });
  if (!track) notFound();

  return <TrackPageView track={track} allTracks={[]} preview />;
}
