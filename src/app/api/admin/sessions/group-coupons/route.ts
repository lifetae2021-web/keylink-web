import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { grantGroupCoupon } from '@/lib/groupCoupon';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const role = (await adminDb.doc(`users/${decoded.uid}`).get()).data()?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: '기수 ID가 필요합니다.' }, { status: 400 });

    const snap = await adminDb.collection('applications')
      .where('sessionId', '==', sessionId)
      .where('femaleOption', '==', 'group')
      .get();

    let granted = 0;
    for (const d of snap.docs) {
      if (await grantGroupCoupon(d.ref) === 'granted') granted++;
    }
    return NextResponse.json({ success: true, granted });
  } catch (error: any) {
    console.error('[Group Coupon Error]', error);
    return NextResponse.json({ error: error.message || '동반 쿠폰 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
