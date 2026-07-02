'use client';

import { useCallback, useEffect, useState } from 'react';

type Summary = {
  generatedAt: string;
  totals: {
    campaigns: number;
    fanProfiles: number;
    votes: number;
    creditLedgerRows: number;
    artistApplications: number;
    applicationStatusCounts: Record<string, number>;
  };
  campaigns: Array<{
    id: string;
    slug: string;
    title: string;
    question: string;
    status: string;
    voteCount: number;
    uniqueVisitors: number;
    options: Array<{
      id: string;
      label: string;
      description: string;
      voteCount: number;
      votePercent: number;
    }>;
  }>;
  recentApplications: Array<{
    id: string;
    artistName: string;
    email: string | null;
    socialUrl: string | null;
    songUrl: string | null;
    genre: string | null;
    message: string | null;
    status: string;
    createdAt: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 font-mono text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{detail}</div>
    </div>
  );
}

export default function CommunityAdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);

    try {
      const res = await fetch('/api/community/admin/summary', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (res.status === 401) {
        setUnauthorized(true);
        setSummary(null);
        return;
      }

      if (!res.ok) {
        throw new Error('Community summary failed to load.');
      }

      setSummary((await res.json()) as Summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Community summary failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (unauthorized) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white">
        <h1 className="text-3xl font-black uppercase tracking-tight">Community hub admin</h1>
        <p className="mt-3 text-slate-400">Sign in to view community data.</p>
        <a
          href="/upload/login"
          className="mt-6 inline-flex rounded-md bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
        >
          Sign in to view community data
        </a>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-[#080b12] px-4 pb-10 pt-4 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,199,190,0.14),transparent_28%),radial-gradient(circle_at_86%_2%,rgba(255,80,130,0.12),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Community ops</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Community hub admin
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Read the live Featured Vote breakdown, fan profile counts, credit ledger state, and recent artist applications without opening Mongo manually.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/upload"
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-white"
            >
              Backstage
            </a>
            <button
              type="button"
              onClick={loadSummary}
              className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Reload summary
            </button>
          </div>
        </header>

        {loading && <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-slate-300">Loading community summary…</div>}
        {error && <div className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 p-6 text-rose-100">{error}</div>}

        {summary && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Vote campaigns" value={summary.totals.campaigns} detail={`${summary.totals.votes} total votes`} />
              <StatCard label="Fan profiles" value={summary.totals.fanProfiles} detail="Browser visitors captured" />
              <StatCard label="Artist applications" value={summary.totals.artistApplications} detail={`${summary.totals.applicationStatusCounts.NEW ?? 0} new`} />
              <StatCard label="Credits ledger" value={summary.totals.creditLedgerRows} detail="Reward rows recorded" />
            </div>

            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                <h2 className="text-xl font-semibold text-white">Vote campaigns</h2>
                <p className="text-sm text-slate-400">Generated {formatDate(summary.generatedAt)}</p>
              </div>
              <div className="mt-5 space-y-5">
                {summary.campaigns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-400">No vote campaigns yet.</div>
                ) : (
                  summary.campaigns.map((campaign) => (
                    <article key={campaign.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{campaign.question}</h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{campaign.slug} · {campaign.status}</p>
                        </div>
                        <div className="text-sm text-slate-300">{campaign.voteCount} votes · {campaign.uniqueVisitors} visitors</div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {campaign.options.map((option) => (
                          <div key={option.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-white">{option.label}</span>
                              <span className="font-mono text-cyan-200">{option.voteCount} · {option.votePercent}%</span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${option.votePercent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                <h2 className="text-xl font-semibold text-white">Recent applications</h2>
                <p className="text-sm text-slate-400">Artist applications will appear here as soon as the public apply form is wired.</p>
              </div>
              <div className="mt-5 space-y-3">
                {summary.recentApplications.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-400">No artist applications yet.</div>
                ) : (
                  summary.recentApplications.map((application) => (
                    <article key={application.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-white">{application.artistName}</h3>
                          <p className="mt-1 text-sm text-slate-400">{application.genre ?? 'Genre not set'} · {formatDate(application.createdAt)}</p>
                        </div>
                        <span className="rounded-full border border-cyan-300/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">
                          {application.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-3">
                        <span>{application.email ?? 'No email'}</span>
                        <span>{application.socialUrl ?? 'No social link'}</span>
                        <span>{application.songUrl ?? 'No demo link'}</span>
                      </div>
                      {application.message && <p className="mt-3 text-sm leading-6 text-slate-300">{application.message}</p>}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
