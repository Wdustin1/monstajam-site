import { CreditAction, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const VOTE_CREDIT_REWARD = 5;
const MAX_TRANSACTION_ATTEMPTS = 5;
const RETRYABLE_TRANSACTION_CODES = new Set(['P2002', 'P2034']);

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
  campaignTitle,
  optionId,
}: {
  visitorId: string;
  campaignId: string;
  campaignTitle: string;
  optionId: string;
}) {
  const sourceKey = buildVoteRewardSourceKey(campaignId, visitorId);

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
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
            reason: `First vote in ${campaignTitle}`,
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
