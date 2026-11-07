// 키링 월드에서 포인트 쓰는 곳(가격 P, 1P = 1원) — 웹 화면과 서버(/api/plaza/shop)가 같이 쓴다.
// 포인트는 회원만 쓸 수 있고, 차감은 서버에서만 한다. 키링 월드 혜택이며 소개팅 선발과는 무관하다.
export { SHOP_ACC, SEASON_ACC } from './look.js';
export const CAT_FOOD_PRICE = 50;    // 동물 밥주기(강아지·고양이·펭귄·순록)
// 키링 월드에서 받는 포인트(웹사이트 방문 포인트와 별개, 회원만)
export const ENTRY_BONUS = 500;                     // 24시간 안의 첫 입장
export const ENTRY_BONUS_GAP_MS = 24 * 60 * 60 * 1000;
export const STAY_POINTS = 50;                      // 머문 시간 1시간마다
export const STAY_UNIT_MS = 60 * 60 * 1000;
export const STAY_TICK_MS = 5 * 60 * 1000;          // 화면이 5분마다 '아직 있어요'를 보낸다(자리 비움·다른 탭이어도 창이 열려 있으면 쌓임)
export const STAY_DAILY_MAX = 8;                    // 하루(한국 날짜) 최대 8번 = 400P
export const WISH_PRICE = 100;       // 분수대에 소원 던지기
export const WISH_MAX = 40;          // 소원 글자 수
// 인형뽑기(크리스마스 마켓 거리): 하루(한국 날짜) 1번 무료, 그다음은 한 판 CLAW_PRICE. 뽑힐 확률 CLAW_WIN, 인형은 '내 인형함'에 모인다
export const CLAW_PRICE = 100;
export const CLAW_WIN = 0.3;
export const DOLLS = [
  { id: 'puppy', name: '강아지 인형', color: '#d9a066' }, { id: 'kitty', name: '고양이 인형', color: '#f0a35a' },
  { id: 'penguin', name: '펭귄 인형', color: '#2b2f3a' }, { id: 'rudolph', name: '루돌프 인형', color: '#8a5a36' },
  { id: 'bunny', name: '토끼 인형', color: '#f6f2ef' }, { id: 'fox', name: '여우 인형', color: '#f3f1ec' },
  { id: 'bear', name: '곰 인형', color: '#a0703f' }, { id: 'snowman', name: '눈사람 인형', color: '#ffffff' },
];
export const DOLL_IDS = DOLLS.map((d) => d.id);
export const FOUNTAIN = { x: 0, z: 0, r: 5.5 };   // 분수대 중심(웹 좌표)과 소원 빌 수 있는 거리
// 크리스마스 테마: 소원을 담아 트리에 거는 장식 모양
export const WISH_ORNS = ['star', 'heart', 'bell', 'ball', 'snow', 'gift', 'light', 'sock', 'candy'];
