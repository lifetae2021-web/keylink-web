import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // In production, verify authorization token and role.
    const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
      }
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();
      const callerRole = userSnap.data()?.role;
      if (!userSnap.exists || (callerRole !== 'admin' && callerRole !== 'super_admin')) {
        return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const { userId, couponData } = await req.json();

    if (!userId || !couponData) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
    }

    const couponToSave: any = { ...couponData };
    
    // Convert expireAt if it exists
    if (couponToSave.expireAt) {
      couponToSave.expireAt = new Date(couponToSave.expireAt);
    }
    
    // Set/convert createdAt
    couponToSave.createdAt = new Date();

    const couponRef = await adminDb.collection('users').doc(userId).collection('coupons').add(couponToSave);

    return NextResponse.json({ success: true, id: couponRef.id });
  } catch (error: any) {
    console.error('[Add Coupon Error]', error);
    return NextResponse.json({ error: error.message || '쿠폰 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
