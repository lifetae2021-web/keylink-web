import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { consumeVerificationToken, peekVerificationToken, PhoneVerificationError } from '@/lib/phoneVerification';
import { findExistingAccount, mergeAccountInto } from '@/lib/accountMerge';
import { getRequestUser } from '@/lib/requestAuth';

/**
 * 휴대폰 인증으로 찾은 기존 계정에 지금 로그인한 계정을 연결한다.
 * 지금 계정의 기록을 기존 계정으로 옮기고, 기존 계정으로 로그인할 수 있는 커스텀 토큰을 돌려준다.
 */
export async function POST(req: NextRequest) {
  try {
    const requester = await getRequestUser(req);
    if (!requester || requester.isAnonymous) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const current = (await adminDb.doc(`users/${requester.uid}`).get()).data();
    if (current?.role === 'admin' || current?.role === 'super_admin') {
      return NextResponse.json({ error: '관리자 계정은 자동으로 연결할 수 없습니다.' }, { status: 403 });
    }

    const { token } = await req.json();
    const phone = await peekVerificationToken(String(token || ''));
    const existing = await findExistingAccount(phone, requester.uid);
    if (!existing) return NextResponse.json({ error: '연결할 기존 계정을 찾을 수 없습니다.' }, { status: 404 });
    if (existing.isAdmin) {
      return NextResponse.json({ error: '관리자 계정은 자동으로 연결할 수 없습니다. 고객센터로 문의해 주세요.' }, { status: 403 });
    }

    await adminDb.runTransaction(tx => consumeVerificationToken(tx, String(token), requester.uid));
    const result = await mergeAccountInto(requester.uid, existing.uid, phone);
    const customToken = await adminAuth.createCustomToken(existing.uid);
    console.log(`[Link Account] ${requester.uid} → ${existing.uid}`, result);
    return NextResponse.json({ success: true, token: customToken, ...result });
  } catch (error: any) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Link Account]', error);
    return NextResponse.json({ error: error.message || '계정 연결 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
