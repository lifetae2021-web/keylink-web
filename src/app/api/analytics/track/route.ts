import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { isUnique, path, visitorId, userId, referrer, userAgent } = await request.json();
    const today = format(new Date(), 'yyyy-MM-dd');
    const docRef = adminDb.collection('analytics').doc(today);

    const updateData: any = {
      pv: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    };

    if (isUnique) {
      updateData.uv = FieldValue.increment(1);
    }

    // 1. 일별 통계 업데이트
    await docRef.set(updateData, { merge: true });

    // 2. 상세 방문 로그 기록
    if (path && visitorId) {
      await adminDb.collection('visitor_logs').add({
        path,
        visitorId,
        userId: userId || null,
        referrer: referrer || '',
        userAgent: userAgent || '',
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    // 3. (CRM) 유저별 방문 횟수 업데이트 (1시간에 1번 제한)
    if (userId) {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      
      if (userSnap.exists) {
        const userData = userSnap.data();
        const now = new Date();
        const lastVisit = userData?.lastVisitAt?.toDate?.() || new Date(0);
        
        // 마지막 방문으로부터 1시간(3600000ms)이 지났을 때만 카운트 증가
        if (now.getTime() - lastVisit.getTime() > 60 * 60 * 1000) {
          await userRef.update({
            visitCount: FieldValue.increment(1),
            lastVisitAt: FieldValue.serverTimestamp()
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Analytics API] Error tracking visit:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
