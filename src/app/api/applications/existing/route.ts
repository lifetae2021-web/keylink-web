import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getRequestUser } from '@/lib/requestAuth';
import { formatPhone, isValidMobile } from '@/lib/phone';

const ACTIVE = ['pending', 'applied', 'selected', 'confirmed'];
const PROFILE_FIELDS = ['name', 'gender', 'birthDate', 'job', 'residence'] as const;

/**
 * 빠른 신청 중복 확인 (전화번호 기준, 로그인 필수 — 비회원 익명 로그인 포함).
 * 기수별로 이 번호의 진행 중 신청서가 있는지 알려주고, 다른 계정(예전 비회원 등)의 신청서는
 * 요청자 계정에 문자 인증된 번호(verifiedPhone)가 같을 때만 요청자 계정으로 옮긴다.
 * 결과: 'none'(없음) | 'mine'(내 신청서) | 'transferred'(내 계정으로 옮김) | 'taken'(다른 계정 것, 옮기지 않음)
 */
export async function POST(req: NextRequest) {
  try {
    const requester = await getRequestUser(req);
    if (!requester) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { sessionIds, phone: rawPhone, profile = {} } = await req.json();
    if (!Array.isArray(sessionIds) || sessionIds.length === 0 || sessionIds.length > 20 || !isValidMobile(String(rawPhone || ''))) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }
    const phone = formatPhone(String(rawPhone));
    const verifiedPhone = (await adminDb.doc(`users/${requester.uid}`).get()).data()?.verifiedPhone;
    const canTransfer = verifiedPhone === phone;

    const patch: Record<string, unknown> = { userId: requester.uid, isGuestApply: false, phone, updatedAt: new Date() };
    for (const f of PROFILE_FIELDS) if (typeof profile[f] === 'string') patch[f] = profile[f];

    const results: Record<string, 'none' | 'mine' | 'transferred' | 'taken'> = {};
    for (const sessionId of sessionIds.map(String)) {
      const snap = await adminDb.collection('applications').where('phone', '==', phone).where('sessionId', '==', sessionId).get();
      const active = snap.docs.find(d => ACTIVE.includes(d.data().status));
      if (!active) { results[sessionId] = 'none'; continue; }
      if (active.data().userId === requester.uid) { results[sessionId] = 'mine'; continue; }
      if (canTransfer && !requester.isAnonymous) {
        await active.ref.update(patch);
        results[sessionId] = 'transferred';
      } else {
        results[sessionId] = 'taken';
      }
    }
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('[Existing Applications]', error);
    return NextResponse.json({ error: '신청 내역 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
