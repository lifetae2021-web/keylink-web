/**
 * Firestore 매칭결과(MatchingResults) 컬렉션 쿼리 함수
 * v4.4.0
 */

import {
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MatchingResult, MatchingResultStatus } from '@/lib/types';

const COLLECTION = 'matchingResults';

// 복합 ID: sessionId_userId
function makeResultId(sessionId: string, userId: string) {
  return `${sessionId}_${userId}`;
}

function fromDoc(snap: DocumentSnapshot): MatchingResult | null {
  if (!snap.exists()) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    sessionId: d.sessionId,
    userId: d.userId,
    matched: d.matched,
    partnerId: d.partnerId ?? null,
    partnerIds: d.partnerIds ?? [],
    partnerProfile: d.partnerProfile ?? undefined,
    receivedVotes: d.receivedVotes ?? 0,
    status: d.status as MatchingResultStatus,
    approvedAt: d.approvedAt ? (d.approvedAt as Timestamp).toDate() : null,
  };
}

/** 특정 기수의 나의 매칭 결과 단건 조회 */
export async function getMyMatchingResult(
  sessionId: string,
  userId: string
): Promise<MatchingResult | null> {
  const snap = await getDoc(
    doc(db, COLLECTION, makeResultId(sessionId, userId))
  );
  return fromDoc(snap);
}

/**
 * 마이페이지용 실시간 구독
 * - status: 'approved'인 경우에만 결과를 노출하는 것은 컴포넌트 레이어에서 처리
 */
export function subscribeMyMatchingResult(
  sessionId: string,
  userId: string,
  callback: (result: MatchingResult | null) => void
) {
  return onSnapshot(
    doc(db, COLLECTION, makeResultId(sessionId, userId)),
    (snap) => {
      callback(fromDoc(snap));
    }
  );
}
