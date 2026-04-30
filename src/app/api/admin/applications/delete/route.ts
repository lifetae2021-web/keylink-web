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

    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    const appPreSnap = await adminDb.doc(`applications/${applicationId}`).get();
    if (!appPreSnap.exists) {
      return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }
    const appPreData = appPreSnap.data()!;
    const { sessionId, gender, status: prevStatus, slotNumber } = appPreData;

    const wasOccupyingSlot = prevStatus === 'confirmed' || prevStatus === 'waitlisted';
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
      // 이미 위에서 존재 확인을 완료했으므로 트랜잭션 내 중복 체크 생략
      const sessionRef = adminDb.doc(`sessions/${sessionId}`);
      const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';

      transaction.delete(appRef);

      if (prevStatus === 'confirmed' && !waitlistPromotee) {
        transaction.update(sessionRef, {
          [counterField]: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
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
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
