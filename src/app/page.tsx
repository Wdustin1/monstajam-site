import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import ScrollIndicator from '@/components/ScrollIndicator';
import MusicLibrary from '@/components/MusicLibrary';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-grow pt-24 hero-bg-gradient">
        <Hero />
        <ScrollIndicator />
        <MusicLibrary />
      </main>
      <Footer />
    </>
  );
}
