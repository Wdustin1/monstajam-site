import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/context/PlayerContext";
import PersistentPlayer from "@/components/PersistentPlayer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "MonstaJam - Unreleased Beats",
  description: "Discover the beats and tracks that never made it to the mainstream. Curated for true fans.",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.className} min-h-screen flex flex-col antialiased selection:bg-fuchsia-500 selection:text-white pb-28`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 50%, rgba(255, 0, 255, 0.05), transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(0, 255, 255, 0.05), transparent 25%)
          `,
        }}
      >
        {/* Background glow orbs */}
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
          <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-pink-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-600/20 rounded-full blur-[120px]" />
        </div>

        {/* Skip to main content — keyboard/screen reader accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#00e5ff] focus:text-black focus:font-bold focus:text-sm"
        >
          Skip to content
        </a>

        <PlayerProvider>
          {children}
          <PersistentPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
