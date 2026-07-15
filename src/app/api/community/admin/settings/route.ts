import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import {
  CommunitySettingsSchema,
  getPublicCommunitySettings,
  saveCommunitySettings,
} from '@/lib/community/communitySettings';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const settings = await getPublicCommunitySettings();
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Community room settings are unavailable.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  const payload = await req.json().catch(() => null);
  const parsed = CommunitySettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Check the room name, announcement, and secure invite URL.' },
      { status: 400 }
    );
  }

  try {
    const settings = await saveCommunitySettings(parsed.data);
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Community room settings failed to save.' }, { status: 500 });
  }
}
