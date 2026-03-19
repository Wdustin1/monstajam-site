import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "MonstaJam - Unreleased Beats",
  description: "Discover the beats and tracks that never made it to the mainstream. Curated for true fans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col antialiased selection:bg-fuchsia-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
