/**
 * Firestore 투표(Votes) 컬렉션 쿼리 함수
 * v4.4.0
 */

import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vote, VoteChoice } from '@/lib/types';

const COLLECTION = 'votes';

// 복합 ID: sessionId_userId (중복 투표 방지)
function makeVoteId(sessionId: string, userId: string) {
  return `${sessionId}_${userId}`;
}

function fromDoc(snap: DocumentSnapshot): Vote | null {
  if (!snap.exists()) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    userId: d.userId,
    sessionId: d.sessionId,
    choices: d.choices as VoteChoice[],
    submittedAt: (d.submittedAt as Timestamp).toDate(),
  };
}

/** 나의 투표 여부 확인 */
export async function getMyVote(
  sessionId: string,
  userId: string
): Promise<Vote | null> {
  const snap = await getDoc(doc(db, COLLECTION, makeVoteId(sessionId, userId)));
  return fromDoc(snap);
}

/** 특정 기수 전체 투표 목록 (관리자 / 알고리즘용) */
export async function getAllVotesBySession(sessionId: string): Promise<Vote[]> {
  const q = query(
    collection(db, COLLECTION),
    where('sessionId', '==', sessionId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d)).filter(Boolean) as Vote[];
}

/**
 * 투표 제출 (1회만 허용 - 이미 제출된 경우 에러)
 */
export async function submitVote(
  sessionId: string,
  userId: string,
  choices: VoteChoice[]
): Promise<void> {
  const voteId = makeVoteId(sessionId, userId);
  const existing = await getDoc(doc(db, COLLECTION, voteId));

  if (existing.exists()) {
    throw new Error('이미 투표를 제출하셨습니다. 투표는 1회만 가능합니다.');
  }

  if (choices.length === 0 || choices.length > 3) {
    throw new Error('1~3순위를 선택해 주세요.');
  }

  await setDoc(doc(db, COLLECTION, voteId), {
    userId,
    sessionId,
    choices,
    submittedAt: Timestamp.now(),
  });
}

/**
 * 나를 선택한 사람들의 투표 목록 조회 (v8.1.1)
 * 성능상 기수의 모든 투표를 가져와 필터링합니다. (참여자 수가 소수이기에 효율적)
 */
export async function getVotesReceivedByMe(
  sessionId: string,
  userId: string
): Promise<Vote[]> {
  const allVotes = await getAllVotesBySession(sessionId);
  return allVotes.filter(vote => 
    vote.choices.some(choice => choice.targetUserId === userId)
  );
}
