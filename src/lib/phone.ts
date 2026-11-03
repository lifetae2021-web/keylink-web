/** 휴대폰 번호 공통 유틸 (클라이언트/서버 공용). DB에는 '010-1234-5678' 형식으로 저장한다. */

export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 010으로 시작하는 11자리 휴대폰 번호만 허용 */
export function isValidMobile(val: string): boolean {
  return /^010\d{8}$/.test(val.replace(/\D/g, ''));
}
