import { notFound } from 'next/navigation';
import { tracks, getTrackBySlug } from '@/lib/tracks';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TrackDetail from '@/components/TrackDetail';

// Pre-generate all track pages at build time
export function generateStaticParams() {
  return tracks.map((track) => ({ slug: track.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const track = getTrackBySlug(slug);
  if (!track) return {};
  return {
    title: `${track.title}${track.subtitle ? ` (${track.subtitle})` : ''} — MonstaJam`,
    description: track.story?.slice(0, 160) ?? 'Exclusive unreleased content on MonstaJam.',
  };
}

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const track = getTrackBySlug(slug);
  if (!track) notFound();

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-cyan-400 blur-[2px] opacity-50 shadow-[0_0_10px_#00ffff]" />
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 rounded-full bg-cyan-400 blur-[3px] opacity-40 shadow-[0_0_15px_#00ffff]" />
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 rounded-full bg-pink-400 blur-[1px] opacity-60 shadow-[0_0_8px_#ff00ff]" />
      </div>

      <Navbar />
      <TrackDetail track={track} />
      <Footer />
    </div>
  );
}
