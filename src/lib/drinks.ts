// 희망 음료 선택지와 규칙 — 신청서(/apply/fast) · 이벤트 상세 신청 · 마이페이지가 같이 쓴다
export const WARM = '따뜻한 음료';
// 메뉴에서 빠진 음료(예전 신청·회원정보에 남아 있으면 불러올 때 조용히 지운다 → 비면 '희망 음료를 선택해 주세요'로 다시 고르게 됨)
export const RETIRED_DRINKS = ['복숭아 아이스티'];
export const MAIN_DRINKS = ['아이스 아메리카노', '얼그레이', '페퍼민트', '카라멜 블랙티', '물'];
export const ICE_ONLY_DRINKS = ['아이스 아메리카노'];
export const DRINK_OPTIONS = [...MAIN_DRINKS, WARM];

// 저장 형식이 배열·"페퍼민트, 따뜻한 음료" 문자열 둘 다 있어서 배열로 맞추고, 빠진 음료는 지운다
export function parseDrinks(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',') : [];
  return raw.map((s) => s.trim()).filter((d) => d && !RETIRED_DRINKS.includes(d));
}

// 버튼을 눌렀을 때의 다음 선택: 메인 음료는 하나만, '따뜻한 음료'는 차에 덧붙이는 표시(아이스 음료와는 같이 못 고름)
export function toggleDrink(current: string[], d: string): string[] {
  if (MAIN_DRINKS.includes(d)) {
    if (current.includes(d)) return current.filter((v) => v !== d);
    const next = [...current.filter((v) => !MAIN_DRINKS.includes(v)), d];
    return ICE_ONLY_DRINKS.includes(d) ? next.filter((v) => v !== WARM) : next;
  }
  if (d === WARM) return current.includes(d) ? current.filter((v) => v !== d) : [...current, d];
  return current;
}

export const isWarmDisabled = (current: string[]) => current.some((v) => ICE_ONLY_DRINKS.includes(v));

// 제출 전 검사: 문제가 없으면 null
export function drinkError(drinks: string[]): string | null {
  const hasMain = drinks.some((d) => MAIN_DRINKS.includes(d));
  if (drinks.length === 0) return '희망 음료를 선택해 주세요.';
  if (!hasMain && drinks.includes(WARM)) return '따뜻하게 받을 차를 하나 골라 주세요.';
  return null;
}
