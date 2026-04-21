'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import CherryBlossoms from './CherryBlossoms';
import ProfileGuard from './ProfileGuard';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <ProfileGuard />
      <CherryBlossoms />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
