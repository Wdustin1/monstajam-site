import assert from 'node:assert/strict';
import { setServers } from 'node:dns';
import dotenv from 'dotenv';
import {
  FEATURED_VOTE_CAMPAIGN,
  FEATURED_VOTE_OPTIONS,
  FEATURED_VOTE_SLUG,
} from '@/lib/community/featuredVote';

dotenv.config({ path: '.env.local', override: true });

const dnsServers = process.env.COMMUNITY_MONGO_DNS_SERVERS
  ?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers?.length) {
  setServers(dnsServers);
}

let prisma: (typeof import('@/lib/prisma'))['prisma'] | null = null;

async function main() {
  ({ prisma } = await import('@/lib/prisma'));

  const campaign = await prisma.voteCampaign.findUnique({
    where: { slug: FEATURED_VOTE_SLUG },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  assert.ok(campaign, `Campaign ${FEATURED_VOTE_SLUG} must exist before rollout`);

  const expectedOptions = FEATURED_VOTE_OPTIONS.map((option) => ({
    label: option.label,
    description: option.description,
    sortOrder: option.sortOrder,
  }));
  const currentOptions = campaign.options.map((option) => ({
    label: option.label,
    description: option.description ?? '',
    sortOrder: option.sortOrder,
  }));
  const alreadyCurrent =
    campaign.title === FEATURED_VOTE_CAMPAIGN.title &&
    campaign.question === FEATURED_VOTE_CAMPAIGN.question &&
    campaign.description === FEATURED_VOTE_CAMPAIGN.description &&
    JSON.stringify(currentOptions) === JSON.stringify(expectedOptions);

  if (alreadyCurrent) {
    console.log(JSON.stringify({ ok: true, changed: false, campaignId: campaign.id, optionCount: currentOptions.length }));
    return;
  }

  const voteCount = await prisma.vote.count({ where: { campaignId: campaign.id } });
  assert.equal(voteCount, 0, 'Kickoff campaign already has votes. Create a new campaign instead of rewriting its choices.');

  await prisma.$transaction(async (tx) => {
    await tx.voteCampaign.update({
      where: { id: campaign.id },
      data: {
        title: FEATURED_VOTE_CAMPAIGN.title,
        question: FEATURED_VOTE_CAMPAIGN.question,
        description: FEATURED_VOTE_CAMPAIGN.description,
      },
    });

    assert.equal(campaign.options.length, FEATURED_VOTE_OPTIONS.length, 'Kickoff option count must match before in-place copy migration.');
    for (const [index, option] of FEATURED_VOTE_OPTIONS.entries()) {
      const existingOption: { id: string; sortOrder: number } = campaign.options[index];
      assert.equal(existingOption.sortOrder, option.sortOrder, 'Kickoff options must retain their existing sort order.');
      await tx.voteOption.update({
        where: { id: existingOption.id },
        data: {
          label: option.label,
          description: option.description,
          sortOrder: option.sortOrder,
        },
      });
    }
  });

  const updated = await prisma.voteCampaign.findUniqueOrThrow({
    where: { id: campaign.id },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });
  assert.equal(updated.question, FEATURED_VOTE_CAMPAIGN.question);
  assert.deepEqual(updated.options.map((option) => option.label), FEATURED_VOTE_OPTIONS.map((option) => option.label));

  console.log(JSON.stringify({
    ok: true,
    changed: true,
    campaignId: updated.id,
    question: updated.question,
    options: updated.options.map((option) => option.label),
  }));
}

main()
  .finally(() => prisma?.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
