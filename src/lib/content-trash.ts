import { Prisma } from '@prisma/client';
import { adminAuthorization } from './auth';
import { isAllowedMutationOrigin } from './auth-provider';

export const contentHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export const CONTENT_CHANGED = 'This item changed. Reload the library and reopen it before saving again.';

// Mongo records created before trash existed have no deletedAt field. Both
// missing fields and explicit null mean active; neither may be omitted here.
export function activeContentWhere() {
  return { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
}

export function trashedContentWhere() {
  return { deletedAt: { not: null, isSet: true } };
}

export function isContentTrashed(record: { deletedAt?: Date | string | null }): boolean {
  return record.deletedAt !== null && record.deletedAt !== undefined;
}

export function isMissingContentError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

// Resolve the acting account once, so deletedBy always records the same
// verified identity that authorized this mutation.
export async function getContentMutationAdmin(request: Request) {
  if (!isAllowedMutationOrigin(request)) return null;
  return adminAuthorization.getIdentity(request.headers);
}
