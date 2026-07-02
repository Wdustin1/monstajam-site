import CommunityAdminDashboard from '@/components/CommunityAdminDashboard';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Community Hub Admin — MonstaJam',
  description: 'Read MonstaJam community vote and artist application activity.',
};

export default function CommunityAdminPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar />
      <main className="flex-grow pt-24">
        <CommunityAdminDashboard />
      </main>
      <Footer />
    </div>
  );
}
