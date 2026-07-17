'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
      // 한 번 트래킹한 세션은 다시 하지 않음 (useEffect 내 변수 대신 useRef나 다른 방식도 좋지만 여기선 로직 유지)
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const uvKey = `last_visit_uv_${today}`;
        const hasVisitedToday = localStorage.getItem(uvKey);
        const isUnique = !hasVisitedToday;

        if (isUnique) {
          localStorage.setItem(uvKey, 'true');
        }

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

    let isHandled = false;

    // auth 상태가 확인될 때까지 기다림
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isHandled) return;

      if (user) {
        // 사용자가 있는 경우 트래킹 진행 (관리자도 방문 기록 수집)
        isHandled = true;
        trackVisit(user.uid);
      } else {
        // 사용자가 없는 경우 (비회원): 
        // 찰나의 시간 동안 관리자 로그인이 풀렸다가 다시 잡히는 경우 대비 500ms 대기
        setTimeout(() => {
          if (isHandled) return;
          isHandled = true;
          trackVisit(null);
        }, 500);
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  return null;
}
