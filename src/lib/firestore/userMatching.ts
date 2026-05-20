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
  const q = query(
    collection(db, 'matchingSummaries'),
    where('__name__', '==', sessionId),
    where('status', '==', 'approved')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as {
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
    if (d.isTest) return null; // 테스트 기수는 일반 유저 목록에서 제외

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

    const status = hasPublishedResult 
      ? 'published' 
      : (sessionData.status === 'matching' || sessionData.status === 'voting')
        ? 'pending' 
        : appData.status;

    return {
      application: appData,
      session: sessionData,
      status,
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

  let partnerProfile: any = undefined;
  if (isMatched && partnerIds[0]) {
    const partnerId = partnerIds[0];
    const appQuery = query(
      collection(db, 'applications'),
      where('sessionId', '==', sessionId),
      where('userId', '==', partnerId)
    );
    const appSnap = await getDocs(appQuery);
    if (!appSnap.empty) {
      const appData = appSnap.docs[0].data();
      const sessionSnap = await getDoc(doc(db, 'sessions', sessionId));
      const batchTitle = sessionSnap.exists() ? `${sessionSnap.data().episodeNumber || ''}기` : '';
      
      let calculatedAge = '미입력';
      if (appData.birthDate) {
        calculatedAge = `${new Date().getFullYear() - new Date(appData.birthDate).getFullYear() + 1}세`;
      } else if (appData.age) {
        calculatedAge = `${appData.age}세`;
      }

      partnerProfile = {
        number: appData.slotNumber ? String(appData.slotNumber) : '?',
        gender: appData.gender,
        age: calculatedAge,
        job: appData.displayJob || appData.job || '미입력',
        height: appData.height ? `${appData.height}cm` : '미입력',
        residence: appData.residence || '미입력',
        batch: batchTitle || '알 수 없음',
      };
    }
  }

  return {
    id: sessionId,
    sessionId,
    userId,
    matched: isMatched,
    partnerId: partnerIds[0] ?? null,
    partnerIds,
    partnerProfile,
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

  const q = query(
    collection(db, 'votes'),
    where('sessionId', '==', sessionId),
    where('userId', '==', userId)
  );
  const voteSnap = await getDocs(q);

  let myChoices: any[] = [];
  if (!voteSnap.empty) {
    const data = voteSnap.docs[0].data() as Vote;
    myChoices = data.choices || [];
  }

  return { receivedCount, myChoices };
}
