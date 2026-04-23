/**
 * Keylink 핵심 비즈니스 로직 TypeScript 타입 정의
 * v4.4.0 - Firestore 데이터 모델
 */

// ─────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────
export type Gender = 'male' | 'female';

// ─────────────────────────────────────────────
// Sessions (기수) 컬렉션
// ─────────────────────────────────────────────
export type SessionStatus =
  | 'open'       // 신청 접수 중
  | 'closed'     // 신청 마감 (선발 진행 중)
  | 'voting'     // 행사 당일, 투표 활성화
  | 'matching'   // 투표 완료, 매칭 집계 중
  | 'completed'; // 매칭 결과 승인 완료

export interface Session {
  id: string;
  episodeNumber: number;           // 120
  title: string;                   // "부산 로테이션 소개팅 120기"
  eventDate: Date;                 // 행사 날짜 (자정 잠금 해제 기준)
  location: string;
  maxMale: number;
  maxFemale: number;
  currentMale: number;             // 확정된 남성 참여자 수 (실시간)
  currentFemale: number;           // 확정된 여성 참여자 수 (실시간)
  region: 'busan' | 'changwon';    // 운영 지역 추가
  status: SessionStatus;
  votingUnlockedAt: Date | null;   // 투표 잠금 해제 시각
  
  // v6.6.0 추가 필드 (새 기수 등록 폼 연동)
  venue?: string;                  // 서면역 인근 카페
  venueAddress?: string;           // 상세 주소
  price?: number;                  // 29000
  originalPrice?: number;          // 39000 (할인 표시용)
  targetMaleAge?: string;          // 94년생~01년생
  targetFemaleAge?: string;        // 94년생~01년생
  description?: string;
  
  createdAt: Date;
  updatedAt?: Date;
}

// ─────────────────────────────────────────────
// Applications (신청서) 컬렉션
// ─────────────────────────────────────────────
export type ApplicationStatus =
  | 'applied'    // 신청 완료 (검토 중)
  | 'selected'   // 선발됨 (입금 대기)
  | 'confirmed'  // 입금 확인 → 참가 확정
  | 'cancelled'; // 취소

export interface Application {
  id: string;
  userId: string;              // Firebase Auth UID
  sessionId: string;
  name: string;
  age: number;
  gender: Gender;
  job: string;                 // workplace (회사명 / 직무)
  residence: string;           // 거주 지역 (선택)
  phone: string;               // 연락처 (필수)
  status: ApplicationStatus;
  paymentConfirmed: boolean;
  appliedAt: Date;
  updatedAt: Date;
  
  // 추가 프로필 정보 (v5.1.0 데이터 연동 강화)
  price?: number;
  maleOption?: string;
  instaId?: string;
  mbti?: string;
  smoking?: string;
  drinking?: string;
  religion?: string;
  drink?: string;
  idealType?: string;
  nonIdealType?: string;
  avoidAcquaintance?: string;
  etc?: string;
}

// ─────────────────────────────────────────────
// Votes (투표) 컬렉션
// ─────────────────────────────────────────────
export interface VoteChoice {
  priority: 1 | 2 | 3;
  targetUserId: string;
  targetUserName?: string; // 표시 전용 (선택적)
}

export interface Vote {
  id: string;                // `${sessionId}_${userId}` 복합 ID
  userId: string;
  sessionId: string;
  choices: VoteChoice[];     // 1~3순위
  submittedAt: Date;
}

// ─────────────────────────────────────────────
// MatchingResults (매칭 결과) 컬렉션
// ─────────────────────────────────────────────
export type MatchingResultStatus = 'pending' | 'approved';

export interface MatchingResult {
  id: string;                 // `${sessionId}_${userId}` 복합 ID
  sessionId: string;
  userId: string;
  matched: boolean;
  partnerId: string | null;   // 매칭된 상대 UID (미매칭 시 null)
  partnerProfile?: {          // 결과 화면 표시용 캐시
    number: string;
    gender: Gender;
    age: string;
    job: string;
    height?: string;
    residence: string;
    batch: string;
  };
  receivedVotes: number;      // 받은 총 투표 수
  status: MatchingResultStatus;
  approvedAt: Date | null;
}

// ─────────────────────────────────────────────
// 관리자 대시보드용 집계 타입
// ─────────────────────────────────────────────
export interface SessionStats {
  sessionId: string;
  totalApplied: number;
  totalSelected: number;
  totalConfirmed: number;
  totalCancelled: number;
  maleConfirmed: number;
  femaleConfirmed: number;
  totalVoted: number;
}

// ─────────────────────────────────────────────
// 매칭 알고리즘 결과 타입
// ─────────────────────────────────────────────
export interface MatchPair {
  userAId: string;
  userBId: string;
}

export interface MatchingAlgorithmResult {
  sessionId: string;
  matchedPairs: MatchPair[];
  unmatchedUserIds: string[];
  voteCountMap: Record<string, number>; // userId → 받은 투표 수
  calculatedAt: Date;
}
