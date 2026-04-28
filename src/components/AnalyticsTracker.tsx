'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // 관리자 페이지는 트래킹에서 제외
    if (pathname.startsWith('/admin')) return;

    const trackVisit = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const uvKey = `last_visit_uv_${today}`;
        const hasVisitedToday = localStorage.getItem(uvKey);
        const isUnique = !hasVisitedToday;

        if (isUnique) {
          localStorage.setItem(uvKey, 'true');
        }

        // 서버 사이드 API 호출 (Firebase Rules 우회)
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isUnique }),
        });
      } catch (error) {
        console.error('Failed to track visit:', error);
      }
    };

    trackVisit();
  }, [pathname]);

  return null;
}
