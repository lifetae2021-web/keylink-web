import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Session, Application, Vote } from '@/lib/types';

async function getSummary(sessionId: string) {
  try {
    const snap = await getDoc(doc(db, 'matchingSummaries', sessionId));
    if (!snap.exists()) return null;
    
    const data = snap.data();
    // For older sessions, if status field is missing, we assume it's approved
    if (data.status && data.status !== 'approved') return null;
    
    return data as {
      sessionId: string;
      matchedPairs: { userAId: string; userBId: string }[];
      unmatchedUserIds: string[];
      voteCountMap: Record<string, number>;
      status: 'pending' | 'approved';
      approvedAt: any;
      calculatedAt: any;
    };
  } catch (error: any) {
    // If it throws PERMISSION_DENIED, it means the document doesn't exist or is not approved yet.
    if (error.code === 'permission-denied') return null;
    console.warn("getSummary error:", error);
    return null;
  }
}

function getPartnerIds(summary: NonNullable<Awaited<ReturnType<typeof getSummary>>>, userId: string): string[] {
  return summary.matchedPairs
    .filter(p => p.userAId === userId || p.userBId === userId)
    .map(p => p.userAId === userId ? p.userBId : p.userAId);
}

// v13.x: sessions는 공개 컬렉션(allow read: if true)이라 배치 조회가 안전함.
// matchingSummaries는 status == 'approved' 조건부 읽기 규칙이 있어 배치 시 전체 쿼리가
// permission-denied로 실패할 위험이 있으므로 getSummary()의 개별 조회 방식을 그대로 유지한다.
async function getSessionsMap(sessionIds: string[]): Promise<Map<string, Session>> {
  const map = new Map<string, Session>();
  const uniqueIds = Array.from(new Set(sessionIds));
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 30) {
    chunks.push(uniqueIds.slice(i, i + 30));
  }
  await Promise.all(chunks.map(async (chunk) => {
    const q = query(collection(db, 'sessions'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data();
      map.set(d.id, {
        id: d.id,
        ...data,
        eventDate: data.eventDate?.toDate?.() || new Date(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as Session);
    });
  }));
  return map;
}

/**
 * 사용자가 참여한 기수 목록 및 상태 조회
 */
export async function getUserParticipations(userId: string, isAdmin: boolean = false) {
  const q = query(collection(db, 'applications'), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return [];

  const appDataList = snap.docs.map((appDoc) => ({ id: appDoc.id, ...appDoc.data() } as Application));

  // v13.x: 신청서마다 sessions를 개별 조회하지 않고, 고유 세션 ID들을 모아 한 번에 배치 조회
  const [sessionsMap, summaries] = await Promise.all([
    getSessionsMap(appDataList.map(a => a.sessionId)),
    Promise.all(Array.from(new Set(appDataList.map(a => a.sessionId))).map(async (sid) => [sid, await getSummary(sid)] as const)),
  ]);
  const summaryMap = new Map(summaries);

  const participations = await Promise.all(appDataList.map(async (appData) => {
    const sessionData = sessionsMap.get(appData.sessionId);
    const summary = summaryMap.get(appData.sessionId) ?? null;

    if (!sessionData) return null;

    if (sessionData.isTest && !isAdmin) return null; // 테스트 기수는 일반 유저 목록에서 제외

    const inResults = summary && (
      (summary.unmatchedUserIds || []).includes(userId) ||
      (summary.matchedPairs || []).some(p => p.userAId === userId || p.userBId === userId) ||
      summary.unmatchedUserIds === undefined // For older sessions without this field
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
  const inResults = isMatched || (summary.unmatchedUserIds || []).includes(userId) || summary.unmatchedUserIds === undefined;
  if (!inResults) return null;

  let partnerProfile: any = undefined;
  if (isMatched && partnerIds[0]) {
    const partnerId = partnerIds[0];
    const appQuery = query(
      collection(db, 'applications'),
      where('sessionId', '==', sessionId),
      where('userId', '==', partnerId)
    );

    // v10.2.0: 이성 신청서 조회와 기수 세션 상세 조회를 동시에 병렬 처리
    const [appSnap, sessionSnap] = await Promise.all([
      getDocs(appQuery),
      getDoc(doc(db, 'sessions', sessionId))
    ]);

    if (!appSnap.empty) {
      const appData = appSnap.docs[0].data();
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
