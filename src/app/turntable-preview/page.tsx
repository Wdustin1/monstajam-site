import Hero from '@/components/Hero';
import type { PlayerTrack } from '@/context/PlayerContext';

const previewTrack: PlayerTrack = {
  slug: 'cold-world-volume-2',
  title: 'Cold World Volume 2',
  artist: 'Monsta Jam Productions',
  color: '#00e5ff',
  genre: 'Full Songs',
  audioUrl: '/api/preview-audio',
};

export default function TurntablePreviewPage() {
  return (
    <main className="min-h-screen hero-bg-gradient">
      <Hero trackCount={24} artistCount={1} videoCount={6} featuredTrack={previewTrack} />
    </main>
  );
}
