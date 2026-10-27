import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { grantGroupCoupon } from '@/lib/groupCoupon';

/** 본인 신청 중 지급 대상(예: 행사 후 뒤늦게 가입한 비회원)을 확인해 동반 쿠폰을 지급한다. */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);

    const snap = await adminDb.collection('applications')
      .where('userId', '==', decoded.uid)
      .where('femaleOption', '==', 'group')
      .get();

    let granted = 0;
    for (const d of snap.docs) {
      if (await grantGroupCoupon(d.ref) === 'granted') granted++;
    }
    return NextResponse.json({ success: true, granted });
  } catch (error: any) {
    console.error('[My Group Coupon Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
