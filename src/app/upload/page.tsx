import UploadDashboard from '@/components/UploadDashboard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Artist Upload Dashboard — MonstaJam',
  description: 'Upload and manage your exclusive tracks.',
};

export default function UploadPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#05000A' }}>
      <Navbar />
      <main className="flex-grow pt-24">
        <UploadDashboard />
      </main>
      <Footer />
    </div>
  );
}
