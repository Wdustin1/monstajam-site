import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminIdentity } from '@/lib/auth-provider';
import AdminAccounts from '@/components/AdminAccounts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin access — MonstaJam', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminAccountsPage() {
  const identity = await getAdminIdentity(await headers());
  if (!identity) redirect('/upload/login');
  if (identity.role !== 'owner') redirect('/upload');
  return <AdminAccounts currentAdmin={identity} />;
}
