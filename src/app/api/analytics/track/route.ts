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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Analytics API] Error tracking visit:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
