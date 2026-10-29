import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { adminAdjustPoints } from '@/lib/points';

/** 관리자 포인트 수동 지급/차감 (지급분도 적립 건으로 남겨 1년 유효기간 적용) */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();
    const callerRole = adminSnap.data()?.role;
    if (!adminSnap.exists || (callerRole !== 'admin' && callerRole !== 'super_admin')) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const { userId, type, amount, reason } = await req.json();
    const value = Math.floor(Number(amount));
    if (!userId || (type !== 'add' && type !== 'deduct') || !(value > 0) || !reason) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    await adminAdjustPoints(userId, type, value, reason);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Points Adjust Error]', error);
    return NextResponse.json({ error: error.message || '포인트 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
