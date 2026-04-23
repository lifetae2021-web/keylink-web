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

// Firestore 문서 → Session 타입 변환 (v6.6.2: 방어적 파싱 강화)
function fromDoc(snap: DocumentSnapshot): Session | null {
  if (!snap.exists()) return null;
  const d = snap.data()!;
  try {
    return {
      id: snap.id,
      episodeNumber: d.episodeNumber ?? 0,
      title: d.title ?? '',
      eventDate: d.eventDate?.toDate?.() ?? new Date(),
      location: d.location ?? d.venue ?? '',
      venue: d.venue ?? d.location ?? '',
      venueAddress: d.venueAddress ?? '',
      price: d.price ?? 29000,
      originalPrice: d.originalPrice ?? 39000,
      targetMaleAge: d.targetMaleAge ?? '',
      targetFemaleAge: d.targetFemaleAge ?? '',
      maxMale: d.maxMale ?? 0,
      maxFemale: d.maxFemale ?? 0,
      currentMale: d.currentMale ?? 0,
      currentFemale: d.currentFemale ?? 0,
      region: (d.region ?? 'busan') as 'busan' | 'changwon',
      status: d.status as SessionStatus,
      votingUnlockedAt: d.votingUnlockedAt?.toDate?.() ?? null,
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
      updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
    };
  } catch (err) {
    console.error('[fromDoc] Error parsing session document:', snap.id, err);
    return null;
  }
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
    where('status', '==', 'open')
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
    collection(db, COLLECTION)
  );
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Session[];
      callback(sessions);
    },
    (error) => {
      // 🚨 Firestore 보안 규칙 에러 감지
      if (error.code === 'permission-denied') {
        console.error(
          '🚨 [Firestore] 비로그인 방문자의 sessions 컬렉션 읽기가 거부되었습니다.\n' +
          '👉 Firebase 콘솔 > Firestore > 규칙 탭에서 아래 규칙을 적용하세요:\n\n' +
          'match /sessions/{sessionId} {\n  allow read: if true;\n  allow write: if isAdmin();\n}'
        );
      } else {
        console.error('[subscribeAllSessions] Error:', error.message);
      }
      callback([]); // 에러 시 빈 배열로 fallback
    }
  );
}
