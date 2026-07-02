import FeaturedVote from '@/components/FeaturedVote';

const HUB_CARDS = [
  {
    eyebrow: '01',
    id: 'vote-on-music',
    title: 'Vote on Music',
    status: 'MVP path',
    body:
      'Fans will use credits or points to vote on songs, covers, remixes, artists, and future releases. Start simple: one campaign, clear options, visible results.',
    bullets: ['songs + covers', 'remixes', 'future drops'],
  },
  {
    eyebrow: '02',
    id: 'community-chat',
    title: 'Community Chat',
    status: 'WhatsApp first',
    body:
      'Give the community a place to talk now without overbuilding. The first version can point fans into WhatsApp; later this can become native website chat.',
    bullets: ['feedback', 'creator support', 'song discussion'],
  },
  {
    eyebrow: '03',
    id: 'drop-requests',
    title: 'Drop Requests',
    status: 'Fan input',
    body:
      'Collect what listeners want more of: song ideas, remix directions, cover concepts, collabs, and future release themes. Keep it fan-led instead of turning the hub into another generic submission funnel.',
    bullets: ['song ideas', 'remix requests', 'cover directions'],
  },
  {
    eyebrow: '04',
    id: 'rewards-credits',
    title: 'Rewards / Credits',
    status: 'Engagement loop',
    body:
      'Users earn credits by voting, commenting, sharing, joining campaigns, and supporting releases. Credits become the non-crypto bridge into deeper access.',
    bullets: ['earn credits', 'spend votes', 'unlock perks'],
  },
  {
    eyebrow: '05',
    id: 'premium-token-access',
    title: 'Premium / Token Access',
    status: 'Coming Soon',
    body:
      'Coming Soon: private listening rooms, early demos, Q&A sessions, badges, VIP areas, subscriptions, and ETH / Monsta token access.',
    bullets: ['VIP rooms', 'early demos', 'Monsta tokens'],
  },
];

const HUB_ACTIONS = [
  {
    id: 'vote-track',
    label: 'Vote on a track',
    eyebrow: 'Fan action',
    href: '#library',
    body: 'Start by listening through the library and picking what deserves the next push.',
  },
  {
    id: 'join-community',
    label: 'Join the community',
    eyebrow: 'Chat action',
    href: process.env.NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL || '#community-chat',
    body: 'Use the configured WhatsApp or community invite when it is ready; until then this jumps to the chat plan.',
  },
  {
    id: 'request-drop',
    label: 'Suggest the next drop',
    eyebrow: 'Fan action',
    href: '#drop-requests',
    body: 'Point the crowd toward requests for songs, remixes, cover directions, collabs, and future release themes.',
  },
  {
    id: 'earn-credits',
    label: 'See credit rules',
    eyebrow: 'Rewards action',
    href: '#rewards-credits',
    body: 'Show how fans will earn credits by voting, commenting, sharing, and supporting drops.',
  },
  {
    id: 'premium-access',
    label: 'Watch premium access',
    eyebrow: 'Future action',
    href: '#premium-token-access',
    body: 'Preview the premium, subscription, VIP, and Monsta token access layer without overbuilding it yet.',
  },
];

export default function CommunityHub() {
  return (
    <section
      id="community-hub"
      data-section-id="community-hub"
      className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24"
    >
      <div className="rounded-[2rem] border border-white/10 bg-[#08070d]/90 overflow-hidden relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{
            background:
              'radial-gradient(circle at 15% 10%, rgba(0,229,255,0.16), transparent 32%), radial-gradient(circle at 85% 0%, rgba(255,0,255,0.13), transparent 30%)',
          }}
        />

        <div className="relative p-6 md:p-10 lg:p-12">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-14 items-start">
            <div className="lg:sticky lg:top-28 flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Community Hub
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                  Vote, talk, support, and help decide what drops next.
                </h2>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-xl">
                  MonstaJam can become the home base for fans, producers, and AI music creators who want to support each other instead of getting lost in a feed.
                </p>
              </div>

              <div data-section-id="community-actions" className="grid gap-3">
                {HUB_ACTIONS.map((action) => (
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
                    <span className="mt-2 block text-xs leading-relaxed text-gray-500">
                      {action.body}
                    </span>
                  </a>
                ))}
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                First version stays lightweight: clear hub copy, voting direction, chat entry point, drop requests, and credits. Native chat and token-gated rooms come after the community proves itself.
              </p>
            </div>

            <div className="grid gap-4">
              <FeaturedVote />
              {HUB_CARDS.map((card) => (
                <article
                  key={card.title}
                  id={card.id}
                  className="scroll-mt-28 group rounded-3xl border border-white/10 bg-black/30 p-5 md:p-6 hover:border-cyan-300/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-black text-cyan-200">
                      {card.eyebrow}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
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
    </section>
  );
}
