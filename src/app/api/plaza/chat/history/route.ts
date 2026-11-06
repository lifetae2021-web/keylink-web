import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// 광장 1:1 영속 대화 — 내 대화 기록 조회
// convId = sort(나, 상대) 라서, 내가 낀 대화만 읽히게 구조적으로 보장된다.
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const convOf = (a: string, b: string) => [a, b].sort().join('__');

export async function GET(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;

    const url = new URL(req.url);
    const other = str(url.searchParams.get('with'), 128);
    const limit = Math.min(Math.max(+(url.searchParams.get('limit') || '100'), 1), 200);
    if (!other) return NextResponse.json({ error: 'missing_with' }, { status: 400 });

    const convId = convOf(me, other);
    const snap = await adminDb.collection('plazaChats').doc(convId)
      .collection('messages').orderBy('createdAt', 'asc').limitToLast(limit).get();

    const messages = snap.docs.map((d) => {
      const x = d.data() as { from?: string; by?: string; ev?: string; text?: string; cta?: string; createdAt?: { toMillis?: () => number } };
      return { id: d.id, from: x.from, text: x.text, at: x.createdAt?.toMillis?.() || null, mine: x.from === me, cta: x.cta || null, sys: x.from === 'sys', ev: x.ev || null, byMe: x.by === me }; // sys: 사진 교환 같은 안내 // cta: 키키(AI) 답의 '신청하러 가기' 버튼
    });
    return NextResponse.json({ messages });
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: m }, { status: 500 });
  }
}
