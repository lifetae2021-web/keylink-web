'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import CherryBlossoms from './CherryBlossoms';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <CherryBlossoms />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
