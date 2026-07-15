import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { CommunitySettingsSchema } from '../src/lib/community/communitySettings';

const root = process.cwd();
const schemaPath = join(root, 'prisma/schema.prisma');
const settingsHelperPath = join(root, 'src/lib/community/communitySettings.ts');
const publicRoutePath = join(root, 'src/app/api/community/settings/route.ts');
const adminRoutePath = join(root, 'src/app/api/community/admin/settings/route.ts');
const adminDashboardPath = join(root, 'src/components/CommunityAdminDashboard.tsx');
const communityHubPath = join(root, 'src/components/CommunityHub.tsx');
const packagePath = join(root, 'package.json');

test('community room settings have one durable Mongo record', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  for (const anchor of [
    'model CommunitySettings',
    'id           String   @id @map("_id")',
    'platform     String',
    'roomName     String',
    'inviteUrl    String?',
    'announcement String?',
    'isOpen       Boolean',
    '@@map("community_settings")',
  ]) {
    assert.ok(schema.includes(anchor), `community settings schema should include ${anchor}`);
  }
});

test('community room settings validate safe links and expose public/admin helpers', () => {
  assert.ok(existsSync(settingsHelperPath), 'community settings helper should exist');
  const source = readFileSync(settingsHelperPath, 'utf8');

  for (const anchor of [
    'CommunitySettingsSchema',
    "z.enum(['WhatsApp', 'Discord', 'Telegram', 'Other'])",
    "url.protocol === 'https:'",
    'NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL',
    'getPublicCommunitySettings',
    'saveCommunitySettings',
    'prisma.communitySettings.upsert',
    "id: 'primary'",
  ]) {
    assert.ok(source.includes(anchor), `community settings helper should include ${anchor}`);
  }
});

test('community room settings reject unsafe or malformed invite links', () => {
  const valid = CommunitySettingsSchema.safeParse({
    platform: 'Discord',
    roomName: 'MonstaJam Listening Room',
    inviteUrl: 'https://discord.gg/example',
    announcement: 'Talk about the new release.',
    isOpen: true,
  });
  assert.equal(valid.success, true);

  for (const inviteUrl of ['http://discord.gg/example', 'javascript:alert(1)', 'not-a-url']) {
    const result = CommunitySettingsSchema.safeParse({
      platform: 'Discord',
      roomName: 'MonstaJam Listening Room',
      inviteUrl,
      announcement: '',
      isOpen: true,
    });
    assert.equal(result.success, false, `${inviteUrl} must be rejected`);
  }
});

test('community room settings APIs separate public read from protected writes', () => {
  assert.ok(existsSync(publicRoutePath), 'public community settings route should exist');
  assert.ok(existsSync(adminRoutePath), 'admin community settings route should exist');
  const publicRoute = readFileSync(publicRoutePath, 'utf8');
  const adminRoute = readFileSync(adminRoutePath, 'utf8');

  for (const anchor of ['export async function GET', 'getPublicCommunitySettings', "'Cache-Control': 'no-store'"]) {
    assert.ok(publicRoute.includes(anchor), `public settings route should include ${anchor}`);
  }

  for (const anchor of ['export async function GET', 'export async function PUT', 'isAdminRequest', 'CommunitySettingsSchema.safeParse', 'saveCommunitySettings']) {
    assert.ok(adminRoute.includes(anchor), `admin settings route should include ${anchor}`);
  }
  assert.ok(adminRoute.includes("{ error: 'Unauthorized' }"), 'admin settings route should reject unauthorized requests');
});

test('backstage can manage the room and the public Talk tab consumes it', () => {
  const admin = readFileSync(adminDashboardPath, 'utf8');
  const hub = readFileSync(communityHubPath, 'utf8');

  for (const anchor of [
    'Community room',
    '/api/community/admin/settings',
    'Save room settings',
    'Room name',
    'Invite URL',
    'Open the room to fans',
  ]) {
    assert.ok(admin.includes(anchor), `community admin should include ${anchor}`);
  }

  for (const anchor of [
    '/api/community/settings',
    'roomSettings',
    'roomSettings.announcement',
    'Join on',
    'Invite opening soon',
  ]) {
    assert.ok(hub.includes(anchor), `CommunityHub should include ${anchor}`);
  }
  assert.equal(hub.includes('const communityUrl = process.env.NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL'), false, 'Talk tab should not be controlled only by a build-time URL');
  assert.equal(hub.includes('NEXT_PUBLIC_MONSTAJAM_COMMUNITY_URL'), false, 'public env fallback should be validated server-side before reaching the Talk tab');
});

test('package exposes the community room contract test', () => {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
  assert.equal(pkg.scripts?.['test:community-room'], 'tsx --test tests/community-room.contract.test.ts');
});
