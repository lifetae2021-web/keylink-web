interface DiscountInput {
  basePrice: number;
  finalPrice: number;
  couponDiscount?: number;
}

// 신청 시점에 적용된 얼리버드 할인액 역산: 정가 - 쿠폰 - 실제 결제금액
// 가격 설정이 신청 이후 바뀐 경우 엉뚱한 금액이 문자에 나가지 않도록 얼리버드 단위(5,000/10,000원)일 때만 인정
export function getAppliedEarlyBird({ basePrice, finalPrice, couponDiscount = 0 }: DiscountInput): number {
  const diff = basePrice - couponDiscount - finalPrice;
  return diff === 5000 || diff === 10000 ? diff : 0;
}

// 입금 요청 문자의 금액 뒤에 붙는 할인 안내 문구 (얼리버드 / 쿠폰 / 동반할인)
export function buildDiscountSuffix(input: DiscountInput & { isGroup?: boolean }): string {
  const coupon = input.couponDiscount && input.couponDiscount > 0 ? input.couponDiscount : 0;
  const earlyBird = input.isGroup ? 0 : getAppliedEarlyBird(input);
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

  if (earlyBird > 0 && coupon > 0) return ` (얼리버드 할인 ${won(earlyBird)} + 할인쿠폰 ${won(coupon)} 적용)`;
  if (earlyBird > 0) return ` (얼리버드 할인 ${won(earlyBird)} 적용)`;
  if (coupon > 0) return ` (할인쿠폰 적용, ${won(coupon)} 할인)`;
  if (input.isGroup) return ' (동반할인 적용)';
  return '';
}
