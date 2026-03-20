'use client';

import { useState, useCallback } from 'react';
import {
  Home, LayoutGrid, Upload, Users, Folder, Settings,
  LogOut, Bell, ChevronDown, Plus, CloudUpload
} from 'lucide-react';

// ─── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV = [
  { icon: Home,        label: 'Home',      href: '/' },
  { icon: LayoutGrid,  label: 'Dashboard',  href: '#' },
  { icon: Upload,      label: 'Upload',     href: '/upload', active: true },
  { icon: Users,       label: 'Audience',   href: '#' },
  { icon: Folder,      label: 'Files',      href: '#' },
  { icon: Settings,    label: 'Settings',   href: '#' },
];

// ─── Recently uploaded mock data ───────────────────────────────────────────────

type TrackStatus = 'Processing' | 'Live' | 'Draft';

interface RecentTrack {
  id: number;
  title: string;
  status: TrackStatus;
  color: string; // bar color class
  badge: string; // text color class
  badgeBg: string;
  borderColor: string;
}

const RECENT: RecentTrack[] = [
  {
    id: 1,
    title: 'Neon Dreams',
    status: 'Processing',
    color: 'bg-[#00d2ff]',
    badge: 'text-[#00d2ff]',
    badgeBg: 'bg-[#00d2ff]/10 border-[#00d2ff]/50',
    borderColor: 'border-[#00d2ff]/40',
  },
  {
    id: 2,
    title: 'Cyber Groove',
    status: 'Live',
    color: 'bg-green-400',
    badge: 'text-green-400',
    badgeBg: 'bg-green-500/10 border-green-500/50',
    borderColor: 'border-green-500/30',
  },
  {
    id: 3,
    title: 'Midnight Vibe',
    status: 'Processing',
    color: 'bg-[#ff00cc]',
    badge: 'text-[#ff00cc]',
    badgeBg: 'bg-[#ff00cc]/10 border-[#ff00cc]/50',
    borderColor: 'border-[#2a2d3d]',
  },
];

// ─── Mini waveform icon ─────────────────────────────────────────────────────────

