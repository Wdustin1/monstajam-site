import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Sign In',
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
