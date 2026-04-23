import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 신청 관리 상태 변경 API (Hard Limit 반영)
 * v8.1.1: 모든 상태 변경(확정, 취소, 복구)을 트랜잭션으로 처리하여 인원 초과 방지
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

    // 2. 트랜잭션 실행
    await adminDb.runTransaction(async (transaction) => {
      const appRef = adminDb.doc(`applications/${applicationId}`);
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists) throw new Error('신청서를 찾을 수 없습니다.');
      
      const appData = appSnap.data()!;
      const sessionId = appData.sessionId;
      const gender = appData.gender;
      const prevStatus = appData.status;

      const sessionRef = adminDb.doc(`sessions/${sessionId}`);
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) throw new Error('세션 정보를 찾을 수 없습니다.');
      const sessionData = sessionSnap.data()!;

      // 인원 증가가 필요한 경우 (confirmed로의 변경 또는 cancelled에서 복구)
      const isIncreasing = (status === 'confirmed' && prevStatus !== 'selected' && prevStatus !== 'confirmed');
      // 인원 감소가 필요한 경우 (cancelled로 변경 시 이전 상태가 점유 중이었을 때)
      const isDecreasing = (status === 'cancelled' && (prevStatus === 'selected' || prevStatus === 'confirmed'));

      if (isIncreasing) {
        // 현재 인원 체크 (selected + confirmed)
        const reservedQuery = adminDb.collection('applications')
          .where('sessionId', '==', sessionId)
          .where('gender', '==', gender)
          .where('status', 'in', ['selected', 'confirmed']);
        
        const reservedSnap = await transaction.get(reservedQuery);
        const currentCount = reservedSnap.size;
        const maxCount = gender === 'male' ? (sessionData.maxMale || 8) : (sessionData.maxFemale || 8);

        if (currentCount >= maxCount) {
          throw new Error(`해당 성별의 모집 정원이 이미 충족되었습니다. (현재 ${currentCount}/${maxCount})`);
        }
      }

      // 3. 필드 업데이트 로직
      const updateData: any = {
        status: status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (status === 'confirmed') {
        updateData.paymentConfirmed = true;
      }

      transaction.update(appRef, updateData);

      // 4. 세션 카운터 업데이트
      const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';
      if (isIncreasing) {
        transaction.update(sessionRef, {
          [counterField]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (isDecreasing) {
        transaction.update(sessionRef, {
          [counterField]: FieldValue.increment(-1),
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
