import UploadDashboard from '@/components/UploadDashboard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminIdentity } from '@/lib/auth-provider';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Artist Upload Dashboard — MonstaJam',
  description: 'Upload and manage your exclusive tracks.',
  robots: { index: false, follow: false },
};

export default async function UploadPage() {
  const currentAdmin = await getAdminIdentity(await headers());
  if (!currentAdmin) redirect('/upload/login');
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar />
      <main className="flex-grow pt-24">
        <UploadDashboard currentAdmin={currentAdmin} />
      </main>
      <Footer />
    </div>
  );
}
