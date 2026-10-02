import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { activeContentWhere } from '@/lib/content-trash';

// Share this publication check between the public page and its metadata.
// React cache only deduplicates the lookup within the current render request.
export const getPublishedTrack = cache(async (slug: string) =>
  prisma.track.findFirst({
    where: { slug, published: true, ...activeContentWhere() },
    include: { credits: true },
  })
);
