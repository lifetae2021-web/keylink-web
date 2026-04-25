import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Session, Application, Vote } from '@/lib/types';

async function getSummary(sessionId: string) {
  const snap = await getDoc(doc(db, 'matchingSummaries', sessionId));
  if (!snap.exists()) return null;
  return snap.data() as {
    sessionId: string;
    matchedPairs: { userAId: string; userBId: string }[];
    unmatchedUserIds: string[];
    voteCountMap: Record<string, number>;
    status: 'pending' | 'approved';
    approvedAt: any;
    calculatedAt: any;
  };
}

function getPartnerIds(summary: NonNullable<Awaited<ReturnType<typeof getSummary>>>, userId: string): string[] {
  return summary.matchedPairs
    .filter(p => p.userAId === userId || p.userBId === userId)
    .map(p => p.userAId === userId ? p.userBId : p.userAId);
}

/**
 * 사용자가 참여한 기수 목록 및 상태 조회
 */
export async function getUserParticipations(userId: string) {
  const q = query(collection(db, 'applications'), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return [];

  const participations = await Promise.all(snap.docs.map(async (appDoc) => {
    const appData = { id: appDoc.id, ...appDoc.data() } as Application;

    const sessionSnap = await getDoc(doc(db, 'sessions', appData.sessionId));
    if (!sessionSnap.exists()) return null;

    const d = sessionSnap.data()!;
    const sessionData = {
      id: sessionSnap.id,
      ...d,
      eventDate: d.eventDate?.toDate?.() || new Date(),
      createdAt: d.createdAt?.toDate?.() || new Date(),
    } as Session;

    const summary = await getSummary(appData.sessionId);
    const inResults = summary && (
      summary.unmatchedUserIds.includes(userId) ||
      summary.matchedPairs.some(p => p.userAId === userId || p.userBId === userId)
    );
    const hasPublishedResult = !!(summary && summary.status === 'approved' && inResults);

    return {
      application: appData,
      session: sessionData,
      status: hasPublishedResult ? 'published' : (sessionData.status === 'open' ? 'confirmed' : 'pending'),
      matchingResultId: hasPublishedResult ? appData.sessionId : null,
    };
  }));

  return (participations.filter(Boolean) as any[]).sort((a, b) =>
    (b.session.eventDate?.getTime?.() || 0) - (a.session.eventDate?.getTime?.() || 0)
  );
}

/**
 * 특정 세션의 매칭 결과 상세 조회
 */
export async function getUserMatchResult(userId: string, sessionId: string): Promise<import('@/lib/types').MatchingResult | null> {
  const summary = await getSummary(sessionId);
  if (!summary || summary.status !== 'approved') return null;

  const partnerIds = getPartnerIds(summary, userId);
  const isMatched = partnerIds.length > 0;
  const inResults = isMatched || summary.unmatchedUserIds.includes(userId);
  if (!inResults) return null;

  return {
    id: sessionId,
    sessionId,
    userId,
    matched: isMatched,
    partnerId: partnerIds[0] ?? null,
    partnerIds,
    receivedVotes: summary.voteCountMap[userId] ?? 0,
    status: summary.status,
    approvedAt: summary.approvedAt?.toDate?.() ?? null,
  };
}

/**
 * 투표 통계 및 선택 내역 조회
 */
export async function getUserVoteStats(userId: string, sessionId: string) {
  const summary = await getSummary(sessionId);
  const receivedCount = summary?.voteCountMap[userId] ?? 0;

  const voteDocRef = doc(db, 'votes', `${sessionId}_${userId}`);
  const voteSnap = await getDoc(voteDocRef);

  let myChoices: any[] = [];
  if (voteSnap.exists()) {
    const data = voteSnap.data() as Vote;
    myChoices = data.choices || [];
  }

  return { receivedCount, myChoices };
}
