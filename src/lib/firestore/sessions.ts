/**
 * Firestore 기수(Sessions) 컬렉션 쿼리 함수
 * v4.4.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Session, SessionStatus } from '@/lib/types';

const COLLECTION = 'sessions';

// Firestore 문서 → Session 타입 변환
function fromDoc(snap: DocumentSnapshot): Session | null {
  if (!snap.exists()) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    episodeNumber: d.episodeNumber,
    title: d.title,
    eventDate: (d.eventDate as Timestamp).toDate(),
    location: d.location,
    maxMale: d.maxMale,
    maxFemale: d.maxFemale,
    currentMale: d.currentMale ?? 0,
    currentFemale: d.currentFemale ?? 0,
    region: (d.region || 'busan') as 'busan' | 'changwon',
    status: d.status as SessionStatus,
    votingUnlockedAt: d.votingUnlockedAt
      ? (d.votingUnlockedAt as Timestamp).toDate()
      : null,
    createdAt: (d.createdAt as Timestamp).toDate(),
  };
}

/** 특정 기수 단건 조회 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, COLLECTION, sessionId));
  return fromDoc(snap);
}

/** 신청 접수 중인 기수 목록 (status: 'open') */
export async function getOpenSessions(): Promise<Session[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'open'),
    orderBy('eventDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Session[];
}

/** 모든 기수 목록 (관리자용) */
export async function getAllSessions(): Promise<Session[]> {
  const q = query(
    collection(db, COLLECTION),
    orderBy('episodeNumber', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Session[];
}

/** 특정 기수 실시간 구독 */
export function subscribeSession(
  sessionId: string,
  callback: (session: Session | null) => void
) {
  return onSnapshot(doc(db, COLLECTION, sessionId), (snap) => {
    callback(fromDoc(snap));
  });
}

/** 모든 기수 실시간 구독 (이벤트 카드 UI용) */
export function subscribeAllSessions(
  callback: (sessions: Session[]) => void
) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('episodeNumber', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const sessions = snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Session[];
    callback(sessions);
  });
}
