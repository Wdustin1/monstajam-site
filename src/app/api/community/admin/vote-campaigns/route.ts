import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { createManagedVoteCampaign, ManagedVoteCampaignSchema } from '@/lib/community/voteCampaigns';

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ManagedVoteCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  try {
    const campaign = await createManagedVoteCampaign(parsed.data);
    return NextResponse.json({ campaign }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Failed to create vote campaign';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
