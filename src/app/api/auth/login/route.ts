import { NextResponse } from 'next/server';

// Old saved forms must never recreate a shared-password session.
export async function POST() {
  return NextResponse.json({ error: 'Sign in with your individual admin account.' }, {
    status: 401, headers: { 'Cache-Control': 'private, no-store' },
  });
}
