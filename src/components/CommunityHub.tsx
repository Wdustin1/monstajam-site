'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Headphones, LockKeyhole, MessageCircle, Sparkles, Trophy } from 'lucide-react';
import FeaturedVote from '@/components/FeaturedVote';
import CommunityRewards from '@/components/CommunityRewards';

const COMMUNITY_TABS = [
  { id: 'vote', label: 'Vote', eyebrow: 'Live now' },
  { id: 'talk', label: 'Talk', eyebrow: 'Community' },
  { id: 'rewards', label: 'Rewards', eyebrow: 'Your credits' },
  { id: 'access', label: 'Access', eyebrow: 'Coming soon' },
] as const;

type CommunityTabId = (typeof COMMUNITY_TABS)[number]['id'];
type RoomSettings = {
  platform: 'WhatsApp' | 'Discord' | 'Telegram' | 'Other';
  roomName: string;
  inviteUrl: string | null;
  announcement: string | null;
  isOpen: boolean;
};

const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  platform: 'WhatsApp',
  roomName: 'MonstaJam Community',
  inviteUrl: null,
  announcement: null,
  isOpen: false,
};

function isValidRoomSettings(value: unknown): value is RoomSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoomSettings>;
  const validPlatform = ['WhatsApp', 'Discord', 'Telegram', 'Other'].includes(candidate.platform ?? '');
  const validRoomName = typeof candidate.roomName === 'string' && candidate.roomName.length >= 2 && candidate.roomName.length <= 80;
  const validAnnouncement = candidate.announcement === null || (typeof candidate.announcement === 'string' && candidate.announcement.length <= 180);
  let validInviteUrl = candidate.inviteUrl === null;

  if (typeof candidate.inviteUrl === 'string' && candidate.inviteUrl.length <= 500) {
    try {
      validInviteUrl = new URL(candidate.inviteUrl).protocol === 'https:';
    } catch {
      validInviteUrl = false;
    }
  }

  return validPlatform
    && validRoomName
    && validAnnouncement
    && validInviteUrl
    && typeof candidate.isOpen === 'boolean'
    && (!candidate.isOpen || Boolean(candidate.inviteUrl));
}

