import { NextResponse } from 'next/server';
import { getPublicCommunitySettings } from '@/lib/community/communitySettings';

export async function GET() {
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
