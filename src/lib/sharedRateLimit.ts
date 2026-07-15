import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type SharedRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type SharedRateLimitOptions = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
};

function rateLimitDocumentId(namespace: string, key: string, windowStartedAt: number) {
  return createHash('sha256')
    .update(`${namespace}\0${key}\0${windowStartedAt}`)
    .digest('hex');
}

function mongoDate(date: Date) {
  return { $date: date.toISOString() };
}

export async function consumeSharedRateLimit({
  namespace,
  key,
  limit,
  windowMs,
}: SharedRateLimitOptions): Promise<SharedRateLimitResult> {
  if (!process.env.DATABASE_URL?.startsWith('mongodb')) {
    throw new Error('Shared rate limiting requires DATABASE_URL.');
  }

  const now = Date.now();
  const windowStartedAt = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(windowStartedAt + windowMs);
  const id = rateLimitDocumentId(namespace, key, windowStartedAt);
  const result = await prisma.$runCommandRaw({
    findAndModify: 'rate_limits',
    query: { _id: id },
    update: {
      $inc: { attempts: 1 },
      $setOnInsert: {
        namespace,
        resetAt: mongoDate(resetAt),
        createdAt: mongoDate(new Date(now)),
      },
    },
    upsert: true,
    new: true,
  } as Prisma.InputJsonObject);

  const value = result.value as Prisma.JsonObject | null | undefined;
  const attempts = Number(value?.attempts);
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error('Shared rate limit update returned an invalid attempt count.');
  }

  return {
    allowed: attempts <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1_000)),
  };
}

export async function clearSharedRateLimit(namespace: string, key: string, windowMs = 15 * 60 * 1000) {
  if (!process.env.DATABASE_URL?.startsWith('mongodb')) {
    throw new Error('Shared rate limiting requires DATABASE_URL.');
  }

  const now = Date.now();
  const windowStartedAt = Math.floor(now / windowMs) * windowMs;
  const id = rateLimitDocumentId(namespace, key, windowStartedAt);
  await prisma.$runCommandRaw({
    delete: 'rate_limits',
    deletes: [{ q: { _id: id }, limit: 1 }],
  } as Prisma.InputJsonObject);
}
