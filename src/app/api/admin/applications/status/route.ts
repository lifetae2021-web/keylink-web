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

    // v8.12.9: 로컬 환경(development) 차단 로직 제거 (테스트 용이성 확보)

    // 1. 관리자 권한 확인
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

    // 2. 트랜잭션 실행 (모든 읽기 및 계산 작업을 트랜잭션 내부에서 수행하여 Race Condition 방지)
    await adminDb.runTransaction(async (transaction) => {
      const appRef = adminDb.doc(`applications/${applicationId}`);
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists) throw new Error('신청서를 찾을 수 없습니다.');

      const appData = appSnap.data()!;
      const prevStatus = appData.status;
      const sessionId = appData.sessionId;
      const gender = appData.gender;

      const sessionRef = adminDb.doc(`sessions/${sessionId}`);
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) throw new Error('세션 정보를 찾을 수 없습니다.');

      const sessionData = sessionSnap.data()!;

      let assignedSlot: number | null = null;
      let isWaitlisted = false;
      let freedSlot: number | null = null;
      let waitlistPromotee: { id: string } | null = null;

      // confirmed 전환 시 실시간 슬롯 번호 계산 (트랜잭션 락 보호)
      if (status === 'confirmed' && prevStatus !== 'confirmed') {
        const userSnapForApp = await transaction.get(adminDb.doc(`users/${appData.userId}`));
        const isDummy = appData.id?.startsWith('dummy') || appData.userId?.startsWith('user_m_') || appData.userId?.startsWith('user_f_') || userSnapForApp.data()?.isDummy === true;
        
        if (isDummy) {
          // 더미 계정은 슬롯 번호를 부여하지 않음 (미배정 유지)
          assignedSlot = null;
        } else {
          const maxCount = gender === 'male' ? (sessionData.maxMale || 8) : (sessionData.maxFemale || 8);

          // 트랜잭션 내부에서 실시간 confirmed 리스트 조회
          const confirmedQuery = adminDb.collection('applications')
            .where('sessionId', '==', sessionId)
            .where('gender', '==', gender)
            .where('status', '==', 'confirmed');
          const confirmedSnap = await transaction.get(confirmedQuery);

          const usedSlots = new Set(confirmedSnap.docs
            .filter(d => {
              const data = d.data();
              const dIsDummy = data.id?.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_');
              return !dIsDummy;
            })
            .map(d => d.data().slotNumber)
            .filter((n): n is number => n != null));

          // 1~maxCount 범위에서 빈 슬롯 탐색
          let slot = 1;
          while (slot <= maxCount && usedSlots.has(slot)) slot++;

          if (slot > maxCount) {
            isWaitlisted = true;
          } else {
            assignedSlot = slot;
          }
        }
      }

      let slotsToShift: { id: string; newSlotNumber: number }[] = [];

      // 취소 시: 해제되는 슬롯 번호 파악 + 대기자 1번 조회 + 슬롯 자동 당김 처리 (트랜잭션 락 보호)
      if ((status === 'cancelled' || status === 'applied') && (prevStatus === 'confirmed' || prevStatus === 'waitlisted')) {
        freedSlot = appData.slotNumber ?? null;

        if (freedSlot != null) {
          const waitlistQuery = adminDb.collection('applications')
            .where('sessionId', '==', sessionId)
            .where('gender', '==', gender)
            .where('status', '==', 'waitlisted');
          const waitlistSnap = await transaction.get(waitlistQuery);

          if (!waitlistSnap.empty) {
            const sorted = waitlistSnap.docs.sort((a, b) => {
              const at = a.data().appliedAt?.toMillis?.() ?? 0;
              const bt = b.data().appliedAt?.toMillis?.() ?? 0;
              return at - bt;
            });
            waitlistPromotee = { id: sorted[0].id };
          }

          // 대기자가 없을 때만 슬롯 자동 당김 검토
          if (!waitlistPromotee) {
            const allAppsQuery = adminDb.collection('applications')
              .where('sessionId', '==', sessionId);
            const allAppsSnap = await transaction.get(allAppsQuery);

            const hasSentSecondSms = allAppsSnap.docs.some(d => {
              const data = d.data();
              return data.secondSmsSentAt != null;
            });

            // 2차 안내문자가 발송되지 않은 경우에만 자동 당김 실행
            if (!hasSentSecondSms) {
              const confirmedAppsOfSameGender = allAppsSnap.docs
                .filter(d => {
                  const data = d.data();
                  const dIsDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_');
                  // 같은 성별, 참가확정 상태이면서 현재 변경 중인 신청서가 아닌 것
                  return data.gender === gender && data.status === 'confirmed' && d.id !== applicationId && !dIsDummy;
                })
                .map(d => ({
                  id: d.id,
                  slotNumber: d.data().slotNumber
                }))
                .filter(a => a.slotNumber != null && a.slotNumber > freedSlot!);

              confirmedAppsOfSameGender.forEach(app => {
                slotsToShift.push({
                  id: app.id,
                  newSlotNumber: app.slotNumber - 1
                });
              });
            }
          }
        }
      }

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

      if (status === 'cancelled') {
        updateData.cancelledAt = FieldValue.serverTimestamp();
      }

      transaction.update(appRef, updateData);

      // 슬롯 당김 일괄 적용
      slotsToShift.forEach(item => {
        const ref = adminDb.collection('applications').doc(item.id);
        transaction.update(ref, {
          slotNumber: item.newSlotNumber,
          updatedAt: FieldValue.serverTimestamp()
        });
      });

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
