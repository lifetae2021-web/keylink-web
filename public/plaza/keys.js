// 키링 월드 황금 열쇠 자리(웹 좌표: x, y(높이), z) — 웹 화면과 실시간 서버(워커)가 같이 쓴다.
// 원본은 Blender의 KEY_* 표시점(VILLAGE_jump). Blender 좌표 (bx, by, bz) → 웹 (bx, bz, -by)
// 서버는 회원이 실제로 이 자리 가까이 있을 때만 주운 것으로 인정한다(보상 조작 방지).
export const KEY_SPOTS = [
  { id: 'top', x: 10.3, y: 6.0, z: -23.2 },      // 점프 코스 꼭대기
  { id: 'picnic', x: -19.5, y: 0.1, z: -22.5 },  // 피크닉 담요
  { id: 'garden', x: -26.0, y: 0, z: -1.6 },     // 블록 정원
  { id: 'arcade', x: -3.2, y: 0, z: -29.2 },     // 도트 골목 오락기 뒤
  { id: 'cafe', x: 3.8, y: 0, z: 25.6 },         // 카페 커피 수레 옆
  { id: 'flowers', x: 29.0, y: 0, z: -0.6 },     // 그림책 꽃길 끝
  { id: 'stargaze', x: 19.5, y: 0.12, z: 22.5 }, // 별 보는 데크
  { id: 'taxi', x: 16.6, y: 0, z: 5.6 },         // 택시 정류장
];
// 크리스마스 테마 선물 찾기(겨울 마을 맵) — 원본은 Blender KL_Xmas의 KEY_g_* 표시점(plaza-blender/xmas_gift_spots.py가 이 목록으로 만듦)
export const GIFT_SPOTS = [
  { id: 'g_lake', x: 8.0, y: 0, z: -26.5 },      // 얼음 호수 건너편
  { id: 'g_shore', x: -12.5, y: 0, z: -19.0 },   // 호숫가 서쪽
  { id: 'g_stall', x: 23.5, y: 0, z: -7.2 },     // 마켓 노점 뒤
  { id: 'g_street', x: 30.0, y: 0, z: 0.0 },     // 마켓 거리 끝
  { id: 'g_cabin', x: -26.0, y: 0, z: -8.0 },    // 통나무집 뒤
  { id: 'g_snowman', x: -24.0, y: 0, z: 13.5 },  // 눈사람 옆
  { id: 'g_arch', x: 4.2, y: 0, z: 30.5 },       // 마을 입구 아치 뒤
  { id: 'g_forest', x: 20.0, y: 0, z: 20.0 },    // 남동쪽 소나무 숲
];
// 테마별 찾을 거리: 기본은 황금 열쇠, 크리스마스는 선물 상자(보상 규칙은 같다)
export const KEY_SETS = { default: KEY_SPOTS, xmas: GIFT_SPOTS };
export const spotsFor = (theme) => KEY_SETS[theme] || KEY_SPOTS;
export const findSpot = (id) => KEY_SPOTS.find((s) => s.id === id) || GIFT_SPOTS.find((s) => s.id === id) || null;
export const setOfSpot = (id) => (GIFT_SPOTS.some((s) => s.id === id) ? GIFT_SPOTS : KEY_SPOTS);
export const KEY_TOTAL = KEY_SPOTS.length;
