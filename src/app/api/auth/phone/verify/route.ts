import { NextRequest, NextResponse } from 'next/server';
import { checkVerificationCode, PhoneVerificationError } from '@/lib/phoneVerification';
import { findExistingAccount } from '@/lib/accountMerge';
import { getRequestUser } from '@/lib/requestAuth';

/**
 * 인증번호 확인 → 1회용 인증 토큰 발급.
 * 번호 소유가 확인된 뒤에만, 이 번호로 가입된 다른 계정이 있는지(가린 정보로) 알려준다.
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();
    const { phone: verifiedPhone, token } = await checkVerificationCode(String(phone || ''), String(code || ''));
    const requester = await getRequestUser(req);
    const existing = await findExistingAccount(verifiedPhone, requester?.uid);
    return NextResponse.json({
      success: true,
      token,
      phone: verifiedPhone,
      existing: existing && {
        maskedName: existing.maskedName,
        method: existing.method,
        maskedUsername: existing.maskedUsername,
        joinedAt: existing.joinedAt,
        canLink: !existing.isAdmin,
      },
    });
  } catch (error: any) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Phone OTP Verify]', error);
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
