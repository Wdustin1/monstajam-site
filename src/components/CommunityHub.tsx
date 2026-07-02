'use client';

import { useState } from 'react';
import FeaturedVote from '@/components/FeaturedVote';

const HUB_CARDS = [
  {
    eyebrow: '01',
    id: 'vote-on-music',
    title: 'Vote on Music',
    status: 'Live loop',
    body:
      'Fans use lightweight votes to influence songs, covers, remixes, artists, and future releases. Start with one clear campaign and visible results.',
    bullets: ['songs + covers', 'remixes', 'future drops'],
    tab: 'vote',
  },
  {
    eyebrow: '02',
    id: 'community-chat',
    title: 'Community Chat',
    status: 'WhatsApp first',
    body:
      'Give fans, producers, and AI music creators a place to talk, share feedback, and support releases without getting buried in a feed.',
    bullets: ['feedback', 'creator support', 'song discussion'],
    tab: 'talk',
  },
  {
    eyebrow: '03',
    id: 'live-vote-campaigns',
    title: 'Live Vote Campaigns',
    status: 'Admin managed',
    body:
      'Rotate focused polls from backstage so participation stays simple: pick a track, choose a cover, rank remix ideas, or decide what gets pushed next.',
    bullets: ['active polls', 'public results', 'campaign rotation'],
    tab: 'vote',
  },
  {
    eyebrow: '04',
    id: 'rewards-credits',
    title: 'Rewards / Credits',
    status: 'Engagement loop',
    body:
      'Fans earn credits by voting, commenting, sharing, joining campaigns, and supporting releases. Credits become the bridge into deeper access.',
    bullets: ['earn credits', 'spend votes', 'unlock perks'],
    tab: 'rewards',
  },
  {
    eyebrow: '05',
    id: 'premium-token-access',
    title: 'Premium / Token Access',
    status: 'Coming Soon',
    body:
      'Coming Soon: private listening rooms, early demos, Q&A sessions, badges, VIP areas, subscriptions, and ETH / Monsta token access.',
    bullets: ['VIP rooms', 'early demos', 'Monsta tokens'],
    tab: 'access',
  },
];

const HUB_ACTIONS = [
  {
    id: 'vote-track',
    label: 'Vote on a track',
    eyebrow: 'Fan action',
    href: '/#library',
    body: 'Start by listening through the library and picking what deserves the next push.',
    tab: 'vote',
  },
  {
    id: 'join-community',
    label: 'Join the community',
    eyebrow: 'Chat action',
    href: process.env.NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL || '#community-chat',
    body: 'Use the configured WhatsApp or community invite when it is ready; until then this opens the chat tab.',
    tab: 'talk',
  },
  {
    id: 'live-vote',
    label: 'Vote in the live poll',
    eyebrow: 'Fan action',
    href: '#featured-vote',
    body: 'Jump straight into the active campaign and help decide what MonstaJam pushes next.',
    tab: 'vote',
  },
  {
    id: 'earn-credits',
    label: 'See credit rules',
    eyebrow: 'Rewards action',
    href: '#rewards-credits',
    body: 'See how fans earn credits by voting, commenting, sharing, and supporting drops.',
    tab: 'rewards',
  },
  {
    id: 'premium-access',
    label: 'Watch premium access',
    eyebrow: 'Future action',
    href: '#premium-token-access',
    body: 'Preview the premium, subscription, VIP, and Monsta token access layer without overbuilding it yet.',
    tab: 'access',
  },
];

const COMMUNITY_TABS = [
  {
    id: 'vote',
    label: 'Vote',
    eyebrow: 'Live campaign',
    heading: 'Vote on what MonstaJam should push next.',
    body:
      'The main community loop starts here: listen, pick a lane, and help choose which track, remix, cover, artist, or future release gets energy next.',
  },
  {
    id: 'talk',
    label: 'Talk',
    eyebrow: 'Community chat',
    heading: 'Bring the fans, producers, and AI music creators together.',
    body:
      'MonstaJam should feel like a home base, not a buried comment thread. The first chat path can point to WhatsApp or another invite, then grow into native community tools later.',
  },
  {
    id: 'rewards',
    label: 'Rewards',
    eyebrow: 'Credits layer',
    heading: 'Turn participation into credits and perks.',
    body:
      'Voting, sharing, commenting, and campaign support can become a simple credit loop that rewards the people who help releases move.',
  },
  {
    id: 'access',
    label: 'Access',
    eyebrow: 'Premium future',
    heading: 'Set up the future VIP and token access layer.',
    body:
      'Keep the current page honest with coming-soon status while leaving a clean lane for subscriptions, listening rooms, drops, badges, and Monsta token access.',
  },
] as const;