export default function CommunityHub() {
  const [activeTab, setActiveTab] = useState<CommunityTabId>('vote');
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeTabConfig = COMMUNITY_TABS.find((tab) => tab.id === activeTab) ?? COMMUNITY_TABS[0];

  useEffect(() => {
    const controller = new AbortController();

    async function loadRoomSettings() {
      try {
        const response = await fetch('/api/community/settings', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isValidRoomSettings(payload)) {
          setRoomSettings(payload);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('Community room settings could not be refreshed.');
        }
      }
    }

    void loadRoomSettings();
    return () => controller.abort();
  }, []);

  function selectTab(tab: CommunityTabId, index?: number) {
    setActiveTab(tab);
    if (typeof index === 'number') {
      requestAnimationFrame(() => tabRefs.current[index]?.focus());
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % COMMUNITY_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + COMMUNITY_TABS.length) % COMMUNITY_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = COMMUNITY_TABS.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(COMMUNITY_TABS[nextIndex].id, nextIndex);
  }

  return (
    <section
      id="community-hub"
      data-section-id="community-hub"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8"
    >
      <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080711] px-6 py-8 sm:px-8 md:py-12 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(0,229,255,0.18),transparent_34%),radial-gradient(circle_at_92%_12%,rgba(255,0,170,0.14),transparent_30%)]" />
        <div className="pointer-events-none absolute right-[-7rem] top-[-8rem] h-72 w-72 rounded-full border border-cyan-200/10" />
        <div className="pointer-events-none absolute right-[-3rem] top-[-4rem] h-48 w-48 rounded-full border border-fuchsia-300/10" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100 sm:text-xs">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              MonstaJam Community
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black uppercase leading-[0.94] tracking-[-0.045em] text-white sm:text-5xl md:text-7xl">
              Vote on the music. Build the community.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-gray-300 sm:text-base">
              MonstaJam is a home base where fans and AI music creators can vote on songs, cover art, remixes, artist spotlights, and upcoming releases—then join the conversation around every decision.
            </p>
            <a
              href="#community-tabs"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-200 px-5 py-3 text-xs font-black uppercase tracking-[0.17em] text-[#041014] no-underline transition hover:bg-white"
            >
              Choose the first vote
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>

          <div
            data-section-id="community-status-rail"
            className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/10 bg-black/25"
            aria-label="Community status"
          >
            <div className="p-4 sm:p-5">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Campaign</span>
              <span className="mt-2 block text-sm font-black uppercase text-white">Live</span>
            </div>
            <div className="border-x border-white/10 p-4 sm:p-5">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/70">First vote</span>
              <span className="mt-2 block text-sm font-black uppercase text-white">+5 credits</span>
            </div>
            <div className="p-4 sm:p-5">
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-200/70">Results</span>
              <span className="mt-2 block text-sm font-black uppercase text-white">Visible</span>
            </div>
          </div>
        </div>
      </header>

      <div id="community-tabs" data-section-id="community-tabs" className="scroll-mt-28 pt-5 md:pt-7">
        <div
          role="tablist"
          aria-label="Community sections"
          aria-orientation="horizontal"
          className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#080711]/95 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {COMMUNITY_TABS.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                id={`community-tab-${tab.id}`}
                type="button"
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={`community-panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`min-h-14 min-w-[132px] flex-1 rounded-xl px-4 py-3 text-left transition ${
                  isActive
                    ? 'bg-white text-black shadow-[0_10px_28px_rgba(0,0,0,0.28)]'
                    : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className={`block text-[9px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-black/55' : 'text-cyan-200/65'}`}>
                  {tab.eyebrow}
                </span>
                <span className="mt-1 block text-sm font-black uppercase tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div
          id={`community-panel-${activeTabConfig.id}`}
          data-community-panel={activeTabConfig.id}
          role="tabpanel"
          aria-labelledby={`community-tab-${activeTabConfig.id}`}
          className="mt-4 rounded-[2rem] border border-white/10 bg-[#080711]/90 p-4 sm:p-6 md:p-8"
        >
          {activeTab === 'vote' && <FeaturedVote />}

          {activeTab === 'talk' && (
            <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-stretch">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/[0.06] p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-cyan-200/10" />
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <MessageCircle aria-hidden="true" className="h-8 w-8 text-cyan-200" />
                    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${roomSettings.isOpen && roomSettings.inviteUrl ? 'border-emerald-200/25 bg-emerald-200/10 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-gray-400'}`}>
                      {roomSettings.isOpen && roomSettings.inviteUrl ? `${roomSettings.platform} room open` : 'Invite opening soon'}
                    </span>
                  </div>
                  <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/75">Community room</p>
                  <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">{roomSettings.roomName}</h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-gray-400">
                    Trade feedback, talk through the latest tracks, and meet the producers, fans, and AI music creators helping shape each release.
                  </p>
                  {roomSettings.announcement && (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-gray-200">
                      <span className="mr-2 font-black uppercase tracking-[0.14em] text-cyan-200">Now</span>
                      {roomSettings.announcement}
                    </div>
                  )}
                  <div className="mt-6 flex flex-wrap gap-3">
                    {roomSettings.isOpen && roomSettings.inviteUrl ? (
                      <a
                        href={roomSettings.inviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-200 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-black no-underline hover:bg-white"
                      >
                        Join on {roomSettings.platform} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-gray-400"
                      >
                        Invite opening soon
                      </span>
                    )}
                    <Link
                      href="/#library"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white no-underline hover:border-cyan-200/40"
                    >
                      Listen first <Headphones aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid content-start gap-3 rounded-[1.75rem] border border-white/10 bg-black/20 p-4 sm:p-5">
                <div className="px-1 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200/70">Built for real conversation</p>
                  <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">One room. Every release.</h3>
                </div>
                {['React to tracks while they are fresh', 'Follow focused release conversations', 'Support creators and meet other fans'].map((item, index) => (
                  <div key={item} className="flex min-h-16 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-gray-300">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-200/10 font-mono text-xs text-cyan-200">
                      0{index + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'rewards' && <CommunityRewards />}

          {activeTab === 'access' && (
            <section className="relative overflow-hidden rounded-[1.75rem] border border-fuchsia-300/15 bg-[linear-gradient(135deg,rgba(255,0,170,0.09),rgba(0,229,255,0.04))] p-6 sm:p-8 md:p-10">
              <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full border border-fuchsia-200/10" />
              <LockKeyhole aria-hidden="true" className="h-8 w-8 text-fuchsia-200" />
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-200/75">Next access layer</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Premium listening is on the way</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400">
                Private listening rooms, early demos, badges, Q&A sessions, and Monsta token access will appear here only when each experience is ready to use.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {['Early demos', 'Private rooms', 'VIP badges', 'Monsta access'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-gray-300">
                    <Trophy aria-hidden="true" className="h-3.5 w-3.5 text-amber-100" /> {item}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
