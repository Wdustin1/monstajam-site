'use client';

import { useState } from 'react';

const STORAGE_KEY = 'monstajam-featured-vote';

const VOTE_OPTIONS = [
  {
    label: 'Song',
    description: 'Which track should get the next push?',
  },
  {
    label: 'Cover art',
    description: 'Which visual should represent the drop?',
  },
  {
    label: 'Remix',
    description: 'Which remix idea deserves a lane?',
  },
  {
    label: 'Artist',
    description: 'Which artist should MonstaJam spotlight?',
  },
  {
    label: 'Future release',
    description: 'What should the community help shape next?',
  },
];

export default function FeaturedVote() {
  const [selectedVote, setSelectedVote] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem(STORAGE_KEY);
  });

  function handleVote(label: string) {
    setSelectedVote(label);
    localStorage.setItem(STORAGE_KEY, label);
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
              Frontend preview
            </span>
          </div>
          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
            What should MonstaJam push next?
          </h3>
          <p className="text-sm leading-relaxed text-gray-400">
            Pick one direction for the first community campaign. For now this saves on your device so we can shape the voting experience before wiring the backend.
          </p>
        </div>

        <div className="grid gap-2.5">
          {VOTE_OPTIONS.map((option) => {
            const isSelected = selectedVote === option.label;

            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleVote(option.label)}
                className={`rounded-2xl border p-4 text-left transition-all ${
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
          {selectedVote ? (
            <span>
              Vote saved on this device: <strong className="text-cyan-100">{selectedVote}</strong>. You can change it anytime while this preview is local-only.
            </span>
          ) : (
            <span>Choose one option to preview the vote flow.</span>
          )}
        </div>
      </div>
    </section>
  );
}
