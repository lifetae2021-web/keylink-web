// 키링 월드에서 포인트 쓰는 곳(가격 P, 1P = 1원) — 웹 화면과 서버(/api/plaza/shop)가 같이 쓴다.
// 포인트는 회원만 쓸 수 있고, 차감은 서버에서만 한다. 키링 월드 혜택이며 소개팅 선발과는 무관하다.
export { SHOP_ACC, SEASON_ACC } from './look.js';
export const CAT_FOOD_PRICE = 50;    // 동물 밥주기(강아지·고양이·펭귄·순록)
// 키링 월드에서 받는 포인트(웹사이트 방문 포인트와 별개, 회원만)
export const ENTRY_BONUS = 500;                     // 24시간 안의 첫 입장
export const ENTRY_BONUS_GAP_MS = 24 * 60 * 60 * 1000;
export const STAY_POINTS = 50;                      // 머문 시간 1시간마다
export const STAY_UNIT_MS = 60 * 60 * 1000;
export const STAY_TICK_MS = 5 * 60 * 1000;          // 화면이 5분마다 '아직 있어요'를 보낸다
export const STAY_IDLE_MS = 10 * 60 * 1000;         // 10분 넘게 아무 조작이 없으면(자리 비움) 시간이 쌓이지 않는다
export const STAY_DAILY_MAX = 8;                    // 하루(한국 날짜) 최대 8번 = 400P
export const WISH_PRICE = 100;       // 분수대에 소원 던지기
export const WISH_MAX = 40;          // 소원 글자 수
export const FOUNTAIN = { x: 0, z: 0, r: 5.5 };   // 분수대 중심(웹 좌표)과 소원 빌 수 있는 거리
// 크리스마스 테마: 소원을 담아 트리에 거는 장식 모양
export const WISH_ORNS = ['star', 'heart', 'bell', 'ball', 'snow'];
