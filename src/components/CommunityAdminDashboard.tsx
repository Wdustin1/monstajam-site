'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getCommunityRoomAdminStatus } from '@/lib/community/adminRoomStatus';

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

type Summary = {
  generatedAt: string;
  totals: {
    campaigns: number;
    fanProfiles: number;
    votes: number;
    creditLedgerRows: number;
    creditsIssued: number;
  };
  campaigns: Array<{
    id: string;
    slug: string;
    title: string;
    question: string;
    description: string;
    status: CampaignStatus;
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
  recentRewards: Array<{
    id: string;
    action: string;
    amount: number;
    reason: string;
    campaignId: string | null;
    createdAt: string;
  }>;
};

type RoomSettings = {
  platform: 'WhatsApp' | 'Discord' | 'Telegram' | 'Other';
  roomName: string;
  inviteUrl: string | null;
  announcement: string | null;
  isOpen: boolean;
  publicEnabled: boolean;
};

const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  platform: 'WhatsApp',
  roomName: 'MonstaJam Community',
  inviteUrl: null,
  announcement: null,
  isOpen: false,
  publicEnabled: false,
};

const DEFAULT_OPTIONS = 'Song\nCover art\nRemix\nFuture release';

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

function statusTone(status: CampaignStatus) {
  if (status === 'ACTIVE') {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100';
  }

  if (status === 'DRAFT') {
    return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
  }

  return 'border-slate-300/20 bg-slate-300/10 text-slate-300';
}

