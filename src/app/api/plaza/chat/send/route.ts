import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// 광장 1:1 영속 대화 — 메시지 저장
// 대화방 id = 두 회원 uid를 정렬해 이은 값(convId). 참여자 본인만 쓸 수 있고, 저장은 서버만.
// 관리자는 /api/admin/plaza/chats 로 열람(음란·범죄 예방 모더레이션).
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const convOf = (a: string, b: string) => [a, b].sort().join('__');

export async function POST(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;

    const b = await req.json().catch(() => ({}));
    const toUid = str(b.toUid, 128);
    const text = str(b.text, 1000);
    const myNick = str(b.myNick, 12);
    const toNick = str(b.toNick, 12);
    if (!toUid || toUid === me) return NextResponse.json({ error: 'bad_target' }, { status: 400 });
    if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });

    const convId = convOf(me, toUid);
    const convRef = adminDb.collection('plazaChats').doc(convId);
    const msgRef = convRef.collection('messages').doc();
    const now = FieldValue.serverTimestamp();

    const nicks: Record<string, string> = {};
    if (myNick) nicks[me] = myNick;
    if (toNick) nicks[toUid] = toNick;

    const existed = (await convRef.get()).exists;
    await msgRef.set({ from: me, text, createdAt: now });
    await convRef.set({
      participants: [me, toUid].sort(),
      nicks,
      lastMessage: text,
      lastFrom: me,
      lastAt: now,
      updatedAt: now,
      ...(existed ? {} : { createdAt: now }),
    }, { merge: true });

    return NextResponse.json({ ok: true, id: msgRef.id });
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: m }, { status: 500 });
  }
}
