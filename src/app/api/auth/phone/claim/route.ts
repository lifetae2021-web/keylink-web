import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { consumeVerificationToken, peekVerificationToken, PhoneVerificationError } from '@/lib/phoneVerification';
import { findExistingAccount } from '@/lib/accountMerge';
import { getRequestUser } from '@/lib/requestAuth';
import { adoptGuestApplications } from '@/lib/guestApplications';

/** 인증된 번호를 로그인한 본인 계정(비회원 계정 포함)에 기록한다. 다른 정식 회원이 쓰는 번호면 409. */
export async function POST(req: NextRequest) {
  try {
    const requester = await getRequestUser(req);
    if (!requester) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { token } = await req.json();
    const phone = await peekVerificationToken(String(token || ''));
    if (await findExistingAccount(phone, requester.uid)) {
      return NextResponse.json({ error: '이미 다른 계정에서 사용 중인 번호입니다.' }, { status: 409 });
    }

    await adminDb.runTransaction(async (tx) => {
      await consumeVerificationToken(tx, String(token), requester.uid);
      tx.set(adminDb.doc(`users/${requester.uid}`), { phone, verifiedPhone: phone, phoneVerifiedAt: new Date() }, { merge: true });
    });
    // 정식 회원이면: 같은 번호로 가입 전에 낸 비회원 신청서를 회원 계정으로 자동 이관(중복이면 비회원 쪽 취소)
    let adopted = { moved: 0, cancelled: 0 };
    if (!requester.isAnonymous) {
      try { adopted = await adoptGuestApplications(requester.uid, phone); } catch (e) { console.error('[Phone Claim] 비회원 신청서 이관', e); }
    }
    return NextResponse.json({ success: true, phone, adopted });
  } catch (error: any) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Phone Claim]', error);
    return NextResponse.json({ error: '휴대폰 번호 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
