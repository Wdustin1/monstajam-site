import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import {
  ManagedVoteCampaignUpdateSchema,
  updateManagedVoteCampaign,
  VoteCampaignOptionEditError,
} from '@/lib/community/voteCampaigns';

type CampaignRouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function PATCH(req: NextRequest, { params }: CampaignRouteContext) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ManagedVoteCampaignUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { campaignId } = await params;

  try {
    const campaign = await updateManagedVoteCampaign(campaignId, parsed.data);
    return NextResponse.json({ campaign }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(err);

    if (err instanceof VoteCampaignOptionEditError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to update vote campaign' }, { status: 500 });
  }
}
