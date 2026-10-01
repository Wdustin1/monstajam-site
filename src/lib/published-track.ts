import { cache } from 'react';
import { prisma } from '@/lib/prisma';

// Share this publication check between the public page and its metadata.
// React cache only deduplicates the lookup within the current render request.
export const getPublishedTrack = cache(async (slug: string) =>
  prisma.track.findFirst({
    where: { slug, published: true },
    include: { credits: true },
  })
);