export default function CommunityAdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [roomSaving, setRoomSaving] = useState(false);
  const roomStatus = getCommunityRoomAdminStatus(roomSettings);
  const [form, setForm] = useState({
    title: 'New fan vote',
    question: 'Which song should MonstaJam feature next?',
    description: 'Listen to the choices, cast your vote, and help choose what gets the spotlight.',
    options: DEFAULT_OPTIONS,
    status: 'ACTIVE' as CampaignStatus,
  });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);

    try {
      const [res, settingsRes] = await Promise.all([
        fetch('/api/community/admin/summary', {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/community/admin/settings', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      if (res.status === 401 || settingsRes.status === 401) {
        setUnauthorized(true);
        setSummary(null);
        return;
      }

      if (!res.ok) {
        throw new Error('Community summary failed to load.');
      }

      if (!settingsRes.ok) {
        throw new Error('Community room settings failed to load.');
      }

      setSummary((await res.json()) as Summary);
      setRoomSettings((await settingsRes.json()) as RoomSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Community summary failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function saveRoomSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoomSaving(true);
    setActionMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/community/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: roomSettings.platform,
          roomName: roomSettings.roomName,
          inviteUrl: roomSettings.inviteUrl ?? '',
          announcement: roomSettings.announcement ?? '',
          isOpen: roomSettings.isOpen,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Community room settings failed to save.');
      }

      const savedRoomStatus = getCommunityRoomAdminStatus({
        isOpen: Boolean(payload.isOpen),
        publicEnabled: Boolean(payload.publicEnabled),
      });
      setRoomSettings(payload as RoomSettings);
      setActionMessage(savedRoomStatus.saveMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Community room settings failed to save.');
    } finally {
      setRoomSaving(false);
    }
  }

  async function createVoteCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionMessage(null);
    setError(null);

    const options = form.options
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label, index) => ({ label, sortOrder: index + 1 }));

    try {
      const res = await fetch('/api/community/admin/vote-campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          question: form.question,
          description: form.description,
          status: form.status,
          options,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Vote campaign failed to save.');
      }

      setActionMessage(form.status === 'ACTIVE' ? 'Vote campaign created and activated.' : 'Draft vote campaign created.');
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote campaign failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignStatus(campaignId: string, status: CampaignStatus) {
    setSaving(true);
    setActionMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/community/admin/vote-campaigns/${campaignId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Vote campaign failed to update.');
      }

      setActionMessage(
        status === 'ACTIVE'
          ? 'Vote campaign activated. The Community Vote tab now shows it.'
          : status === 'CLOSED'
            ? 'Vote campaign archived.'
            : 'Vote campaign moved back to draft.'
      );
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote campaign failed to update.');
    } finally {
      setSaving(false);
    }
  }

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
    <section className="relative overflow-hidden bg-[#080b12] px-4 pb-10 pt-4 text-white [&_button]:min-h-11 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,199,190,0.14),transparent_28%),radial-gradient(circle_at_86%_2%,rgba(255,80,130,0.12),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Community ops</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Community hub admin
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Run fan votes, prepare the future community room, archive old polls, and read participation without opening Mongo manually.
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

        {loading && <div role="status" className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-slate-300">Loading community summary…</div>}
        {error && <div role="alert" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 p-6 text-rose-100">{error}</div>}
        {actionMessage && <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-6 text-emerald-100">{actionMessage}</div>}

        {summary && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Vote campaigns" value={summary.totals.campaigns} detail={`${summary.totals.votes} total votes`} />
              <StatCard label="Fan profiles" value={summary.totals.fanProfiles} detail="Browser visitors captured" />
              <StatCard label="Vote activity" value={summary.totals.votes} detail="One vote per visitor per campaign" />
              <StatCard label="Credits issued" value={summary.totals.creditsIssued} detail={`${summary.totals.creditLedgerRows} reward rows`} />
            </div>

            <section className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-5">
              <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Community room</h2>
                    <p className="mt-1 text-sm text-slate-400">Prepare a future fan-room invite and announcement.</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${roomStatus.isLive ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : roomStatus.label === 'Prepared' ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-slate-300/20 bg-slate-300/10 text-slate-300'}`}>
                    {roomStatus.label}
                  </span>
                </div>
              </div>
              <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
                {roomSettings.publicEnabled
                  ? 'The deployment gate is enabled. A ready room with a secure invite is public in Talk.'
                  : 'Public Talk stays Coming Soon until COMMUNITY_ROOM_ENABLED is enabled for the deployment.'}
              </p>
              <form onSubmit={saveRoomSettings} className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Platform
                  <select
                    value={roomSettings.platform}
                    onChange={(event) => setRoomSettings((current) => ({ ...current, platform: event.target.value as RoomSettings['platform'] }))}
                    className="min-h-11 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-fuchsia-300/60"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Discord">Discord</option>
                    <option value="Telegram">Telegram</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Room name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={roomSettings.roomName}
                    onChange={(event) => setRoomSettings((current) => ({ ...current, roomName: event.target.value }))}
                    className="min-h-11 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-fuchsia-300/60"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                  Invite URL
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="https://chat.whatsapp.com/..."
                    value={roomSettings.inviteUrl ?? ''}
                    onChange={(event) => setRoomSettings((current) => ({ ...current, inviteUrl: event.target.value || null }))}
                    className="min-h-11 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-fuchsia-300/60"
                  />
                  <span className="font-normal text-slate-500">Secure HTTPS invite links only. Leave blank until the room is ready.</span>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                  Fan announcement
                  <textarea
                    maxLength={180}
                    rows={2}
                    placeholder="Drop news, listening-room times, or the conversation prompt."
                    value={roomSettings.announcement ?? ''}
                    onChange={(event) => setRoomSettings((current) => ({ ...current, announcement: event.target.value || null }))}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-fuchsia-300/60"
                  />
                </label>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={roomSettings.isOpen}
                    disabled={!roomSettings.inviteUrl}
                    onChange={(event) => setRoomSettings((current) => ({ ...current, isOpen: event.target.checked }))}
                    className="h-5 w-5 accent-fuchsia-300"
                  />
                  Mark room ready to open
                  {!roomSettings.inviteUrl && <span className="font-normal text-slate-500">Add an invite URL first.</span>}
                </label>
                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={roomSaving}
                    className="min-h-11 rounded-md bg-fuchsia-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {roomSaving ? 'Saving room…' : 'Save room settings'}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5">
              <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                <h2 className="text-xl font-semibold text-white">Create vote campaign</h2>
                <p className="text-sm text-slate-400">Create a focused poll, make it active, and the Community Vote tab updates automatically.</p>
              </div>
              <form onSubmit={createVoteCampaign} className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Campaign title
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CampaignStatus }))}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                  >
                    <option value="ACTIVE">Create as active community vote</option>
                    <option value="DRAFT">Save as draft</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                  Question
                  <input
                    value={form.question}
                    onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={2}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                  Vote options, one per line
                  <textarea
                    value={form.options}
                    onChange={(event) => setForm((current) => ({ ...current, options: event.target.value }))}
                    rows={5}
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-300/60"
                  />
                </label>
                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving ? 'Saving campaign…' : 'Create vote campaign'}
                  </button>
                </div>
              </form>
            </section>

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
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{campaign.question}</h3>
                          {campaign.description && <p className="mt-2 max-w-2xl text-sm text-slate-400">{campaign.description}</p>}
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{campaign.slug}</p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusTone(campaign.status)}`}>
                            {campaign.status === 'CLOSED' ? 'ARCHIVED' : campaign.status}
                          </span>
                          <div className="text-sm text-slate-300">{campaign.voteCount} votes · {campaign.uniqueVisitors} visitors</div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving || campaign.status === 'ACTIVE'}
                          onClick={() => updateCampaignStatus(campaign.id, 'ACTIVE')}
                          className="rounded-md border border-emerald-300/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          disabled={saving || campaign.status === 'DRAFT'}
                          onClick={() => updateCampaignStatus(campaign.id, 'DRAFT')}
                          className="rounded-md border border-amber-300/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-100 transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Draft
                        </button>
                        <button
                          type="button"
                          disabled={saving || campaign.status === 'CLOSED'}
                          onClick={() => updateCampaignStatus(campaign.id, 'CLOSED')}
                          className="rounded-md border border-slate-300/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-200 transition hover:bg-slate-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Archive
                        </button>
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
                <h2 className="text-xl font-semibold text-white">Rewards ledger</h2>
                <p className="text-sm text-slate-400">The first vote in each campaign now issues five credits once per browser visitor.</p>
              </div>
              <div className="mt-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Recent reward activity</h3>
                {summary.recentRewards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-400">
                    No rewards issued yet. The first public vote will appear here.
                  </div>
                ) : (
                  summary.recentRewards.map((reward) => (
                    <div key={reward.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{reward.reason}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{reward.action} · {formatDate(reward.createdAt)}</div>
                      </div>
                      <div className="font-mono text-lg font-semibold text-emerald-200">+{reward.amount}</div>
                    </div>
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
