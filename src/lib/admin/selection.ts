/**
 * 관리자 전용 신청서 상태 변경 함수
 * v4.4.0
 */

import {
  doc,
  updateDoc,
  Timestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const APPLICATIONS = 'applications';
const SESSIONS = 'sessions';

/** 단일 신청자 선발 (status: 'selected') */
export async function selectApplicant(applicationId: string): Promise<void> {
  await updateDoc(doc(db, APPLICATIONS, applicationId), {
    status: 'selected',
    updatedAt: Timestamp.now(),
  });
}

/** 입금 확인 처리 (paymentConfirmed: true, status: 'confirmed') */
export async function confirmPayment(
  applicationId: string,
  sessionId: string,
  gender: 'male' | 'female'
): Promise<void> {
  const batch = writeBatch(db);
  const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';

  batch.update(doc(db, APPLICATIONS, applicationId), {
    status: 'confirmed',
    paymentConfirmed: true,
    updatedAt: Timestamp.now(),
  });

  batch.update(doc(db, SESSIONS, sessionId), {
    [counterField]: increment(1),
    updatedAt: Timestamp.now(),
  });

  await batch.commit();
}

/** 
 * 신청 취소 처리 (status: 'cancelled')
 * 만약 이전 상태가 'confirmed'였다면 세션 카운트를 -1 합니다.
 */
export async function cancelApplicant(
  applicationId: string, 
  sessionId: string, 
  gender: 'male' | 'female',
  wasConfirmed: boolean = false
): Promise<void> {
  const batch = writeBatch(db);
  
  batch.update(doc(db, APPLICATIONS, applicationId), {
    status: 'cancelled',
    updatedAt: Timestamp.now(),
  });

  if (wasConfirmed) {
    const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';
    batch.update(doc(db, SESSIONS, sessionId), {
      [counterField]: increment(-1),
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

/**
 * 취소된 신청자 복구 (status: 'confirmed')
 * 세션 카운트를 다시 +1 합니다.
 */
export async function restoreApplicant(
  applicationId: string,
  sessionId: string,
  gender: 'male' | 'female'
): Promise<void> {
  const batch = writeBatch(db);
  const counterField = gender === 'male' ? 'currentMale' : 'currentFemale';

  batch.update(doc(db, APPLICATIONS, applicationId), {
    status: 'confirmed',
    updatedAt: Timestamp.now(),
  });

  batch.update(doc(db, SESSIONS, sessionId), {
    [counterField]: increment(1),
    updatedAt: Timestamp.now(),
  });

  await batch.commit();
}

/** 일괄 선발 처리 */
export async function bulkSelectApplicants(
  applicationIds: string[]
): Promise<void> {
  const batch = writeBatch(db);
  const now = Timestamp.now();
  applicationIds.forEach((id) => {
    batch.update(doc(db, APPLICATIONS, id), {
      status: 'selected',
      updatedAt: now,
    });
  });
  await batch.commit();
}
