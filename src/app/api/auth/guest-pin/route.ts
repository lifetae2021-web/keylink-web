import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { rateLimitOr429 } from '@/lib/rateLimit';
import { hashGuestPw } from '@/lib/guestPassword';

// 비회원 비밀번호(PIN) 설정 — 빠른 신청 직후 본인(익명 로그인 상태)만 호출.
// pin 이 없으면 전화번호 끝 4자리. 서버에서 해시로만 저장하고 평문(guestPw)은 지운다.
export async function POST(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;

    const limited = await rateLimitOr429([['guest-pin-uid', uid, 10, 3600000]]);
    if (limited) return limited;

    const ref = adminDb.collection('users').doc(uid);
    const data = (await ref.get()).data();
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (data.isRegistered !== false) return NextResponse.json({ error: 'not_guest' }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    let pin = b.pin == null || b.pin === '' ? '' : String(b.pin);
    if (pin && !/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'bad_pin' }, { status: 400 });
    if (!pin) pin = String(data.phone || '').replace(/\D/g, '').slice(-4);
    if (pin.length !== 4) return NextResponse.json({ error: 'no_phone' }, { status: 400 });

    await ref.update({ guestPwHash: await hashGuestPw(pin), guestPw: FieldValue.delete() });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[guest-pin]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
