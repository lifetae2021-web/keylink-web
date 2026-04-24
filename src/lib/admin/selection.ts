import { auth } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const APPLICATIONS = 'applications';

async function callStatusApi(applicationId: string, status: string) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/admin/applications/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ applicationId, status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '처리 중 오류가 발생했습니다.');
  return data;
}

/** 단일 신청자 선발 (status: 'selected') - SMS 발송이 수반되므로 기존 API 사용 권장 */
export async function selectApplicant(applicationId: string): Promise<void> {
  // 선발(selected)의 경우 SMS 발송 로직이 있는 /api/admin/applications/select를 
  // 사용하는 것이 일반적이므로, 여기서는 단순 상태 변경만 필요한 경우에 사용
  await updateDoc(doc(db, APPLICATIONS, applicationId), {
    status: 'selected',
    updatedAt: Timestamp.now(),
  });
}

/** 단일 신청자 보류 (status: 'held') */
export async function holdApplicant(applicationId: string): Promise<void> {
  await updateDoc(doc(db, APPLICATIONS, applicationId), {
    status: 'held',
    updatedAt: Timestamp.now(),
  });
}

/** 입금 확인 처리 (paymentConfirmed: true, status: 'confirmed') */
export async function confirmPayment(
  applicationId: string,
  sessionId: string,
  gender: 'male' | 'female'
): Promise<void> {
  await callStatusApi(applicationId, 'confirmed');
}

/** 
 * 신청 취소 처리 (status: 'cancelled')
 */
export async function cancelApplicant(
  applicationId: string, 
  sessionId: string, 
  gender: 'male' | 'female',
  wasConfirmed: boolean = false
): Promise<void> {
  await callStatusApi(applicationId, 'cancelled');
}

/**
 * 취소된 신청자 복구 (status: 'confirmed')
 */
export async function restoreApplicant(
  applicationId: string,
  sessionId: string,
  gender: 'male' | 'female'
): Promise<void> {
  await callStatusApi(applicationId, 'confirmed');
}

/** 일괄 선발 처리 */
export async function bulkSelectApplicants(
  applicationIds: string[]
): Promise<void> {
  // TODO: 일괄 처리 시에도 하드 리미트 적용이 필요한 경우 
  // 반복문을 돌며 개별 API를 호출하거나, 일괄 처리를 위한 전용 API를 생성해야 합니다.
  // v8.1.7 현재는 빌드 오류 방지를 위해 기존 로직 유지
  const { writeBatch, doc, Timestamp } = await import('firebase/firestore');
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
