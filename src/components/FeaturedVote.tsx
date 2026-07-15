'use client';

import { useEffect, useState } from 'react';
import { Check, Coins, LoaderCircle, Radio } from 'lucide-react';
import { getOrCreateCommunityVisitorId } from '@/lib/community/visitor';

const STORAGE_KEY = 'monstajam-featured-vote';

const VOTE_OPTIONS = [
  { id: 'fallback-song', label: 'Song', description: 'Which track should get the next push?', voteCount: 0 },
  { id: 'fallback-cover-art', label: 'Cover art', description: 'Which visual should represent the drop?', voteCount: 0 },
  { id: 'fallback-remix', label: 'Remix', description: 'Which remix idea deserves a lane?', voteCount: 0 },
  { id: 'fallback-artist', label: 'Artist', description: 'Which artist should MonstaJam spotlight?', voteCount: 0 },
  { id: 'fallback-future-release', label: 'Future release', description: 'What should the community help shape next?', voteCount: 0 },
];

type VoteOption = {
  id: string;
  label: string;
  description: string;
  voteCount: number;
};

type FeaturedVotePayload = {
  campaign: {
    id: string;
    slug: string;
    title: string;
    question: string;
    description: string;
    status: string;
  };
  options: VoteOption[];
  selectedOptionId: string | null;
  totals: { votes: number };
  rewards: { creditsBalance: number; voteReward: number };
};

export default function FeaturedVote() {
  const [visitorId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getOrCreateCommunityVisitorId();
  });
  const [campaignTitle, setCampaignTitle] = useState('Featured Vote');
  const [campaignQuestion, setCampaignQuestion] = useState('What should MonstaJam push next?');
  const [campaignDescription, setCampaignDescription] = useState('Pick one direction for the active community campaign.');
  const [options, setOptions] = useState<VoteOption[]>(VOTE_OPTIONS);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('Loading the live vote…');

  useEffect(() => {
    if (!visitorId) return;

    const currentVisitorId = visitorId;
    let isCancelled = false;

    async function loadFeaturedVote() {
      try {
        const response = await fetch(`/api/community/featured-vote?visitorId=${encodeURIComponent(currentVisitorId)}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to load featured vote');

        const payload = (await response.json()) as FeaturedVotePayload;
        if (isCancelled) return;

        setCampaignTitle(payload.campaign.title);
        setCampaignQuestion(payload.campaign.question);
        setCampaignDescription(payload.campaign.description || 'Pick one direction for the active community campaign.');
        setOptions(payload.options);
        setSelectedOptionId(payload.selectedOptionId);
        setTotalVotes(payload.totals.votes);
        setCreditsBalance(payload.rewards.creditsBalance);
        setStatusText(
          payload.selectedOptionId
            ? 'Vote saved on this device and counted in the live results.'
            : 'Choose one option to cast your vote.'
        );
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          const savedLabel = localStorage.getItem(STORAGE_KEY);
          setSelectedOptionId(savedLabel ? VOTE_OPTIONS.find((option) => option.label === savedLabel)?.id ?? null : null);
          setStatusText('The live vote is temporarily offline. Try again in a moment.');
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadFeaturedVote();
    return () => { isCancelled = true; };
  }, [visitorId]);

  async function handleVote(option: VoteOption) {
    if (!visitorId || isLoading || isSaving) return;

    const previousSelectedOptionId = selectedOptionId;
    const previousStoredLabel = localStorage.getItem(STORAGE_KEY);

    setIsSaving(true);
    setSelectedOptionId(option.id);
    setStatusText('Saving your vote…');

    try {
      const response = await fetch('/api/community/featured-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, optionId: option.id }),
      });
      if (!response.ok) throw new Error('Failed to save featured vote');

      const payload = (await response.json()) as FeaturedVotePayload;
      setCampaignTitle(payload.campaign.title);
      setCampaignQuestion(payload.campaign.question);
      setCampaignDescription(payload.campaign.description || 'Pick one direction for the active community campaign.');
      setOptions(payload.options);
      setSelectedOptionId(payload.selectedOptionId);
      setTotalVotes(payload.totals.votes);
      setCreditsBalance(payload.rewards.creditsBalance);
      localStorage.setItem(STORAGE_KEY, option.label);
      setStatusText('Vote counted. Your first vote in each campaign earns +5 credits.');
    } catch (error) {
      console.error(error);
      setSelectedOptionId(previousSelectedOptionId);
      if (previousStoredLabel === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, previousStoredLabel);
      }
      setStatusText('Your vote was not saved. Nothing changed—please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section data-section-id="featured-vote" className="overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-[#071016]">
      <div className="border-b border-white/10 px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
            <Radio aria-hidden="true" className="h-3.5 w-3.5" /> Live vote
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">
            <Coins aria-hidden="true" className="h-3.5 w-3.5" /> {creditsBalance} credits
          </span>
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/70">{campaignTitle}</p>
        <h2 className="mt-2 max-w-4xl text-3xl font-black uppercase leading-[1.02] tracking-[-0.035em] text-white sm:text-4xl md:text-5xl">
          {campaignQuestion}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400">{campaignDescription}</p>
      </div>

      <div className="p-4 sm:p-6 md:p-7">
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option, index) => {
            const isSelected = selectedOptionId === option.id;
            const votePercentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isLoading || isSaving}
                onClick={() => handleVote(option)}
                className={`group relative min-h-[132px] overflow-hidden rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-70 ${
                  index === options.length - 1 && options.length % 2 === 1 ? 'sm:col-span-2' : ''
                } ${
                  isSelected
                    ? 'border-cyan-200/70 bg-cyan-200/15 shadow-[0_0_24px_rgba(0,229,255,0.12)]'
                    : 'border-white/10 bg-black/25 hover:border-cyan-300/35 hover:bg-white/[0.04]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1 bg-white/[0.04]"
                >
                  <span className="block h-full bg-cyan-200/70 transition-[width]" style={{ width: `${votePercentage}%` }} />
                </span>
                <span className="flex h-full items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-base font-black uppercase tracking-tight text-white">{option.label}</span>
                    <span className="mt-1.5 block max-w-md text-xs leading-5 text-gray-400">{option.description}</span>
                    <span className="mt-4 block text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">
                      {option.voteCount} {option.voteCount === 1 ? 'vote' : 'votes'} · {votePercentage}%
                    </span>
                  </span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-cyan-100 bg-cyan-100 text-black' : 'border-white/20 text-transparent'}`}>
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-5 text-gray-300"
          >
            {isSaving && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin text-cyan-200" />}
            {statusText}
          </div>
          <div className="rounded-xl border border-amber-200/20 bg-amber-200/[0.07] px-4 py-3 text-xs font-semibold leading-5 text-amber-100/90">
            +5 for your first vote. Switching picks earns no extra credits.
          </div>
        </div>
      </div>
    </section>
  );
}
