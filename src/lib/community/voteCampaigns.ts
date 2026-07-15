import { Prisma, VoteCampaignStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { FEATURED_VOTE_CAMPAIGN, FEATURED_VOTE_OPTIONS, FEATURED_VOTE_SLUG } from '@/lib/community/featuredVote';

const ManagedVoteCampaignOptionSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required').max(80),
  description: z.string().trim().max(180).optional().default(''),
  sortOrder: z.number().int().min(0).max(50).optional(),
});

const CampaignStatusSchema = z.nativeEnum(VoteCampaignStatus);

export const ManagedVoteCampaignSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(120),
  question: z.string().trim().min(8, 'Question is required').max(180),
  description: z.string().trim().max(360).optional().default(''),
  status: CampaignStatusSchema.optional().default(VoteCampaignStatus.DRAFT),
  options: z.array(ManagedVoteCampaignOptionSchema).min(2, 'Add at least two options').max(8, 'Keep votes focused to eight options or fewer'),
});

export const ManagedVoteCampaignUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  question: z.string().trim().min(8).max(180).optional(),
  description: z.string().trim().max(360).optional(),
  status: CampaignStatusSchema.optional(),
  options: z.array(ManagedVoteCampaignOptionSchema).min(2).max(8).optional(),
});

export type ManagedVoteCampaignInput = z.infer<typeof ManagedVoteCampaignSchema>;
export type ManagedVoteCampaignUpdateInput = z.infer<typeof ManagedVoteCampaignUpdateSchema>;

export class VoteCampaignOptionEditError extends Error {
  constructor() {
    super('Options can only be edited before a campaign has votes. Close this one and create a fresh campaign to preserve vote history.');
    this.name = 'VoteCampaignOptionEditError';
  }
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || `vote-${Date.now()}`;
}

type VoteCampaignDatabase = typeof prisma | Prisma.TransactionClient;

async function uniqueSlug(input: string, database: VoteCampaignDatabase = prisma) {
  const base = slugify(input);
  let slug = base;
  let suffix = 2;

  while (await database.voteCampaign.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function normalizeOptions(options: ManagedVoteCampaignInput['options']) {
  const seen = new Set<string>();

  return options
    .map((option, index) => ({
      label: option.label.trim(),
      description: option.description?.trim() || null,
      sortOrder: option.sortOrder ?? index + 1,
    }))
    .filter((option) => {
      const key = option.label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

async function closeOtherActiveCampaigns(database: VoteCampaignDatabase, exceptCampaignId?: string) {
  await database.voteCampaign.updateMany({
    where: {
      status: VoteCampaignStatus.ACTIVE,
      ...(exceptCampaignId ? { id: { not: exceptCampaignId } } : {}),
    },
    data: { status: VoteCampaignStatus.CLOSED },
  });
}

async function lockVoteCampaign(database: Prisma.TransactionClient, campaignId: string) {
  const locked = await database.voteCampaign.updateMany({
    where: { id: campaignId },
    data: { updatedAt: new Date() },
  });
  if (locked.count !== 1) throw new Error('Vote campaign not found.');
}

export async function ensureDefaultFeaturedVoteCampaign() {
  return prisma.voteCampaign.upsert({
    where: { slug: FEATURED_VOTE_SLUG },
    update: {},
    create: {
      slug: FEATURED_VOTE_CAMPAIGN.slug,
      title: FEATURED_VOTE_CAMPAIGN.title,
      question: FEATURED_VOTE_CAMPAIGN.question,
      description: FEATURED_VOTE_CAMPAIGN.description,
      status: VoteCampaignStatus.ACTIVE,
      options: {
        create: FEATURED_VOTE_OPTIONS.map((option) => ({
          label: option.label,
          description: option.description,
          sortOrder: option.sortOrder,
        })),
      },
    },
  });
}

export async function getVoteCampaignWithOptionsAndVotes(
  campaignId: string,
  database: VoteCampaignDatabase = prisma,
) {
  return database.voteCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
    },
  });
}

export async function getActiveVoteCampaignForPublic(visitorId?: string) {
  const publicInclude = {
    options: {
      orderBy: { sortOrder: 'asc' as const },
      include: { _count: { select: { votes: true } } },
    },
    votes: {
      ...(visitorId ? { where: { visitorId } } : { take: 0 }),
      select: { optionId: true },
      take: visitorId ? 1 : 0,
    },
  };

  const campaign = await prisma.voteCampaign.findFirst({
    where: { status: VoteCampaignStatus.ACTIVE },
    orderBy: { updatedAt: 'desc' },
    include: publicInclude,
  });
  if (campaign) return campaign;

  const campaignCount = await prisma.voteCampaign.count();
  if (campaignCount > 0) return null;

  const seeded = await ensureDefaultFeaturedVoteCampaign();
  if (seeded.status !== VoteCampaignStatus.ACTIVE) return null;
  return prisma.voteCampaign.findUnique({
    where: { id: seeded.id },
    include: publicInclude,
  });
}

export async function getVoteCampaignForPublicById(campaignId: string, visitorId: string) {
  return prisma.voteCampaign.findUnique({
    where: { id: campaignId },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      votes: {
        where: { visitorId },
        select: { optionId: true },
        take: 1,
      },
    },
  });
}

export async function createManagedVoteCampaign(input: ManagedVoteCampaignInput) {
  const options = normalizeOptions(input.options);
  if (options.length < 2) {
    throw new Error('Add at least two unique options.');
  }

  return prisma.$transaction(async (tx) => {
    if (input.status === VoteCampaignStatus.ACTIVE) {
      await closeOtherActiveCampaigns(tx);
    }

    const campaign = await tx.voteCampaign.create({
      data: {
        slug: await uniqueSlug(input.title || input.question, tx),
        title: input.title,
        question: input.question,
        description: input.description || null,
        status: input.status,
        options: { create: options },
      },
    });

    return getVoteCampaignWithOptionsAndVotes(campaign.id, tx);
  });
}

export async function updateManagedVoteCampaign(campaignId: string, input: ManagedVoteCampaignUpdateInput) {
  return prisma.$transaction(async (tx) => {
    await lockVoteCampaign(tx, campaignId);
    const existing = await tx.voteCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { id: true, status: true },
    });

    let normalizedOptions: ReturnType<typeof normalizeOptions> | undefined;
    if (input.options) {
      const voteCount = await tx.vote.count({ where: { campaignId } });
      if (voteCount > 0) {
        throw new VoteCampaignOptionEditError();
      }
      normalizedOptions = normalizeOptions(input.options);
      if (normalizedOptions.length < 2) {
        throw new Error('Add at least two unique options.');
      }
    }

    const data: Prisma.VoteCampaignUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(normalizedOptions
        ? { options: { deleteMany: {}, create: normalizedOptions } }
        : {}),
    };

    if (input.status === VoteCampaignStatus.ACTIVE) {
      await closeOtherActiveCampaigns(tx, existing.id);
    }

    if (Object.keys(data).length > 0) {
      await tx.voteCampaign.update({
        where: { id: existing.id },
        data,
      });
    }

    return getVoteCampaignWithOptionsAndVotes(existing.id, tx);
  });
}
