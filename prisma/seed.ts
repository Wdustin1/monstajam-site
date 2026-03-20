import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const prisma = new PrismaClient({ adapter });

const tracks = [
  {
    slug: 'city-lights', number: 1, title: 'City Lights', subtitle: 'Unreleased Mix',
    artist: 'Neon Pulse', genre: 'Electronic', bpm: 128, mood: 'Dark',
    color: 'bg-gradient-to-br from-purple-600 to-blue-500', accentCyan: true, published: true,
    story: 'City Lights (Unreleased Mix) captures the raw energy of late-night urban life — neon reflections on rain-slicked pavement, the hum of a city that never sleeps.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Neon Pulse' }, { role: 'Mixed by', name: 'AudioAlchemy' }],
  },
  {
    slug: 'midnight-drive', number: 2, title: 'Midnight Drive', subtitle: 'Bonus Track',
    artist: 'The Night Shifts', genre: 'Lo-Fi', bpm: 90, mood: 'Chill',
    color: 'bg-gradient-to-br from-indigo-600 to-purple-500', accentCyan: false, published: true,
    story: 'A bonus track born at 3 AM on a highway with no destination.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'The Night Shifts' }, { role: 'Mixed by', name: 'Studio Dark' }],
  },
  {
    slug: 'synthetic-soul', number: 3, title: 'Synthetic Soul', subtitle: 'Demo',
    artist: 'Future Funk', genre: 'R&B', bpm: 102, mood: 'Energetic',
    color: 'bg-gradient-to-br from-pink-600 to-orange-500', accentCyan: true, published: true,
    story: "This demo never made the final cut — and that's exactly why it matters.",
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Future Funk' }, { role: 'Mixed by', name: 'WaveLab Sessions' }],
  },
  {
    slug: 'echoes', number: 4, title: 'Echoes', subtitle: 'Extended Version',
    artist: 'Aural Waves', genre: 'Hip-Hop', bpm: 85, mood: 'Chill',
    color: 'bg-gradient-to-br from-cyan-600 to-teal-500', accentCyan: false, published: true,
    story: 'The extended version adds six minutes the label cut from the original release.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Aural Waves' }, { role: 'Mixed by', name: 'SoundForge Studio' }],
  },
  {
    slug: 'neon-dreams', number: 5, title: 'Neon Dreams',
    artist: 'Retrograde', genre: 'Electronic', bpm: 136, mood: 'Energetic',
    color: 'bg-gradient-to-br from-fuchsia-600 to-pink-500', accentCyan: true, published: true,
    story: "Retrograde pulls from early 80s analog synths and late-night FM radio.",
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Retrograde' }, { role: 'Mixed by', name: 'VHS Mastering' }],
  },
  {
    slug: 'sunset-boulevard', number: 6, title: 'Sunset Boulevard',
    artist: 'Lofi Beats', genre: 'Lo-Fi', bpm: 75, mood: 'Chill',
    color: 'bg-gradient-to-br from-orange-500 to-yellow-400', accentCyan: false, published: true,
    story: 'Golden hour through a dusty windshield.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Lofi Beats' }],
  },
  {
    slug: 'digital-ocean', number: 7, title: 'Digital Ocean',
    artist: 'Synthwave', genre: 'Electronic', bpm: 120, mood: 'Dark',
    color: 'bg-gradient-to-br from-blue-600 to-cyan-500', accentCyan: true, published: true,
    story: 'Inspired by deep-sea exploration data sonified into music.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Synthwave' }, { role: 'Mixed by', name: 'Ocean Labs Audio' }],
  },
  {
    slug: 'space-walk', number: 8, title: 'Space Walk',
    artist: 'Ambient Space', genre: 'Electronic', bpm: 60, mood: 'Chill',
    color: 'bg-gradient-to-br from-slate-700 to-indigo-900', accentCyan: false, published: true,
    story: 'Recorded with actual NASA telemetry data as a rhythmic foundation.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Ambient Space' }],
  },
  {
    slug: 'cyberpunk-city', number: 9, title: 'Cyberpunk City',
    artist: 'Dark Synth', genre: 'Electronic', bpm: 145, mood: 'Dark',
    color: 'bg-gradient-to-br from-violet-700 to-fuchsia-600', accentCyan: true, published: true,
    story: 'Distorted guitars over a modular synth bed.',
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Dark Synth' }, { role: 'Mixed by', name: 'Blacksite Audio' }],
  },
  {
    slug: 'chill-vibes', number: 10, title: 'Chill Vibes',
    artist: 'Lofi Beats', genre: 'Lo-Fi', bpm: 80, mood: 'Chill',
    color: 'bg-gradient-to-br from-green-600 to-teal-500', accentCyan: false, published: true,
    story: "Two chords, a sample from an old vinyl, and a rainy Saturday afternoon.",
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Lofi Beats' }],
  },
  {
    slug: 'acoustic-sunrise', number: 11, title: 'Acoustic Sunrise',
    artist: 'Folk Tales', genre: 'Hip-Hop', bpm: 95, mood: 'Energetic',
    color: 'bg-gradient-to-br from-amber-500 to-orange-600', accentCyan: true, published: true,
    story: "Folk Tales recorded this live in one room, no headphones, everybody bleeding into each other's mics.",
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Folk Tales' }, { role: 'Mixed by', name: 'Open Room Studio' }],
  },
  {
    slug: 'midnight-jazz', number: 12, title: 'Midnight Jazz',
    artist: 'Smooth Grooves', genre: 'R&B', bpm: 88, mood: 'Dark',
    color: 'bg-gradient-to-br from-red-700 to-rose-500', accentCyan: false, published: true,
    story: "A late-night session that started as a warmup and became the best thing anyone in the room had ever recorded.",
    spotifyUrl: '#', appleMusicUrl: '#',
    credits: [{ role: 'Produced by', name: 'Smooth Grooves' }, { role: 'Mixed by', name: 'Blue Note Modern' }],
  },
];

async function main() {
  console.log('Seeding tracks...');
  for (const track of tracks) {
    const { credits, ...trackData } = track;
    await prisma.track.upsert({
      where: { slug: trackData.slug },
      update: {},
      create: {
        ...trackData,
        credits: { create: credits },
      },
    });
    console.log(`  ✓ ${trackData.title}`);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
