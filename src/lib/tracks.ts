export interface Track {
  slug: string;
  number: number;
  title: string;
  subtitle?: string;
  artist: string;
  genre: string;
  bpm?: number;
  mood?: string;
  color: string; // tailwind gradient for card/placeholder
  accentCyan?: boolean;
  story?: string;
  credits?: { role: string; name: string }[];
  spotifyUrl?: string;
  appleMusicUrl?: string;
  artUrl?: string; // real image URL when available
}

export const tracks: Track[] = [
  {
    slug: 'city-lights',
    number: 1,
    title: 'City Lights',
    subtitle: 'Unreleased Mix',
    artist: 'Neon Pulse',
    genre: 'Electronic',
    bpm: 128,
    mood: 'Dark',
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
    bpm: 90,
    mood: 'Chill',
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
    bpm: 102,
    mood: 'Energetic',
    color: 'bg-gradient-to-br from-pink-600 to-orange-500',
    accentCyan: true,
    story:
      "This demo never made the final cut — and that's exactly why it matters. Future Funk stripped everything back to the essentials, revealing a rawness the polished version lost.",
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
    bpm: 85,
    mood: 'Chill',
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
  {
    slug: 'neon-dreams',
    number: 5,
    title: 'Neon Dreams',
    artist: 'Retrograde',
    genre: 'Electronic',
    bpm: 136,
    mood: 'Energetic',
    color: 'bg-gradient-to-br from-fuchsia-600 to-pink-500',
    accentCyan: true,
    story:
      'Retrograde pulls from early 80s analog synths and late-night FM radio. Neon Dreams is the kind of track that makes you feel like you\'re driving through a city that only exists in movies.',
    credits: [
      { role: 'Produced by', name: 'Retrograde' },
      { role: 'Mixed by', name: 'VHS Mastering' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'sunset-boulevard',
    number: 6,
    title: 'Sunset Boulevard',
    artist: 'Lofi Beats',
    genre: 'Lo-Fi',
    bpm: 75,
    mood: 'Chill',
    color: 'bg-gradient-to-br from-orange-500 to-yellow-400',
    accentCyan: false,
    story:
      'Golden hour through a dusty windshield. Lofi Beats captured something fleeting here — a four-chord loop that somehow contains an entire summer.',
    credits: [
      { role: 'Produced by', name: 'Lofi Beats' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'digital-ocean',
    number: 7,
    title: 'Digital Ocean',
    artist: 'Synthwave',
    genre: 'Electronic',
    bpm: 120,
    mood: 'Dark',
    color: 'bg-gradient-to-br from-blue-600 to-cyan-500',
    accentCyan: true,
    story:
      'Inspired by deep-sea exploration data sonified into music. Every arpeggio is a depth reading. Every kick is a pressure wave. Digital Ocean is science as art.',
    credits: [
      { role: 'Produced by', name: 'Synthwave' },
      { role: 'Mixed by', name: 'Ocean Labs Audio' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'space-walk',
    number: 8,
    title: 'Space Walk',
    artist: 'Ambient Space',
    genre: 'Electronic',
    bpm: 60,
    mood: 'Chill',
    color: 'bg-gradient-to-br from-slate-700 to-indigo-900',
    accentCyan: false,
    story:
      'Recorded with actual NASA telemetry data as a rhythmic foundation. Space Walk is fourteen minutes compressed to four — the entire arc of an EVA distilled into a single ambient piece.',
    credits: [
      { role: 'Produced by', name: 'Ambient Space' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'cyberpunk-city',
    number: 9,
    title: 'Cyberpunk City',
    artist: 'Dark Synth',
    genre: 'Electronic',
    bpm: 145,
    mood: 'Dark',
    color: 'bg-gradient-to-br from-violet-700 to-fuchsia-600',
    accentCyan: true,
    story:
      'Distorted guitars over a modular synth bed. Dark Synth built this for a short film that never got made — the track outlived the project and became its own world.',
    credits: [
      { role: 'Produced by', name: 'Dark Synth' },
      { role: 'Mixed by', name: 'Blacksite Audio' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'chill-vibes',
    number: 10,
    title: 'Chill Vibes',
    artist: 'Lofi Beats',
    genre: 'Lo-Fi',
    bpm: 80,
    mood: 'Chill',
    color: 'bg-gradient-to-br from-green-600 to-teal-500',
    accentCyan: false,
    story:
      'Two chords, a sample from an old vinyl, and a rainy Saturday afternoon. That\'s the whole story. Sometimes that\'s enough.',
    credits: [
      { role: 'Produced by', name: 'Lofi Beats' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'acoustic-sunrise',
    number: 11,
    title: 'Acoustic Sunrise',
    artist: 'Folk Tales',
    genre: 'Hip-Hop',
    bpm: 95,
    mood: 'Energetic',
    color: 'bg-gradient-to-br from-amber-500 to-orange-600',
    accentCyan: true,
    story:
      'Folk Tales recorded this live in one room, no headphones, everybody bleeding into each other\'s mics. The bleed is the point. You can hear the room breathe.',
    credits: [
      { role: 'Produced by', name: 'Folk Tales' },
      { role: 'Mixed by', name: 'Open Room Studio' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
  {
    slug: 'midnight-jazz',
    number: 12,
    title: 'Midnight Jazz',
    artist: 'Smooth Grooves',
    genre: 'R&B',
    bpm: 88,
    mood: 'Dark',
    color: 'bg-gradient-to-br from-red-700 to-rose-500',
    accentCyan: false,
    story:
      'A late-night session that started as a warmup and became the best thing anyone in the room had ever recorded. Smooth Grooves almost didn\'t release it — felt too personal. Glad they did.',
    credits: [
      { role: 'Produced by', name: 'Smooth Grooves' },
      { role: 'Mixed by', name: 'Blue Note Modern' },
    ],
    spotifyUrl: '#',
    appleMusicUrl: '#',
  },
];

export function getTrackBySlug(slug: string): Track | undefined {
  return tracks.find((t) => t.slug === slug);
}
