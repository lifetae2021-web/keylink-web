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
export const KEY_TOTAL = KEY_SPOTS.length;
