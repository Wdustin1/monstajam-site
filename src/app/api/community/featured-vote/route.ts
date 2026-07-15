import { NextRequest, NextResponse } from 'next/server';
import { buildFeaturedVotePayload, FeaturedVoteRequestSchema } from '@/lib/community/featuredVote';
import { getActiveVoteCampaignForPublic, getVoteCampaignForPublicById } from '@/lib/community/voteCampaigns';
import { getFanRewards, saveVoteAndAwardCredits, VoteUnavailableError } from '@/lib/community/rewards';
import { attachVisitorSession, getExistingVisitorSession, getOrCreateVisitorSession } from '@/lib/community/visitorSession';
import { getRequestAddress } from '@/lib/rateLimit';
import { consumeSharedRateLimit } from '@/lib/sharedRateLimit';

async function publicVotePayload(visitorId: string, campaignId?: string) {
  const [campaign, rewards] = await Promise.all([
    campaignId
      ? getVoteCampaignForPublicById(campaignId, visitorId)
      : getActiveVoteCampaignForPublic(visitorId),
    getFanRewards(visitorId),
  ]);

  if (!campaign) {
    return {
      campaign: null,
      options: [],
      selectedOptionId: null,
      totals: { votes: 0 },
      rewards,
      votingPaused: true,
    };
  }

  return {
    ...buildFeaturedVotePayload(campaign, visitorId),
    rewards,
    votingPaused: campaign.status !== 'ACTIVE',
  };
}

function withVisitorSession(response: NextResponse, newToken: string | null) {
  response.headers.set('Cache-Control', 'no-store');
  return attachVisitorSession(response, newToken);
}

async function consumeVoteRateLimits(request: NextRequest, visitorId: string) {
  const clientLimit = await consumeSharedRateLimit({
    namespace: 'featured-vote-client',
    key: getRequestAddress(request.headers),
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!clientLimit.allowed) return clientLimit;

  const visitorLimit = await consumeSharedRateLimit({
    namespace: 'featured-vote-visitor',
    key: visitorId,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!visitorLimit.allowed) return visitorLimit;

  return consumeSharedRateLimit({
    namespace: 'featured-vote-global',
    key: 'global',
    limit: 2_000,
    windowMs: 10 * 60 * 1000,
  });
}

export async function GET(request: NextRequest) {
  let session: ReturnType<typeof getOrCreateVisitorSession>;
  try {
    session = getOrCreateVisitorSession(request);
    const payload = await publicVotePayload(session.visitorId);
    return withVisitorSession(NextResponse.json(payload), session.newToken);
  } catch (error) {
    console.error('Failed to load featured vote', error);
    return NextResponse.json({ error: 'Unable to load the featured vote' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session: { visitorId: string; newToken: null };
  try {
    const visitorId = getExistingVisitorSession(request);
    if (!visitorId) {
      return NextResponse.json(
        { error: 'Load the vote before submitting.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    session = { visitorId, newToken: null };
  } catch (error) {
    console.error('Failed to read visitor session', error);
    return NextResponse.json({ error: 'Voting is temporarily unavailable' }, { status: 503 });
  }

  let blockedLimit;
  try {
    const limit = await consumeVoteRateLimits(request, session.visitorId);
    blockedLimit = limit.allowed ? null : limit;
  } catch (error) {
    console.error('Voting rate limiter unavailable', error);
    return withVisitorSession(
      NextResponse.json({ error: 'Voting is temporarily unavailable' }, { status: 503 }),
      session.newToken,
    );
  }

  if (blockedLimit) {
    return withVisitorSession(
      NextResponse.json(
        { error: 'Too many voting attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(blockedLimit.retryAfterSeconds) } },
      ),
      session.newToken,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withVisitorSession(
      NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
      session.newToken,
    );
  }

  const parsed = FeaturedVoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return withVisitorSession(
      NextResponse.json({ error: 'Invalid vote', details: parsed.error.flatten() }, { status: 400 }),
      session.newToken,
    );
  }

  try {
    const campaign = await getActiveVoteCampaignForPublic(session.visitorId);
    if (!campaign) {
      return withVisitorSession(
        NextResponse.json({ error: 'Voting is currently paused' }, { status: 409 }),
        session.newToken,
      );
    }

    await saveVoteAndAwardCredits({
      campaignId: campaign.id,
      visitorId: session.visitorId,
      optionId: parsed.data.optionId,
    });
    const payload = await publicVotePayload(session.visitorId, campaign.id);

    return withVisitorSession(
      NextResponse.json(payload),
      session.newToken,
    );
  } catch (error) {
    const unavailable = error instanceof VoteUnavailableError;
    if (!unavailable) console.error('Failed to save featured vote', error);
    return withVisitorSession(
      NextResponse.json(
        { error: unavailable ? error.message : 'Unable to save vote' },
        { status: unavailable ? 400 : 500 },
      ),
      session.newToken,
    );
  }
}
