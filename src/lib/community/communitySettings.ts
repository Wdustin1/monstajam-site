import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const DEFAULT_ROOM_NAME = 'MonstaJam Community';
const DEFAULT_PLATFORM = 'WhatsApp' as const;

const SecureInviteUrlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Invite URL must use https.');

export const CommunitySettingsSchema = z.object({
  platform: z.enum(['WhatsApp', 'Discord', 'Telegram', 'Other']),
  roomName: z.string().trim().min(2).max(80),
  inviteUrl: z.union([SecureInviteUrlSchema, z.literal(''), z.null()]).transform((value) => value || null),
  announcement: z
    .union([z.string().trim().max(180), z.null()])
    .transform((value) => value || null),
  isOpen: z.boolean(),
});

export type PublicCommunitySettings = {
  platform: z.output<typeof CommunitySettingsSchema>['platform'];
  roomName: string;
  inviteUrl: string | null;
  announcement: string | null;
  isOpen: boolean;
};

function closedDefaultSettings(): PublicCommunitySettings {
  return {
    platform: DEFAULT_PLATFORM,
    roomName: DEFAULT_ROOM_NAME,
    inviteUrl: null,
    announcement: null,
    isOpen: false,
  };
}

export function normalizeStoredCommunitySettings(input: unknown): PublicCommunitySettings {
  const parsed = CommunitySettingsSchema.safeParse(input);
  if (!parsed.success) return closedDefaultSettings();

  return {
    platform: parsed.data.platform,
    roomName: parsed.data.roomName,
    inviteUrl: parsed.data.inviteUrl,
    announcement: parsed.data.announcement,
    isOpen: parsed.data.isOpen && Boolean(parsed.data.inviteUrl),
  };
}

function safeEnvironmentInviteUrl() {
  const value = process.env.NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL?.trim();
  if (!value) return null;
  const parsed = SecureInviteUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function getPublicCommunitySettings(): Promise<PublicCommunitySettings> {
  const stored = await prisma.communitySettings.findUnique({ where: { id: 'primary' } });

  if (!stored) {
    const inviteUrl = safeEnvironmentInviteUrl();
    return {
      platform: DEFAULT_PLATFORM,
      roomName: DEFAULT_ROOM_NAME,
      inviteUrl,
      announcement: null,
      isOpen: Boolean(inviteUrl),
    };
  }

  return normalizeStoredCommunitySettings(stored);
}

export async function saveCommunitySettings(input: unknown): Promise<PublicCommunitySettings> {
  const parsed = CommunitySettingsSchema.parse(input);
  const saved = await prisma.communitySettings.upsert({
    where: { id: 'primary' },
    create: {
      id: 'primary',
      platform: parsed.platform,
      roomName: parsed.roomName,
      inviteUrl: parsed.inviteUrl,
      announcement: parsed.announcement,
      isOpen: parsed.isOpen && Boolean(parsed.inviteUrl),
    },
    update: {
      platform: parsed.platform,
      roomName: parsed.roomName,
      inviteUrl: parsed.inviteUrl,
      announcement: parsed.announcement,
      isOpen: parsed.isOpen && Boolean(parsed.inviteUrl),
    },
  });

  return normalizeStoredCommunitySettings(saved);
}
