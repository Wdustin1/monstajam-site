import Navbar from '@/components/Navbar';
import CommunityHub from '@/components/CommunityHub';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Community Hub',
  description: 'Vote, talk, earn credits, and follow what MonstaJam drops next.',
  alternates: { canonical: '/community' },
};

export default function CommunityPage() {
  return (
    <>
      <Navbar activeLink="community" />
      <main id="main-content" tabIndex={-1} className="min-h-screen flex-grow pt-24 hero-bg-gradient">
        <CommunityHub />
      </main>
      <Footer />
    </>
  );
}