type CommunityTabId = (typeof COMMUNITY_TABS)[number]['id'];

export default function CommunityHub() {
  const [activeTab, setActiveTab] = useState<CommunityTabId>('vote');
  const activeTabConfig = COMMUNITY_TABS.find((tab) => tab.id === activeTab) ?? COMMUNITY_TABS[0];
  const activeCards = HUB_CARDS.filter((card) => card.tab === activeTab);
  const activeActions = HUB_ACTIONS.filter((action) => action.tab === activeTab);

  return (
    <section
      id="community-hub"
      data-section-id="community-hub"
      className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16"
    >
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#08070d]/90">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(circle at 15% 10%, rgba(0,229,255,0.16), transparent 32%), radial-gradient(circle at 85% 0%, rgba(255,0,255,0.13), transparent 30%)',
          }}
        />

        <div className="relative p-6 md:p-10 lg:p-12">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Community Hub
              </div>
              <h1 className="text-4xl font-black uppercase leading-tight tracking-tight text-white md:text-6xl">
                Vote, talk, earn, and unlock what drops next.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-gray-400 md:text-base">
                MonstaJam can become the home base for fans, producers, and AI music creators who want to support each other instead of getting lost in a feed.
              </p>
            </div>
            <a
              href="#featured-vote"
              className="inline-flex w-fit items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-100 transition-colors hover:bg-cyan-300/20"
            >
              Start with the live vote →
            </a>
          </div>

          <div data-section-id="community-tabs" className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div
                role="tablist"
                aria-label="Community Hub sections"
                className="grid gap-2 rounded-3xl border border-white/10 bg-black/25 p-2"
              >
                {COMMUNITY_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`community-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`community-panel-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-2xl p-4 text-left transition-colors ${
                        isActive
                          ? 'border border-cyan-300/35 bg-cyan-300/12 text-white shadow-[0_0_24px_rgba(0,229,255,0.12)]'
                          : 'border border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/80">
                        {tab.eyebrow}
                      </span>
                      <span className="mt-1 block text-lg font-black uppercase tracking-tight">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div data-section-id="community-actions" className="grid gap-3">
                {activeActions.map((action) => (
                  <a
                    key={action.id}
                    data-cta-id={action.id}
                    href={action.href}
                    className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 no-underline transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]"
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/80">
                      {action.eyebrow}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-3 text-sm font-black uppercase tracking-tight text-white">
                      {action.label}
                      <span aria-hidden="true" className="text-cyan-200 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-gray-500">{action.body}</span>
                  </a>
                ))}
              </div>
            </div>

            <div
              id={`community-panel-${activeTabConfig.id}`}
              role="tabpanel"
              aria-labelledby={`community-tab-${activeTabConfig.id}`}
              className="min-h-[560px] rounded-[1.75rem] border border-white/10 bg-black/25 p-5 md:p-6"
            >
              <div className="mb-5 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/80">
                  {activeTabConfig.eyebrow}
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white md:text-4xl">
                  {activeTabConfig.heading}
                </h2>
                <p className="max-w-3xl text-sm leading-relaxed text-gray-400">{activeTabConfig.body}</p>
              </div>

              <div className="grid gap-4">
                {activeTab === 'vote' && <FeaturedVote />}

                {activeCards.map((card) => (
                  <article
                    key={card.title}
                    id={card.id}
                    className="scroll-mt-28 rounded-3xl border border-white/10 bg-black/30 p-5 transition-colors hover:border-cyan-300/30 md:p-6"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-black text-cyan-200">
                        {card.eyebrow}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-xl font-black uppercase tracking-tight text-white md:text-2xl">
                            {card.title}
                          </h3>
                          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                            {card.status}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-400">{card.body}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {card.bullets.map((bullet) => (
                            <span
                              key={bullet}
                              className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-gray-300"
                            >
                              {bullet}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