function WaveIcon({ colorClass }: { colorClass: string }) {
  const heights = [8, 16, 12, 16, 8];
  return (
    <div className="flex items-center gap-[2px] h-4">
      {heights.map((h, i) => (
        <div key={i} className={`w-[2px] rounded-full ${colorClass}`} style={{ height: h }} />
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function UploadDashboard() {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const [platformLink, setPlatformLink] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setFileName(file.name);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  }, []);

  return (
    <div
      className="h-screen w-screen overflow-hidden flex font-sans text-white"
      style={{ backgroundColor: '#1e1e24' }}
    >
      {/* ── Icon Sidebar ── */}
      <aside
        className="w-16 h-full flex flex-col items-center py-4 z-20 shrink-0"
        style={{
          backgroundColor: '#1e1e24',
          borderRight: '1px solid',
          borderImageSource: 'linear-gradient(to bottom, #00d2ff, #ff00cc)',
          borderImageSlice: 1,
        }}
      >
        {/* Logo */}
        <div className="mb-8 w-8 h-8 rounded-lg relative overflow-hidden flex items-center justify-center"
          style={{ background: 'linear-gradient(to tr, #00d2ff, #ff00cc)' }}>
          <div className="absolute inset-[2px] rounded-md flex items-center justify-center"
            style={{ backgroundColor: '#1e1e24' }}>
            <span className="font-bold text-lg"
              style={{
                background: 'linear-gradient(to right, #00d2ff, #ff00cc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
              A
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-6 w-full items-center flex-1">
          {NAV.map(({ icon: Icon, label, href, active }) => (
            <a
              key={label}
              href={href}
              title={label}
              className="relative flex items-center justify-center w-full transition-colors"
              style={{ color: active ? '#ff00cc' : '#a0a5ba' }}
            >
              {active && (
                <div
                  className="absolute left-0 w-1 h-8 rounded-r-md"
                  style={{ backgroundColor: '#ff00cc', boxShadow: '0 0 10px #ff00ff' }}
                />
              )}
              <Icon
                className="w-5 h-5"
                style={active ? { filter: 'drop-shadow(0 0 8px rgba(255,0,255,0.8))' } : undefined}
              />
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="mt-auto">
          <a href="#" title="Logout" className="transition-colors" style={{ color: '#a0a5ba' }}>
            <LogOut className="w-5 h-5" />
          </a>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top header */}
        <header
          className="h-16 flex items-center justify-between px-6 shrink-0 z-10"
          style={{
            backgroundColor: 'rgba(30,30,36,0.5)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid',
            borderImageSource: 'linear-gradient(to right, #00d2ff, #ff00cc)',
            borderImageSlice: 1,
          }}
        >
          <h1 className="text-xl font-semibold tracking-wide">Artist Upload Dashboard</h1>
          <div className="flex items-center gap-6">
            {/* Bell */}
            <button className="relative transition-colors" style={{ color: '#a0a5ba' }}>
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                1
              </span>
            </button>
            {/* User */}
            <div className="flex items-center gap-3 cursor-pointer">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #00d2ff, #ff00cc)',
                  border: '1px solid rgba(0,210,255,0.5)',
                }}
              >
                AK
              </div>
              <div className="flex flex-col text-sm">
                <span className="text-xs" style={{ color: '#a0a5ba' }}>Artist:</span>
                <span className="font-medium flex items-center gap-1">
                  Alex K.
                  <ChevronDown className="w-3 h-3" style={{ color: '#a0a5ba' }} />
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex flex-1 overflow-hidden relative">

          {/* Ambient glows */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div
              className="absolute rounded-full"
              style={{
                width: 800, height: 600,
                background: 'rgba(0,210,255,0.05)',
                filter: 'blur(120px)',
                top: -200, left: -200,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 800, height: 600,
                background: 'rgba(255,0,204,0.05)',
                filter: 'blur(120px)',
                bottom: -200, right: -200,
              }}
            />
          </div>

          {/* ── Recently Uploaded panel ── */}
          <aside
            className="w-[300px] h-full flex flex-col z-10 shrink-0 relative"
            style={{
              backgroundColor: 'rgba(30,30,36,0.8)',
              backdropFilter: 'blur(12px)',
              borderRight: '1px solid',
              borderImageSource: 'linear-gradient(to bottom, #00d2ff, #ff00cc)',
              borderImageSlice: 1,
            }}
          >
            <div className="p-6 pb-4 shrink-0">
              <h2 className="text-lg font-medium">Recently Uploaded</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2d3d transparent' }}>
              {RECENT.map((track) => (
                <div
                  key={track.id}
                  className={`p-3 flex items-center gap-3 rounded-xl border ${
                    track.status === 'Processing' && track.color === 'bg-[#00d2ff]'
                      ? ''
                      : `${track.borderColor} bg-[#1a1b26]/50`
                  }`}
                  style={
                    track.status === 'Processing' && track.color === 'bg-[#00d2ff]'
                      ? {
                          background: 'linear-gradient(#1e1e24, #1e1e24) padding-box, linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc) border-box',
                          border: '2px solid transparent',
                          borderRadius: 12,
                        }
                      : {}
                  }
                >
                  <div className="w-10 h-10 rounded-lg bg-[#1a1b26] flex items-center justify-center flex-shrink-0">
                    <WaveIcon colorClass={track.color} />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${track.status === 'Processing' && track.color !== 'bg-[#00d2ff]' ? 'text-[#a0a5ba]' : 'text-white'}`}>
                      {track.title}
                    </span>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 mt-1 w-max border ${track.badge} ${track.badgeBg}`}>
                      {track.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* ── Main upload form ── */}
          <main className="flex-1 h-full overflow-y-auto z-10 p-8 flex justify-center items-start">
            <div className="max-w-2xl w-full flex flex-col gap-6 pt-4 pb-12">

              {/* Drag & Drop zone */}
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="relative w-full cursor-pointer rounded-xl flex flex-col items-center justify-center transition-colors"
                style={{
                  minHeight: 200,
                  aspectRatio: '2/1',
                  background: `linear-gradient(${dragging ? '#1f2236' : '#1e1e24'}, ${dragging ? '#1f2236' : '#1e1e24'}) padding-box, linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc) border-box`,
                  border: '2px solid transparent',
                  boxShadow: dragging
                    ? '0 0 25px rgba(0,210,255,0.4), 0 0 25px rgba(255,0,204,0.4)'
                    : '0 0 15px rgba(0,240,255,0.3), 0 0 15px rgba(255,0,255,0.3)',
                }}
              >
                <input
                  type="file"
                  accept=".mp3,.wav,.flac,.aiff"
                  className="sr-only"
                  onChange={handleFileInput}
                />
                <CloudUpload
                  className="w-16 h-16 mb-4"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))', color: 'white' }}
                />
                {fileName ? (
                  <>
                    <h3 className="text-xl font-medium mb-1">{fileName}</h3>
                    <p className="text-sm" style={{ color: '#a0a5ba' }}>Click to replace</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-medium mb-1">Drag and Drop</h3>
                    <p className="text-sm" style={{ color: '#a0a5ba' }}>your audio files here (MP3/WAV)</p>
                  </>
                )}
              </label>

              {/* Neon divider */}
              <div
                className="w-full mb-2"
                style={{
                  height: 4,
                  background: 'linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc)',
                  borderRadius: 2,
                  boxShadow: '0 0 10px rgba(0,240,255,0.5), 0 0 10px rgba(255,0,255,0.5)',
                }}
              />

              {/* Track title + Genre */}
              <div className="grid grid-cols-2 gap-4 w-full">
                {[
                  { value: title, setter: setTitle, placeholder: 'Track Title' },
                  { value: genre, setter: setGenre, placeholder: 'Genre' },
                ].map(({ value, setter, placeholder }) => (
                  <div
                    key={placeholder}
                    style={{
                      background: 'linear-gradient(#1e1e24, #1e1e24) padding-box, linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc) border-box',
                      border: '2px solid transparent',
                      borderRadius: 12,
                    }}
                  >
                    <input
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-4 py-3 bg-transparent text-white placeholder-[#a0a5ba] outline-none focus:ring-0 text-sm"
                      style={{ borderRadius: 12 }}
                    />
                  </div>
                ))}
              </div>

              {/* Collaborators */}
              <div className="flex items-center gap-4 w-full">
                <div
                  className="flex-1"
                  style={{
                    background: 'linear-gradient(#1e1e24, #1e1e24) padding-box, linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc) border-box',
                    border: '2px solid transparent',
                    borderRadius: 12,
                  }}
                >
                  <input
                    value={collaborators}
                    onChange={(e) => setCollaborators(e.target.value)}
                    placeholder="Collaborators"
                    className="w-full px-4 py-3 bg-transparent text-white placeholder-[#a0a5ba] outline-none focus:ring-0 text-sm"
                    style={{ borderRadius: 12 }}
                  />
                </div>
                <button
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:bg-[#1e1e24] flex-shrink-0"
                  style={{ border: '1px solid #2a2d3d', color: '#00d2ff' }}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Platform link */}
              <div
                style={{
                  background: 'linear-gradient(#1e1e24, #1e1e24) padding-box, linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc) border-box',
                  border: '2px solid transparent',
                  borderRadius: 12,
                }}
              >
                <div className="relative flex items-center w-full">
                  <input
                    value={platformLink}
                    onChange={(e) => setPlatformLink(e.target.value)}
                    placeholder="Connect Spotify / Apple Music Link"
                    className="w-full pl-4 pr-24 py-3 bg-transparent text-white placeholder-[#a0a5ba] outline-none focus:ring-0 text-sm"
                    style={{ borderRadius: 12 }}
                  />
                  <div className="absolute right-4 flex items-center gap-3">
                    {/* Spotify */}
                    <button title="Spotify">
                      <svg className="w-6 h-6 text-green-500 hover:text-green-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.48-3.48C15.12 7.02 8.76 6.84 5.1 7.92c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.2 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.24.54-.9.72-1.5.42z"/>
                      </svg>
                    </button>
                    {/* Apple */}
                    <button title="Apple Music">
                      <svg className="w-6 h-6 text-white hover:text-gray-300 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-center mt-4">
                <button
                  className="px-8 py-3 text-white font-medium tracking-wide hover:scale-[1.02] active:scale-95 transition-transform"
                  style={{
                    background: 'linear-gradient(#1e1e24, #1e1e24) padding-box, linear-gradient(to right, #00d2ff, #3a7bd5, #ff00cc) border-box',
                    border: '2px solid transparent',
                    borderRadius: 12,
                    boxShadow: '0 0 15px rgba(0,240,255,0.4), 0 0 15px rgba(255,0,255,0.4)',
                  }}
                >
                  Submit for Review
                </button>
              </div>

            </div>
          </main>

        </div>
      </div>
    </div>
  );
}
