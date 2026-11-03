import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCode, PhoneVerificationError } from '@/lib/phoneVerification';
import { getClientIp } from '@/lib/requestAuth';

/** 휴대폰 인증번호 문자 발송 */
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    const { devCode } = await sendVerificationCode(String(phone || ''), getClientIp(req));
    return NextResponse.json({ success: true, ...(devCode ? { devCode } : {}) });
  } catch (error: any) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Phone OTP Send]', error);
    return NextResponse.json({ error: '인증번호 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
