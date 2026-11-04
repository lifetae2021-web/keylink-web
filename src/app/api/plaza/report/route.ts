import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// 광장 신고 접수 — plazaReports 에 저장, 관리자가 /admin/plaza-reports 에서 확인.
// 1:1 대화 상대를 신고하면 그 대화(convId)를 같이 연결해 관리자가 바로 열람할 수 있게 한다.
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const REASONS = ['욕설·비하', '음란·성희롱', '스팸·광고', '사기·금전요구', '기타'];

export async function POST(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reporter = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;

    const b = await req.json().catch(() => ({}));
    const reason = REASONS.includes(b.reason) ? b.reason : '기타';
    const targetKey = str(b.targetKey, 32).replace(/[^a-f0-9]/g, '') || null;
    let targetUid = str(b.targetUid, 128) || null;
    const targetNick = str(b.targetNick, 12);
    const detail = str(b.detail, 500);
    if (!targetKey && !targetUid) return NextResponse.json({ error: 'no_target' }, { status: 400 });
    if (targetUid === reporter) return NextResponse.json({ error: 'self' }, { status: 400 });

    // 익명 키만 있으면 광장 프로필에서 실제 회원을 찾아 둔다(관리자 확인용)
    if (!targetUid && targetKey) {
      const q = await adminDb.collection('plazaProfiles').where('key', '==', targetKey).limit(1).get();
      if (!q.empty) targetUid = q.docs[0].id;
    }
    const convId = targetUid ? [reporter, targetUid].sort().join('__') : null;
    const reporterNick = (await adminDb.collection('plazaProfiles').doc(reporter).get()).data()?.nick || '';

    const ref = await adminDb.collection('plazaReports').add({
      reporter, reporterNick, targetUid, targetKey, targetNick, reason, detail, convId,
      status: 'open', createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
