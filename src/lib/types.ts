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

  // v8.1.1: 호감도 투표 상세 설정
  voteConfig?: {
    maxSelection: number;          // 최대 선택 인원 (기본 3)
    slotCount?: number;            // 호수 선택 범위 (기본 8)
    questionText: string;          // 유저에게 보여줄 질문
    showReason: boolean;           // 선택 사유 입력 여부
    resultVisibility: 'all' | 'mutual'; // 결과 공개 범위

    // v8.1.7: 네이버 폼 스타일 질문 커스터마이징
    q1Label?: string;              // 실명 확인 문구
    q2Label?: string;              // 본인 호수 선택 문구
    q3Label?: string;              // 이성 선택 메인 질문
    q4Label?: string;              // 최종 확인 문구
    q5Label?: string;              // 후기 입력 문구
  };

  // v8.2.4: 스마트 로테이션 타이머 설정
  timerConfig?: {
    totalRounds?: number;
    talkTime?: number;
    cakeRound?: number;
    totalTables?: number;
    customMaleOffset?: number;
    startMs?: number | null;
    status?: 'stopped' | 'running' | 'paused';
  };

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
  | 'applied'     // 신청 완료 (검토 중)
  | 'selected'    // 선발됨 (입금 대기)
  | 'confirmed'   // 입금 확인 → 참가 확정
  | 'waitlisted'  // 정원 초과 → 대기자
  | 'held'        // 보류
  | 'cancelled';  // 취소

export interface Application {
  id: string;
  userId: string;              // Firebase Auth UID
  sessionId: string;
  name: string;
  age: number;
  gender: Gender;
  job: string;                 // workplace (회사명 / 직무)
  residence: string;           // 거주지 (선택)
  phone: string;               // 연락처 (필수)
  status: ApplicationStatus;
  paymentConfirmed: boolean;
  appliedAt: Date;
  updatedAt: Date;

  // 추가 프로필 정보 (v5.1.0 데이터 연동 강화)
  price?: number;
  maleOption?: string;
  femaleOption?: string;
  groupPartnerName?: string;
  groupPartnerBirthYear?: string;
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

  // v8.3.8: 직업 검토 프로세스용 필드
  displayJob?: string;         // 대외 노출용 정제된 직업명 (예: 대기업 직장인)
  isJobReviewed?: boolean;     // 관리자 직업 확인 완료 여부

  // v8.5.4: 고정 호수 (정원 내 확정 시 빈 슬롯 순서대로 배정)
  slotNumber?: number;
}

// ─────────────────────────────────────────────
// Votes (투표) 컬렉션
// ─────────────────────────────────────────────
export interface VoteChoice {
  priority: 1 | 2 | 3;
  targetUserId: string;
  targetUserName?: string; // 표시 전용 (선택적)
  reason?: string;         // v8.1.7 사유 추가
}

export interface Vote {
  id: string;                // `${sessionId}_${userId}` 복합 ID
  userId: string;
  sessionId: string;
  choices: VoteChoice[];     // 1~3순위

  // v8.1.7: 네이버 폼 스타일 대응 신규 필드
  realName?: string;         // 실명 확인
  myAlias?: string;          // 본인 호수 (ex. 키링남 1호)
  finalCheck?: boolean;      // 매칭 라인업 최종 확인 여부
  disclosureMode?: 'public' | 'anonymous'; // 공개 모드 (v8.1.7)
  feedback?: string;         // 후기 (선택 사항)

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
  partnerId: string | null;   // (Deprecated) 첫 번째 매칭 상대
  partnerIds: string[];       // v8.6.0: 다중 매칭 지원을 위한 상대방 UID 배열
  partnerProfile?: {          // 결과 화면 표시용 캐시 (Deprecated)
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
