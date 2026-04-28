'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import CherryBlossoms from './CherryBlossoms';
import ProfileGuard from './ProfileGuard';
import AnalyticsTracker from './AnalyticsTracker';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isAdmin) return <>{children}</>;

  // 모바일에서는 오직 홈('/')에서만 푸터 노출
  const shouldShowFooter = !isMobile || pathname === '/';

  return (
    <div className="flex flex-col min-h-screen">
      <AnalyticsTracker />
      <ProfileGuard />
      <CherryBlossoms />
      <Navbar />
      <main className="flex-grow">{children}</main>
      {shouldShowFooter && <Footer />}
    </div>
  );
}
