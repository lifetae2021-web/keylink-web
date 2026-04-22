import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Session, Application, MatchingResult, Vote } from '@/lib/types';

/**
 * 사용자가 참여한 기수 목록 및 상태 조회
 */
export async function getUserParticipations(userId: string) {
  const q = query(
    collection(db, 'applications'),
    where('userId', '==', userId)
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return [];

  const participations = await Promise.all(snap.docs.map(async (appDoc) => {
    const appData = { id: appDoc.id, ...appDoc.data() } as Application;
    
    // 세션 정보 가져오기
    const sessionSnap = await getDoc(doc(db, 'sessions', appData.sessionId));
    if (!sessionSnap.exists()) return null;
    
    const d = sessionSnap.data()!;
    const sessionData = { 
      id: sessionSnap.id, 
      ...d,
      eventDate: d.eventDate?.toDate?.() || new Date(),
      createdAt: d.createdAt?.toDate?.() || new Date(),
    } as Session;
    
    // 매칭 결과 존재 여부 및 상태 확인
    const resultQ = query(
      collection(db, 'matchingResults'),
      where('sessionId', '==', appData.sessionId),
      where('userId', '==', userId)
    );
    const resultSnap = await getDocs(resultQ);
    const hasPublishedResult = !resultSnap.empty && resultSnap.docs[0].data().status === 'approved';

    return {
      application: appData,
      session: sessionData,
      status: hasPublishedResult ? 'published' : (sessionData.status === 'open' ? 'confirmed' : 'pending'),
      matchingResultId: !resultSnap.empty ? resultSnap.docs[0].id : null
    };
  }));

  return (participations.filter(Boolean) as any[]).sort((a, b) => 
    (b.session.eventDate?.getTime?.() || 0) - (a.session.eventDate?.getTime?.() || 0)
  );
}

/**
 * 특정 세션의 매칭 결과 상세 조회
 */
export async function getUserMatchResult(userId: string, sessionId: string) {
  const q = query(
    collection(db, 'matchingResults'),
    where('userId', '==', userId),
    where('sessionId', '==', sessionId),
    where('status', '==', 'approved')
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return null;
  
  const d = snap.docs[0].data();
  return { id: snap.docs[0].id, ...d } as MatchingResult;
}

/**
 * 투표 통계 및 선택 내역 조회
 */
export async function getUserVoteStats(userId: string, sessionId: string) {
  // 1. 내가 받은 호감 (인기 지수)
  // MatchingResult에 이미 집계된 receivedVotes 필드가 있으므로 이를 활용합니다.
  const resultQ = query(
    collection(db, 'matchingResults'),
    where('userId', '==', userId),
    where('sessionId', '==', sessionId)
  );
  const resultSnap = await getDocs(resultQ);
  const receivedCount = !resultSnap.empty ? (resultSnap.docs[0].data().receivedVotes || 0) : 0;
  
  // 2. 내가 선택한 사람들
  // Vote 문서는 `${sessionId}_${userId}` 형식의 ID를 사용합니다.
  const voteDocRef = doc(db, 'votes', `${sessionId}_${userId}`);
  const voteSnap = await getDoc(voteDocRef);
  
  let myChoices: any[] = [];
  if (voteSnap.exists()) {
    const data = voteSnap.data() as Vote;
    myChoices = data.choices || [];
  }
  
  return {
    receivedCount,
    myChoices
  };
}
