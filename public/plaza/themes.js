// 키링 월드 테마(웹·Next 서버가 함께 쓰는 목록)
// 테마는 지도 전체를 바꾸거나(map, Blender의 별도 장면에서 내보냄) 기본 지도 위에 장식만 덧씌운다(file).
// 관리자 화면(키링 월드 > 테마)에서 고르면 plazaConfig/theme에 저장되고, 접속 중인 사람에게도 바로 바뀐다.
export const THEMES = {
  // map: 지도 전체를 바꾸는 테마(없으면 기본 village.glb) · file: 지도 위에 덧씌우는 장식 · night: 늘 저녁~밤 · wishPlace: 소원을 거는 곳 이름
  default: { label: '기본', desc: '사계절 하늘섬 광장', map: null, file: null, wishPlace: '분수대' },
  xmas: { label: '크리스마스', desc: '설산 속 키링 겨울 마을 · 소원 트리 · 얼음 호수 · 마켓 거리', map: '/plaza/themes/xmas_map.glb', file: null, snow: true, night: true, wishPlace: '소원 트리' },
};
export const DEFAULT_THEME = 'default';
export const sanitizeTheme = (t) => (Object.prototype.hasOwnProperty.call(THEMES, t) ? t : DEFAULT_THEME);
