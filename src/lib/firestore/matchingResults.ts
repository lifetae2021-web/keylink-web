import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MatchingResult } from '@/lib/types';

function extractUserResult(sessionId: string, userId: string, d: any): MatchingResult | null {
  const partnerIds: string[] = (d.matchedPairs ?? [])
    .filter((p: any) => p.userAId === userId || p.userBId === userId)
    .map((p: any) => p.userAId === userId ? p.userBId : p.userAId);

  const inResults = partnerIds.length > 0 || (d.unmatchedUserIds ?? []).includes(userId);
  if (!inResults) return null;

  return {
    id: sessionId,
    sessionId,
    userId,
    matched: partnerIds.length > 0,
    partnerId: partnerIds[0] ?? null,
    partnerIds,
    receivedVotes: d.voteCountMap?.[userId] ?? 0,
    status: d.status,
    approvedAt: d.approvedAt?.toDate?.() ?? null,
  };
}

/** 특정 기수의 나의 매칭 결과 단건 조회 */
export async function getMyMatchingResult(
  sessionId: string,
  userId: string
): Promise<MatchingResult | null> {
  const snap = await getDoc(doc(db, 'matchingSummaries', sessionId));
  if (!snap.exists()) return null;
  return extractUserResult(sessionId, userId, snap.data());
}

/** 마이페이지용 실시간 구독 */
export function subscribeMyMatchingResult(
  sessionId: string,
  userId: string,
  callback: (result: MatchingResult | null) => void
) {
  return onSnapshot(
    doc(db, 'matchingSummaries', sessionId),
    (snap) => {
      if (!snap.exists()) { callback(null); return; }
      callback(extractUserResult(sessionId, userId, snap.data()));
    }
  );
}
