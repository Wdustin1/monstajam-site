export interface Track {
  slug: string;
  number: number;
  title: string;
  subtitle?: string;
  artist: string;
  genre?: string;
  color: string; // tailwind gradient for card placeholder
  accentCyan?: boolean; // true = cyan title, false/undefined = pink title
  story?: string;
  credits?: { role: string; name: string }[];
  spotifyUrl?: string;
  appleMusicUrl?: string;
}

export const tracks: Track[] = [
  {
    slug: 'city-lights',
    number: 1,
    title: 'City Lights',
    subtitle: 'Unreleased Mix',
    artist: 'Neon Pulse',
    genre: 'Electronic',
    color: 'bg-gradient-to-br from-purple-600 to-blue-500',
    accentCyan: true,
    story:
      'City Lights (Unreleased Mix) captures the raw energy of late-night urban life — neon reflections on rain-slicked pavement, the hum of a city that never sleeps. Neon Pulse built this track over three years of stolen studio sessions, layering synths and field recordings until the city breathed through every beat.',
    credits: [
      { role: 'Produced by', name: 'Neon Pulse' },
      { role: 'Mixed by', name: 'AudioAlchemy' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'midnight-drive',
    number: 2,
    title: 'Midnight Drive',
    subtitle: 'Bonus Track',
    artist: 'The Night Shifts',
    genre: 'Lo-Fi',
    color: 'bg-gradient-to-br from-indigo-600 to-purple-500',
    accentCyan: false,
    story:
      'A bonus track born at 3 AM on a highway with no destination. The Night Shifts recorded the entire foundation in one take — no second-guessing, no overdubs. Just the road and the music.',
    credits: [
      { role: 'Produced by', name: 'The Night Shifts' },
      { role: 'Mixed by', name: 'Studio Dark' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'synthetic-soul',
    number: 3,
    title: 'Synthetic Soul',
    subtitle: 'Demo',
    artist: 'Future Funk',
    genre: 'R&B',
    color: 'bg-gradient-to-br from-pink-600 to-orange-500',
    accentCyan: true,
    story:
      'This demo never made the final cut — and that\'s exactly why it matters. Future Funk stripped everything back to the essentials, revealing a rawness the polished version lost. A glimpse into the process.',
    credits: [
      { role: 'Produced by', name: 'Future Funk' },
      { role: 'Mixed by', name: 'WaveLab Sessions' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'echoes',
    number: 4,
    title: 'Echoes',
    subtitle: 'Extended Version',
    artist: 'Aural Waves',
    genre: 'Hip-Hop',
    color: 'bg-gradient-to-br from-cyan-600 to-teal-500',
    accentCyan: false,
    story:
      'The extended version adds six minutes the label cut from the original release. Aural Waves called it the truest form of the track — the ending was always supposed to breathe this long.',
    credits: [
      { role: 'Produced by', name: 'Aural Waves' },
      { role: 'Mixed by', name: 'SoundForge Studio' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
];

export function getTrackBySlug(slug: string): Track | undefined {
  return tracks.find((t) => t.slug === slug);
}
