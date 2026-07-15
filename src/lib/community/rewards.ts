import { CreditAction, Prisma, VoteCampaignStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const VOTE_CREDIT_REWARD = 5;
const MAX_TRANSACTION_ATTEMPTS = 5;
const RETRYABLE_TRANSACTION_CODES = new Set(['P2002', 'P2034']);

export class VoteUnavailableError extends Error {
  constructor(message = 'Vote option is not available on an active campaign.') {
    super(message);
    this.name = 'VoteUnavailableError';
  }
}

export function buildVoteRewardSourceKey(campaignId: string, visitorId: string) {
  return `vote:${campaignId}:${visitorId}`;
}

async function calculateCreditBalance(visitorId: string) {
  const result = await prisma.creditLedger.aggregate({
    where: { visitorId },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

export async function getFanRewards(visitorId: string) {
  const [creditsBalance, recentRewards] = await Promise.all([
    calculateCreditBalance(visitorId),
    prisma.creditLedger.findMany({
      where: { visitorId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        action: true,
        amount: true,
        reason: true,
        campaignId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    creditsBalance,
    voteReward: VOTE_CREDIT_REWARD,
    recentRewards: recentRewards.map((reward) => ({
      ...reward,
      createdAt: reward.createdAt.toISOString(),
    })),
  };
}

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_TRANSACTION_CODES.has(error.code);
}

async function retryTransactionDelay(attempt: number) {
  const delayMs = attempt * 25 + Math.floor(Math.random() * 20);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function saveVoteAndAwardCredits({
  visitorId,
  campaignId,
  optionId,
}: {
  visitorId: string;
  campaignId: string;
  optionId: string;
}) {
  const sourceKey = buildVoteRewardSourceKey(campaignId, visitorId);

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        // This authorization check deliberately writes the campaign row. MongoDB then
        // creates a write conflict if an admin closes the campaign or replaces its
        // options concurrently, so one transaction retries against the new state.
        const campaignTouch = await tx.voteCampaign.updateMany({
          where: {
            id: campaignId,
            status: VoteCampaignStatus.ACTIVE,
            options: { some: { id: optionId } },
          },
          data: { updatedAt: new Date() },
        });
        if (campaignTouch.count !== 1) {
          throw new VoteUnavailableError();
        }

        const campaign = await tx.voteCampaign.findUnique({
          where: { id: campaignId },
          select: { title: true },
        });
        if (!campaign) {
          throw new VoteUnavailableError('Vote campaign is unavailable.');
        }

        const fanProfile = await tx.fanProfile.upsert({
          where: { visitorId },
          update: {},
          create: { visitorId },
        });

        await tx.vote.upsert({
          where: {
            campaignId_visitorId: {
              campaignId,
              visitorId,
            },
          },
          update: {
            optionId,
            fanProfileId: fanProfile.id,
            creditsSpent: 0,
          },
          create: {
            campaignId,
            optionId,
            fanProfileId: fanProfile.id,
            visitorId,
            creditsSpent: 0,
          },
        });

        await tx.creditLedger.upsert({
          where: { sourceKey },
          update: {},
          create: {
            sourceKey,
            fanProfileId: fanProfile.id,
            visitorId,
            campaignId,
            action: CreditAction.VOTE,
            amount: VOTE_CREDIT_REWARD,
            reason: `First vote in ${campaign.title}`,
          },
        });

        const balance = await tx.creditLedger.aggregate({
          where: { visitorId },
          _sum: { amount: true },
        });

        return {
          creditsBalance: balance._sum.amount ?? 0,
          voteReward: VOTE_CREDIT_REWARD,
        };
      });
    } catch (error) {
      if (attempt < MAX_TRANSACTION_ATTEMPTS && isRetryableTransactionError(error)) {
        await retryTransactionDelay(attempt);
        continue;
      }
      throw error;
    }
  }

  throw new Error('Vote transaction retry limit reached');
}
