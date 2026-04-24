import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 신청 관리 상태 변경 API (Hard Limit 반영)
 * v8.1.7: 모든 상태 변경(확정, 취소, 복구)을 트랜잭션으로 처리하여 인원 초과 방지
 */

export async function POST(req: NextRequest) {
  try {
    const { applicationId, status } = await req.json();

    if (!applicationId || !status) {
      return NextResponse.json({ error: '신청서 ID와 변경할 상태가 필요합니다.' }, { status: 400 });
    }

    // 1. 관리자 권한 확인
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

    // 2. 트랜잭션 전 사전 조회 (트랜잭션 내 일반 쿼리 불가)
    const appPreSnap = await adminDb.doc(`applications/${applicationId}`).get();
    if (!appPreSnap.exists) throw new Error('신청서를 찾을 수 없습니다.');
    const appPreData = appPreSnap.data()!;
    const sessionId = appPreData.sessionId;
    const gender = appPreData.gender;

    // confirmed 전환 시 슬롯 번호를 미리 계산
    let assignedSlot: number | null = null;
    let isWaitlisted = false;

    // 취소 시 대기자 자동 승격을 위한 사전 조회
    let freedSlot: number | null = null;
    let waitlistPromotee: { id: string } | null = null;

    if (status === 'confirmed') {
      const sessionPreSnap = await adminDb.doc(`sessions/${sessionId}`).get();
      const sessionPreData = sessionPreSnap.data()!;
      const maxCount = gender === 'male' ? (sessionPreData.maxMale || 8) : (sessionPreData.maxFemale || 8);

      // 세션 카운터 대신 실제 confirmed 건수로 판단 (카운터 오차 방지)
      const confirmedSnap = await adminDb.collection('applications')
        .where('sessionId', '==', sessionId)
        .where('gender', '==', gender)
        .where('status', '==', 'confirmed')
        .get();

      const usedSlots = new Set(confirmedSnap.docs.map(d => d.data().slotNumber).filter((n): n is number => n != null));

      // 1~maxCount 범위에서 빈 슬롯 탐색
      let slot = 1;
      while (slot <= maxCount && usedSlots.has(slot)) slot++;

      if (slot > maxCount) {
        isWaitlisted = true;
      } else {
        assignedSlot = slot;
      }
    }

    // 취소 시: 해제되는 슬롯 번호 파악 + 대기자 1번 조회
    if ((status === 'cancelled' || status === 'applied') && (appPreData.status === 'confirmed' || appPreData.status === 'waitlisted')) {
      freedSlot = appPreData.slotNumber ?? null;

      if (freedSlot != null) {
        const waitlistSnap = await adminDb.collection('applications')
          .where('sessionId', '==', sessionId)
          .where('gender', '==', gender)
          .where('status', '==', 'waitlisted')
          .get();

        if (!waitlistSnap.empty) {
          // 인덱스 없이 코드에서 정렬
          const sorted = waitlistSnap.docs.sort((a, b) => {
            const at = a.data().appliedAt?.toMillis?.() ?? 0;
            const bt = b.data().appliedAt?.toMillis?.() ?? 0;
            return at - bt;
          });
          waitlistPromotee = { id: sorted[0].id };
        }
      }
    }

    // 3. 트랜잭션 실행
    await adminDb.runTransaction(async (transaction) => {
      const appRef = adminDb.doc(`applications/${applicationId}`);
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists) throw new Error('신청서를 찾을 수 없습니다.');

      const appData = appSnap.data()!;
      const prevStatus = appData.status;

      const sessionRef = adminDb.doc(`sessions/${sessionId}`);
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) throw new Error('세션 정보를 찾을 수 없습니다.');

      const isIncreasing = (status === 'confirmed' && !isWaitlisted && prevStatus !== 'confirmed');
      const isDecreasing = ((status === 'cancelled' || status === 'applied') && (prevStatus === 'selected' || prevStatus === 'confirmed' || prevStatus === 'waitlisted'));

      const updateData: any = {
        status: isWaitlisted ? 'waitlisted' : status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (status === 'confirmed') {
        updateData.paymentConfirmed = true;
        updateData.slotNumber = assignedSlot;
      }

      if (status === 'cancelled' || status === 'applied') {
        updateData.slotNumber = null;
      }

      transaction.update(appRef, updateData);

      const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';
      if (isIncreasing) {
        transaction.update(sessionRef, {
          [counterField]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (isDecreasing) {
        // 대기자 승격 시 카운터는 유지 (취소 -1, 승격 +1 상쇄)
        if (!waitlistPromotee) {
          transaction.update(sessionRef, {
            [counterField]: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // 대기자 자동 승격
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

    return NextResponse.json({ success: true, message: '상태가 성공적으로 업데이트되었습니다.' });

  } catch (error: any) {
    console.error('Status Update API Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
