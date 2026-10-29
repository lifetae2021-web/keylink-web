import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { redeemForApplication } from '@/lib/points';

/** 신청 직후 본인 신청서에 포인트 할인을 적용한다 (정식 회원만). */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!userSnap.exists || userSnap.data()?.isRegistered === false) {
      return NextResponse.json({ error: '포인트는 정식 회원만 사용할 수 있습니다.' }, { status: 403 });
    }

    const { applicationId, amount } = await req.json();
    if (!applicationId || !(Number(amount) > 0)) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    const { used } = await redeemForApplication(decoded.uid, applicationId, Number(amount));
    return NextResponse.json({ success: true, used });
  } catch (error: any) {
    console.error('[Points Redeem Error]', error);
    return NextResponse.json({ error: error.message || '포인트 사용 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
