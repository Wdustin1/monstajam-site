import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/cover',
      },
      {
        pathname: '/monstajam-logo.png',
        search: '',
      },
      {
        pathname: '/monstajam-record-label.png',
        search: '',
      },
      {
        pathname: '/releases/**',
        search: '',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: '**.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
