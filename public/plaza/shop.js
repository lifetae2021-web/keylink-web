// 키링 월드에서 포인트 쓰는 곳(가격 P, 1P = 1원) — 웹 화면과 서버(/api/plaza/shop)가 같이 쓴다.
// 포인트는 회원만 쓸 수 있고, 차감은 서버에서만 한다. 키링 월드 혜택이며 소개팅 선발과는 무관하다.
export { SHOP_ACC } from './look.js';
export const CAT_FOOD_PRICE = 100;   // 광장 고양이 밥주기
export const WISH_PRICE = 100;       // 분수대에 소원 던지기
export const WISH_MAX = 40;          // 소원 글자 수
export const FOUNTAIN = { x: 0, z: 0, r: 5.5 };   // 분수대 중심(웹 좌표)과 소원 빌 수 있는 거리
