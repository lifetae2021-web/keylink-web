'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // 관리자 페이지는 트래킹에서 제외
    if (pathname.startsWith('/admin')) return;

    // 방문자 ID 생성 (없으면)
    let visitorId = localStorage.getItem('kl_visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('kl_visitor_id', visitorId);
    }

    const referrer = document.referrer || '';
    const userAgent = navigator.userAgent;

    const trackVisit = async (uid: string | null) => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const uvKey = `last_visit_uv_${today}`;
        const hasVisitedToday = localStorage.getItem(uvKey);
        const isUnique = !hasVisitedToday;

        if (isUnique) {
          localStorage.setItem(uvKey, 'true');
        }

        // 서버 사이드 API 호출 (Firebase Rules 우회 및 상세 로그 기록)
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            isUnique,
            path: pathname,
            visitorId,
            userId: uid,
            referrer,
            userAgent
          }),
        });
      } catch (error) {
        console.error('Failed to track visit:', error);
      }
    };

    let tracked = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!tracked) {
        tracked = true;
        
        // 관리자 권한 확인 (관리자 본인의 트래킹 제외)
        if (user) {
          try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists() && userSnap.data()?.role === 'admin') {
              return; // 관리자라면 트래킹 중단
            }
          } catch (e) {
            console.error('Error checking admin role for analytics:', e);
          }
        }
        
        trackVisit(user?.uid || null);
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  return null;
}
