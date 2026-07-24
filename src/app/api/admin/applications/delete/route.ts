import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();

    if (!applicationId) {
      return NextResponse.json({ error: '신청서 ID가 필요합니다.' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();

    const callerRole = userSnap.data()?.role;
    if (!userSnap.exists || callerRole !== 'super_admin') {
      return NextResponse.json({ error: '최고관리자만 참가자를 삭제할 수 있습니다.' }, { status: 403 });
    }

    const appPreSnap = await adminDb.doc(`applications/${applicationId}`).get();
    if (!appPreSnap.exists) {
      return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }
    const appPreData = appPreSnap.data()!;
    const { sessionId, gender, status: prevStatus, slotNumber } = appPreData;

    const isDummy = appPreData.userId?.startsWith('user_m_') || appPreData.userId?.startsWith('user_f_') || appPreData.id?.startsWith('dummy_') || appPreData.isDummy === true;
    const isDarkTemplar = appPreData.isDarkTemplar === true;

    const wasOccupyingSlot = (prevStatus === 'confirmed' || prevStatus === 'waitlisted') && !isDarkTemplar && !isDummy;
    const freedSlot: number | null = wasOccupyingSlot ? (slotNumber ?? null) : null;

    let waitlistPromotee: { id: string } | null = null;
    if (freedSlot != null && prevStatus === 'confirmed') {
      const waitlistSnap = await adminDb.collection('applications')
        .where('sessionId', '==', sessionId)
        .where('gender', '==', gender)
        .where('status', '==', 'waitlisted')
        .get();

      if (!waitlistSnap.empty) {
        const sorted = waitlistSnap.docs.sort((a, b) => {
          const at = a.data().appliedAt?.toMillis?.() ?? 0;
          const bt = b.data().appliedAt?.toMillis?.() ?? 0;
          return at - bt;
        });
        waitlistPromotee = { id: sorted[0].id };
      }
    }

    await adminDb.runTransaction(async (transaction) => {
      const appRef = adminDb.doc(`applications/${applicationId}`);
      const sessionRef = adminDb.doc(`sessions/${sessionId}`);
      const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';

      // ✅ Firestore 트랜잭션 규칙: 모든 read를 write보다 먼저 실행
      const sessionSnap = await transaction.get(sessionRef);

      // 쿠폰 반환을 위한 읽기 (유동적 쿠폰 로직)
      let couponSnap = null;
      let couponRef = null;
      let hasOtherAppsUsingCoupon = false;
      
      if (appPreData.userId && appPreData.couponId) {
        // 다른 기수에 동일한 쿠폰을 대기 중이거나 정착시킨 신청서가 있는지 확인
        const otherAppsSnap = await transaction.get(
          adminDb.collection('applications')
            .where('userId', '==', appPreData.userId)
            .where('couponId', '==', appPreData.couponId)
        );
        hasOtherAppsUsingCoupon = otherAppsSnap.docs.some(doc => doc.id !== applicationId);

        // 남은 신청서가 없다면(완전한 환불 상황) 쿠폰 문서를 가져옴
        if (!hasOtherAppsUsingCoupon) {
          couponRef = adminDb.doc(`users/${appPreData.userId}/coupons/${appPreData.couponId}`);
          couponSnap = await transaction.get(couponRef);
        }
      }

      // --- writes ---
      transaction.delete(appRef);

      // 쿠폰 복구 (반환)
      if (!hasOtherAppsUsingCoupon && couponSnap && couponSnap.exists && couponRef) {
        transaction.update(couponRef, { isUsed: false });
      }

      if (prevStatus === 'confirmed' && !waitlistPromotee && !isDummy && !isDarkTemplar) {
        if (sessionSnap.exists) {
          transaction.update(sessionRef, {
            [counterField]: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (waitlistPromotee && freedSlot != null) {
        const promoteeRef = adminDb.collection('applications').doc(waitlistPromotee.id);
        transaction.update(promoteeRef, {
          status: 'confirmed',
          slotNumber: freedSlot,
          paymentConfirmed: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Application API Error:', error);
    // Firestore 트랜잭션 순서 오류 등 영문 에러를 한글로 변환
    let koreanMessage = error.message || '서버 오류가 발생했습니다.';
    if (koreanMessage.includes('reads to be executed before all writes')) {
      koreanMessage = '데이터베이스 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
    } else if (koreanMessage.includes('NOT_FOUND') || koreanMessage.includes('No document')) {
      koreanMessage = '삭제할 신청서를 찾을 수 없습니다.';
    } else if (koreanMessage.includes('PERMISSION_DENIED')) {
      koreanMessage = '권한이 없습니다. 관리자 계정으로 다시 로그인해주세요.';
    }
    return NextResponse.json({ error: koreanMessage }, { status: 500 });
  }
}
