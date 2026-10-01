import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminIdentity } from '@/lib/auth-provider';
import AdminPasswordSettings from '@/components/AdminPasswordSettings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your admin account — MonstaJam', robots: { index: false, follow: false, noarchive: true } };

export default async function AdminAccountPage() {
  const identity = await getAdminIdentity(await headers());
  if (!identity) redirect('/upload/login');
  return <AdminPasswordSettings currentAdmin={identity} />;
}
