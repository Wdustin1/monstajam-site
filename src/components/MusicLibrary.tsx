import { tracks } from '@/lib/tracks';
import SongCard from './SongCard';

export default function MusicLibrary() {
  return (
    <section className="max-w-7xl mx-auto px-8 pb-32">
      <div className="flex flex-col gap-6 mb-10">
        <h2 className="text-3xl font-black tracking-tight text-white uppercase">Exclusive Library</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400">Filter by:</span>
          <button className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">Hip-Hop</button>
          <button className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">R&amp;B</button>
          <button className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">Electronic</button>
          <button className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors">Lo-Fi</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tracks.map((track) => (
          <SongCard key={track.slug} track={track} />
        ))}
      </div>
    </section>
  );
}
