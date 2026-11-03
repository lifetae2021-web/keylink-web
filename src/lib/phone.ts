/** 휴대폰 번호 공통 유틸 (클라이언트/서버 공용). DB에는 '010-1234-5678' 형식으로 저장한다. */

export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 010으로 시작하는 11자리 휴대폰 번호만 허용 (뻔한 가짜 번호는 문자 발송 전에 거른다) */
export function isValidMobile(val: string): boolean {
  const digits = val.replace(/\D/g, '');
  return /^010\d{8}$/.test(digits) && !isObviouslyFake(digits.slice(3));
}

/** 010 뒤 8자리가 같은 숫자 반복(0000-0000), 연속 숫자(1234-5678, 8765-4321)이거나 가운데가 0000인 번호 */
function isObviouslyFake(rest: string): boolean {
  if (/^(\d)\1{7}$/.test(rest) || rest.startsWith('0000')) return true;
  const steps = new Set(Array.from(rest.slice(1), (c, i) => Number(c) - Number(rest[i])));
  return steps.size === 1 && (steps.has(1) || steps.has(-1));
}
