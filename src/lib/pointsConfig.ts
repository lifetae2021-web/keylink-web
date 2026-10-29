// 포인트 제도 공통 숫자 (서버/클라이언트 공용, 1P = 1원)
export const DAILY_VISIT_POINTS = 100;
export const MIN_REDEEM_POINTS = 1000;
export const VISITOR_POINT_CAP = 1000;

// 떨어지는 포인트 기본값 (관리자 설정 settings/general에 값이 없을 때)
export const DEFAULT_DROP_ENABLED = true;
export const DEFAULT_DROP_CHANCE_PERCENT = 35; // 3분마다 한 번 굴릴 때 떨어질 확률
export const DEFAULT_DROP_DAILY_LIMIT = 3;
