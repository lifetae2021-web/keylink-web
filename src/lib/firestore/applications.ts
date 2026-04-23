/**
 * Firestore 신청서(Applications) 컬렉션 쿼리 함수
 * v7.9.8 - 복합 인덱스 의존성 제거, 실시간 동기화 안정화
 */

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Application, ApplicationStatus } from '@/lib/types';

const COLLECTION = 'applications';

function fromDoc(snap: DocumentSnapshot): Application | null {
  if (!snap.exists()) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    userId: d.userId,
    sessionId: d.sessionId,
    name: d.name,
    age: d.age,
    gender: d.gender,
    job: d.job,
    residence: d.residence,
    phone: d.phone ?? '',
    status: d.status as ApplicationStatus,
    paymentConfirmed: d.paymentConfirmed ?? false,
    appliedAt: (d.appliedAt as Timestamp).toDate(),
    updatedAt: (d.updatedAt as Timestamp).toDate(),
    // v5.1.0 데이터 연동 강화
    instaId: d.instaId,
    smoking: d.smoking,
    drinking: d.drinking,
    religion: d.religion,
    drink: d.drink,
    idealType: d.idealType,
    nonIdealType: d.nonIdealType,
    avoidAcquaintance: d.avoidAcquaintance,
    etc: d.etc,
  };
}

/**
 * 특정 사용자의 가장 최근 신청서 단건 조회
 * ⚠ orderBy 제거: 복합 인덱스 없이도 동작하도록 클라이언트 정렬 사용
 */
export async function getMyLatestApplication(
  userId: string
): Promise<Application | null> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docs = snap.docs
    .map((d) => fromDoc(d))
    .filter(Boolean) as Application[];
  docs.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
  return docs[0] ?? null;
}

/** 특정 기수의 모든 신청서 (관리자용) */
export async function getApplicationsBySession(
  sessionId: string
): Promise<Application[]> {
  const q = query(
    collection(db, COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('appliedAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Application[];
}

/** 특정 기수 + 상태 필터 (관리자용) */
export async function getApplicationsByStatus(
  sessionId: string,
  status: ApplicationStatus
): Promise<Application[]> {
  const q = query(
    collection(db, COLLECTION),
    where('sessionId', '==', sessionId),
    where('status', '==', status),
    orderBy('appliedAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Application[];
}

/**
 * 사용자 마이페이지용 신청서 실시간 구독 (onSnapshot)
 *
 * ✅ 핵심 수정: orderBy 제거로 복합 인덱스 의존성 완전 제거
 *    - 이전: where(userId) + orderBy(appliedAt) → 복합 인덱스 필요 → 없으면 쿼리 무음 실패
 *    - 이후: where(userId) 단독 → 단순 인덱스만 필요 → 항상 동작
 *    - 정렬: 클라이언트에서 updatedAt 기준으로 처리
 *      (관리자가 status 변경 시 updatedAt이 갱신되므로 즉시 마이페이지에 반영)
 */
export function subscribeMyApplication(
  userId: string,
  callback: (application: Application | null) => void,
  onError?: (error: any) => void
) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const docs = snap.docs
        .map((d) => fromDoc(d))
        .filter(Boolean) as Application[];
      // updatedAt 기준 최신 정렬: 관리자 상태 변경이 즉시 반영됨
      docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      callback(docs[0] ?? null);
    },
    (err) => {
      console.error('[subscribeMyApplication] Firestore 오류:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * 사용자 마이페이지용 모든 신청서 실시간 구독 (onSnapshot)
 * v7.9.8 - 다중 '선발 확정' 카드 노출을 위해 전체 목록 반환
 */
export function subscribeMyApplications(
  userId: string,
  callback: (applications: Application[]) => void,
  onError?: (error: any) => void
) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback([]);
        return;
      }
      const docs = snap.docs
        .map((d) => fromDoc(d))
        .filter(Boolean) as Application[];
      // 기본적으로 업데이트 순 정렬
      docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      callback(docs);
    },
    (err) => {
      console.error('[subscribeMyApplications] Firestore 오류:', err);
      if (onError) onError(err);
    }
  );
}

/** 신규 신청서 제출 */
export async function submitApplication(
  data: Omit<Application, 'id' | 'appliedAt' | 'updatedAt'>
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    appliedAt: now,
    updatedAt: now,
  });
  return docRef.id;
}
