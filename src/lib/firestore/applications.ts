/**
 * Firestore 신청서(Applications) 컬렉션 쿼리 함수
 * v4.4.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  DocumentSnapshot,
  limit,
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
  };
}

/** 특정 사용자의 가장 최근 신청서 단건 조회 */
export async function getMyLatestApplication(
  userId: string
): Promise<Application | null> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('appliedAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return fromDoc(snap.docs[0]);
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

/** 사용자 마이페이지용 신청서 실시간 구독 */
export function subscribeMyApplication(
  userId: string,
  callback: (application: Application | null) => void,
  onError?: (error: any) => void
) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('appliedAt', 'desc'),
    limit(1)
  );
  return onSnapshot(
    q, 
    (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        callback(fromDoc(snap.docs[0]));
      }
    },
    (err) => {
      console.error('subscribeMyApplication error:', err);
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
