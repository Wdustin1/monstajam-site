'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Coins, History } from 'lucide-react';
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

function formatRewardDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

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
          setStatus('Saved to this browser for now. Community accounts can connect balances later.');
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setStatus('Credit balance is temporarily unavailable. Try again in a moment.');
      }
    }

    loadRewards();
    return () => { cancelled = true; };
  }, [visitorId]);

  return (
    <section data-section-id="community-rewards" className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-200/20 bg-[linear-gradient(145deg,rgba(253,230,138,0.12),rgba(255,255,255,0.025))] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full border border-amber-100/10" />
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-black">
          <Coins aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.24em] text-amber-100/70">Credit balance</p>
        <div className="mt-2 font-mono text-6xl font-black tracking-[-0.06em] text-white" aria-live="polite">
          {rewards?.creditsBalance ?? '—'}
        </div>
        <p className="mt-2 text-sm font-semibold text-gray-300">MonstaJam community credits</p>
        <p className="mt-6 text-xs leading-6 text-gray-500">{status}</p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/[0.05] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Live earning rule</p>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">First vote in a campaign</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                Cast one vote in the active poll and keep the reward even if you change your pick. Changing your vote does not earn extra credits.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-cyan-200 px-3 py-2 font-mono text-sm font-black text-black">
              +{rewards?.voteReward ?? 5}
            </span>
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-gray-500">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-cyan-200" />
            Once per campaign, per browser
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <History aria-hidden="true" className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-white">Recent activity</h2>
          </div>

          {rewards && rewards.recentRewards.length > 0 ? (
            <div className="mt-4 divide-y divide-white/10">
              {rewards.recentRewards.map((reward) => (
                <div key={`${reward.createdAt}-${reward.reason}`} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{reward.reason}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatRewardDate(reward.createdAt)}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-black text-cyan-200">+{reward.amount}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-gray-500">
              No rewards yet. Cast your first vote to start the activity log.
            </div>
          )}
        </div>

        <p className="px-1 text-xs leading-6 text-gray-600">
          Comments, shares, and support rewards are not live yet. They will appear only after those actions are real and protected from spam.
        </p>
      </div>
    </section>
  );
}
