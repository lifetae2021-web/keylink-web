import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/coupons/backfill-welcome
 * 웰컴 쿠폰이 없는 기존 회원들에게 일괄 발급
 */
export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // 관리자 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'super_admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 전체 정규 회원 목록 조회
    const usersSnap = await adminDb
      .collection('users')
      .where('isRegistered', '==', true)
      .get();

    let issuedCount = 0;
    let skippedCount = 0;
    const issuedTo: string[] = [];

    const now = new Date();
    const expireAt = new Date(now);
    expireAt.setMonth(expireAt.getMonth() + 3);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();

      // mergedTo 표시된 비활성 계정 스킵
      if (userData.mergedTo) {
        skippedCount++;
        continue;
      }

      // 이미 쿠폰이 있는지 확인
      const couponsSnap = await adminDb
        .collection('users')
        .doc(uid)
        .collection('coupons')
        .limit(1)
        .get();

      if (!couponsSnap.empty) {
        skippedCount++;
        continue;
      }

      // 쿠폰 없는 회원 → 웰컴 쿠폰 발급
      await adminDb
        .collection('users')
        .doc(uid)
        .collection('coupons')
        .add({
          title: '웰컴 가입 축하 쿠폰',
          type: 'amount',
          value: 5000,
          isUsed: false,
          createdAt: now,
          expireAt,
          note: '쿠폰 누락 회원 일괄 발급 (백필)',
        });

      issuedTo.push(userData.name || uid);
      issuedCount++;
    }

    return NextResponse.json({
      success: true,
      issuedCount,
      skippedCount,
      issuedTo,
      message: `${issuedCount}명에게 웰컴 쿠폰을 발급했습니다.`,
    });
  } catch (error: any) {
    console.error('Coupon backfill error:', error);
    return NextResponse.json({ error: error.message || '오류가 발생했습니다.' }, { status: 500 });
  }
}
