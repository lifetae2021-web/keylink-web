import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { rateLimitOr429, clientIp } from '@/lib/rateLimit';
import { CONSENT_VERSION, consentKey } from '@/lib/plazaConsent';

// 키링 월드 입장 동의 저장 — 필수 3개(만 19세·이용 수칙·개인정보)는 모두 true여야 한다. 프로필 공개(profileShare)는 선택.
// 회원은 로그인 토큰, 비회원은 광장 기기 id로 기록한다(동의 증빙).
export async function POST(req: Request) {
  try {
    const limited = await rateLimitOr429([['plaza-consent-ip', clientIp(req), 30, 3600000]]);
    if (limited) return limited;

    const b = await req.json().catch(() => ({}));
    let uid: string | null = null;
    const h = req.headers.get('Authorization');
    if (h?.startsWith('Bearer ')) {
      try { uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid; } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    }
    const key = consentKey({ uid, dev: b.dev });
    if (!key) return NextResponse.json({ error: 'bad_identity' }, { status: 400 });
    if (!(b.age === true && b.rules === true && b.privacy === true)) return NextResponse.json({ error: 'required_missing' }, { status: 400 });

    const ref = adminDb.collection('plazaConsents').doc(key);
    const existed = (await ref.get()).exists;
    await ref.set({
      version: CONSENT_VERSION,
      age: true, rules: true, privacy: true,
      profileShare: b.profileShare === true,
      profileShareAt: b.profileShare === true ? FieldValue.serverTimestamp() : null,
      member: !!uid,
      agreedAt: FieldValue.serverTimestamp(),
      ...(existed ? {} : { firstAgreedAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return NextResponse.json({ ok: true, version: CONSENT_VERSION });
  } catch (e: unknown) {
    console.error('[plaza consent]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
