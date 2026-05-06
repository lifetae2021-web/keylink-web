import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 신청자 기수(날짜) 변경 API
 * v1.0.12: 기존 기수 정원 차감, 대기자 승격, 새 기수 정원 반영을 서버 트랜잭션으로 한 번에 처리
 */

export async function POST(req: NextRequest) {
  try {
    const { applicationId, targetSessionId } = await req.json();

    if (!applicationId || !targetSessionId) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 1. 관리자 권한 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const adminSnap = await adminDb.doc(`users/${decodedToken.uid}`).get();
    
    if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 });
    }

    // 2. 사전 데이터 조회 (트랜잭션 밖에서 수행)
    const appRef = adminDb.doc(`applications/${applicationId}`);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new Error('신청서를 찾을 수 없습니다.');
    
    const appData = appSnap.data()!;
    const oldSessionId = appData.sessionId;
    const status = appData.status;
    const gender = appData.gender;

    if (oldSessionId === targetSessionId) throw new Error('동일한 기수로는 변경할 수 없습니다.');

    // 기존 기수 대기자 조회
    let promoteeId: string | null = null;
    const freedSlot = appData.slotNumber ?? null;
    if (freedSlot != null) {
      const waitlistSnap = await adminDb.collection('applications')
        .where('sessionId', '==', oldSessionId)
        .where('gender', '==', gender)
        .where('status', '==', 'waitlisted')
        .get();
      
      if (!waitlistSnap.empty) {
        const sorted = waitlistSnap.docs.sort((a, b) => 
          (a.data().appliedAt?.toMillis() || 0) - (b.data().appliedAt?.toMillis() || 0)
        );
        promoteeId = sorted[0].id;
      }
    }

    // 새 기수 슬롯 조회
    let newSlot: number | null = null;
    if (status === 'confirmed' || status === 'selected') {
      const newSessionSnap = await adminDb.doc(`sessions/${targetSessionId}`).get();
      if (!newSessionSnap.exists) throw new Error('새로운 세션 정보를 찾을 수 없습니다.');
      
      const newSessionData = newSessionSnap.data()!;
      const maxCount = gender === 'male' ? (newSessionData.maxMale || 8) : (newSessionData.maxFemale || 8);

      const confirmedSnap = await adminDb.collection('applications')
        .where('sessionId', '==', targetSessionId)
        .where('gender', '==', gender)
        .where('status', '==', 'confirmed')
        .get();
      
      const usedSlots = new Set(confirmedSnap.docs.map(d => d.data().slotNumber).filter((n): n is number => n != null));
      let slot = 1;
      while (slot <= maxCount && usedSlots.has(slot)) slot++;
      if (slot <= maxCount) newSlot = slot;
    }

    // 3. 트랜잭션 실행 (쓰기 작업 위주)
    await adminDb.runTransaction(async (transaction) => {
      const oldSessionRef = adminDb.doc(`sessions/${oldSessionId}`);
      const newSessionRef = adminDb.doc(`sessions/${targetSessionId}`);
      const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';

      // --- A. 기존 기수 처리 ---
      if (status === 'confirmed' || status === 'selected' || status === 'waitlisted') {
        if (promoteeId) {
          transaction.update(adminDb.doc(`applications/${promoteeId}`), {
            status: 'confirmed',
            slotNumber: freedSlot,
            paymentConfirmed: true,
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          transaction.update(oldSessionRef, {
            [counterField]: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      // --- B. 새 기수 처리 ---
      let finalStatus = status;
      if (status === 'confirmed' || status === 'selected') {
        if (newSlot == null) {
          finalStatus = 'waitlisted';
        } else {
          transaction.update(newSessionRef, {
            [counterField]: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      // --- C. 신청서 정보 업데이트 ---
      transaction.update(appRef, {
        sessionId: targetSessionId,
        status: finalStatus,
        slotNumber: newSlot,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Change Session API Error:', error);
    return NextResponse.json({ error: error.message || '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
