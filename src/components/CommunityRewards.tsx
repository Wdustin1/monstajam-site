'use client';

import { useEffect, useState } from 'react';
import { getOrCreateCommunityVisitorId } from '@/lib/community/visitor';

type RewardPayload = {
  creditsBalance: number;
  voteReward: number;
  recentRewards: Array<{
    action: string;
    amount: number;
    reason: string;
    campaignId: string | null;
    createdAt: string;
  }>;
};

export default function CommunityRewards() {
  const [visitorId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getOrCreateCommunityVisitorId();
  });
  const [rewards, setRewards] = useState<RewardPayload | null>(null);
  const [status, setStatus] = useState('Loading your credit balance…');

  useEffect(() => {
    if (!visitorId) return;

    let cancelled = false;

    async function loadRewards() {
      try {
        const response = await fetch(`/api/community/rewards?visitorId=${encodeURIComponent(visitorId!)}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Rewards failed to load');

        const payload = (await response.json()) as RewardPayload;
        if (!cancelled) {
          setRewards(payload);
          setStatus('Your balance is tied to this browser for now. Accounts can come later.');
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setStatus('Credit balance is temporarily unavailable.');
      }
    }

    loadRewards();
    return () => {
      cancelled = true;
    };
  }, [visitorId]);

  return (
    <section
      data-section-id="community-rewards"
      className="rounded-[1.75rem] border border-amber-200/20 bg-amber-200/[0.05] p-5 md:p-6"
    >
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/80">Credit balance</div>
          <div className="mt-3 font-mono text-5xl font-black text-white" aria-live="polite">
            {rewards?.creditsBalance ?? '—'}
          </div>
          <div className="mt-2 text-sm text-gray-400">MonstaJam community credits</div>
          <p className="mt-5 text-xs leading-relaxed text-gray-500">{status}</p>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-white">First vote in a campaign</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">Cast one vote in the active poll and keep the reward even if you change your pick.</p>
              </div>
              <span className="shrink-0 rounded-full bg-cyan-200 px-3 py-1 font-mono text-sm font-black text-black">
                +{rewards?.voteReward ?? 5}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-relaxed text-gray-400">
            Changing your vote does not earn extra credits. Each browser can earn the vote reward once per campaign.
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-gray-500">
            Comments, shares, and support rewards are not live yet. They will only appear here after those actions are real and protected from spam.
          </div>
        </div>
      </div>
    </section>
  );
}
