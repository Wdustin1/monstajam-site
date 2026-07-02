'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'monstajam-featured-vote';
const VISITOR_ID_KEY = 'monstajam-visitor-id';

const VOTE_OPTIONS = [
  {
    id: 'fallback-song',
    label: 'Song',
    description: 'Which track should get the next push?',
    voteCount: 0,
  },
  {
    id: 'fallback-cover-art',
    label: 'Cover art',
    description: 'Which visual should represent the drop?',
    voteCount: 0,
  },
  {
    id: 'fallback-remix',
    label: 'Remix',
    description: 'Which remix idea deserves a lane?',
    voteCount: 0,
  },
  {
    id: 'fallback-artist',
    label: 'Artist',
    description: 'Which artist should MonstaJam spotlight?',
    voteCount: 0,
  },
  {
    id: 'fallback-future-release',
    label: 'Future release',
    description: 'What should the community help shape next?',
    voteCount: 0,
  },
];

type VoteOption = {
  id: string;
  label: string;
  description: string;
  voteCount: number;
};

type FeaturedVotePayload = {
  options: VoteOption[];
  selectedOptionId: string | null;
  totals: {
    votes: number;
  };
};

function getOrCreateVisitorId() {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const id = `visitor_${crypto.randomUUID()}`;
  localStorage.setItem(VISITOR_ID_KEY, id);
  return id;
}

export default function FeaturedVote() {
  const [visitorId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return getOrCreateVisitorId();
  });
  const [options, setOptions] = useState<VoteOption[]>(VOTE_OPTIONS);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('Loading the live vote…');

  useEffect(() => {
    if (!visitorId) {
      return;
    }

    const currentVisitorId = visitorId;
    let isCancelled = false;

    async function loadFeaturedVote() {
      try {
        const response = await fetch(`/api/community/featured-vote?visitorId=${encodeURIComponent(currentVisitorId)}`);
        if (!response.ok) {
          throw new Error('Failed to load featured vote');
        }

        const payload = (await response.json()) as FeaturedVotePayload;
        if (isCancelled) {
          return;
        }

        setOptions(payload.options);
        setSelectedOptionId(payload.selectedOptionId);
        setTotalVotes(payload.totals.votes);
        setStatusText(
          payload.selectedOptionId
            ? 'Vote saved on this device and synced to the database.'
            : 'Choose one option to preview the vote flow.'
        );
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          const savedLabel = localStorage.getItem(STORAGE_KEY);
          setSelectedOptionId(
            savedLabel ? VOTE_OPTIONS.find((option) => option.label === savedLabel)?.id ?? null : null
          );
          setStatusText('Vote is offline right now; your browser can still preview the selection.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFeaturedVote();

    return () => {
      isCancelled = true;
    };
  }, [visitorId]);

  async function handleVote(option: VoteOption) {
    if (!visitorId || isLoading || isSaving) {
      return;
    }

    setIsSaving(true);
    setSelectedOptionId(option.id);
    setStatusText('Saving vote…');
    localStorage.setItem(STORAGE_KEY, option.label);

    try {
      const response = await fetch('/api/community/featured-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, optionId: option.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to save featured vote');
      }

      const payload = (await response.json()) as FeaturedVotePayload;
      setOptions(payload.options);
      setSelectedOptionId(payload.selectedOptionId);
      setTotalVotes(payload.totals.votes);
      setStatusText('Vote saved on this device and synced to the database.');
    } catch (error) {
      console.error(error);
      setStatusText('Could not sync yet. Your device selection is still saved for this preview.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      data-section-id="featured-vote"
      className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/[0.06] p-5 md:p-6 shadow-[0_0_28px_rgba(0,229,255,0.08)]"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
              Featured Vote
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              Database backed
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          </div>
          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
            What should MonstaJam push next?
          </h3>
          <p className="text-sm leading-relaxed text-gray-400">
            Pick one direction for the first community campaign. This now saves through the MonstaJam database, while still keeping a simple browser identity for the MVP.
          </p>
        </div>

        <div className="grid gap-2.5">
          {options.map((option) => {
            const isSelected = selectedOptionId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isLoading || isSaving}
                onClick={() => handleVote(option)}
                className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-wait disabled:opacity-75 ${
                  isSelected
                    ? 'border-cyan-200 bg-cyan-200/15 shadow-[0_0_18px_rgba(0,229,255,0.18)]'
                    : 'border-white/10 bg-black/25 hover:border-cyan-300/35 hover:bg-cyan-300/[0.07]'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-black uppercase tracking-tight text-white">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                      {option.description}
                    </span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                      {option.voteCount} {option.voteCount === 1 ? 'vote' : 'votes'}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      isSelected
                        ? 'border-cyan-100 bg-cyan-100 text-black'
                        : 'border-white/20 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-relaxed text-gray-400">
          {selectedOptionId ? (
            <span>{statusText}</span>
          ) : (
            <span>{statusText}</span>
          )}
        </div>
      </div>
    </section>
  );
}
