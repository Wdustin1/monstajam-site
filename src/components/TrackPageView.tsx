import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TrackDetail from '@/components/TrackDetail';
import type { TrackWithCredits } from '@/components/MusicLibrary';

export default function TrackPageView({
  track,
  allTracks,
  preview = false,
}: {
  track: TrackWithCredits;
  allTracks: TrackWithCredits[];
  preview?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ backgroundColor: '#05000A' }}>
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-cyan-400 blur-[2px] opacity-50 shadow-[0_0_10px_#00ffff]" />
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 rounded-full bg-cyan-400 blur-[3px] opacity-40 shadow-[0_0_15px_#00ffff]" />
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 rounded-full bg-pink-400 blur-[1px] opacity-60 shadow-[0_0_8px_#ff00ff]" />
      </div>
      <Navbar activeLink="music" />
      {preview && (
        <aside className="relative z-10 mx-5 mt-24 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100" aria-label="Admin preview">
          <strong>{track.published ? 'Admin preview' : 'Draft preview'}</strong>
          <p className="mt-1">Only signed-in admins can open this preview. It shows your last saved changes and lets you audition the full song.</p>
          <a href="/upload" className="mt-2 inline-block font-semibold underline">Back to admin</a>
        </aside>
      )}
      <TrackDetail track={track} allTracks={allTracks} adminPreview={preview} />
      <Footer />
    </div>
  );
}
