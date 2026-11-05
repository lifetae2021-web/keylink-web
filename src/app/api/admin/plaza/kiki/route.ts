import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { NPC_ID, clearNpcFaqCache } from '@/lib/plazaNpc';

// 관리자: 키키가 답하지 못해 운영진에게 넘긴 질문(plazaNpcQuestions)과 키키에게 알려 준 답(plazaNpcFaq)
// - 답하기: 키키 말로 그 사용자의 대화방에 답을 전하고, teach면 FAQ에 넣어 다음부터 키키가 직접 답한다
async function requireAdmin(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
  const role = (await adminDb.collection('users').doc(uid).get()).data()?.role;
  if (role !== 'admin' && role !== 'super_admin') return { error: 'Admin only', status: 403 as const };
  return { uid };
}
const ms = (v: unknown) => (v as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const [qs, fs] = await Promise.all([
      adminDb.collection('plazaNpcQuestions').orderBy('createdAt', 'desc').limit(300).get(),
      adminDb.collection('plazaNpcFaq').orderBy('createdAt', 'desc').limit(100).get(),
    ]);
    const questions = qs.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id, nick: x.nick || null, guest: !!x.guest, summary: x.summary || '', question: x.question || '',
        kikiReply: x.kikiReply || '', context: Array.isArray(x.context) ? x.context : [], status: x.status || 'open',
        answer: x.answer || '', taught: !!x.faqId, createdAt: ms(x.createdAt), answeredAt: ms(x.answeredAt),
      };
    });
    const faq = fs.docs.map((d) => { const x = d.data(); return { id: d.id, q: x.q || '', a: x.a || '', createdAt: ms(x.createdAt) }; });
    return NextResponse.json({ questions, faq });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// 답하기 { id, answer, teach, q? } · FAQ 직접 추가 { faq: { q, a } }
export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const b = await req.json().catch(() => ({}));

    if (b.faq) {
      const q = str(b.faq.q, 200), a = str(b.faq.a, 600);
      if (!q || !a) return NextResponse.json({ error: 'empty' }, { status: 400 });
      const ref = await adminDb.collection('plazaNpcFaq').add({ q, a, by: gate.uid, createdAt: FieldValue.serverTimestamp() });
      clearNpcFaqCache();
      return NextResponse.json({ ok: true, id: ref.id });
    }

    const answer = str(b.answer, 600);
    if (!b.id || !answer) return NextResponse.json({ error: 'empty' }, { status: 400 });
    const qRef = adminDb.collection('plazaNpcQuestions').doc(String(b.id));
    const qd = (await qRef.get()).data();
    if (!qd) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // 키키가 그 사용자 대화방에 답을 전한다(다음에 키키 창을 열면 보임, 키키 문맥에도 들어감)
    let delivered = false;
    if (qd.convId && qd.status !== 'answered') {
      const convRef = adminDb.collection('plazaChats').doc(String(qd.convId));
      if ((await convRef.get()).exists) {
        const text = `지난번에 물어보신 거, 운영진한테 물어보고 왔어요!\n${answer}`;
        const now = FieldValue.serverTimestamp();
        await convRef.collection('messages').add({ from: NPC_ID, text, createdAt: now, fromAdmin: gate.uid });
        await convRef.set({ lastMessage: text, lastFrom: NPC_ID, lastAt: now, updatedAt: now, npcUnread: true }, { merge: true });
        delivered = true;
      }
    }
    let faqId: string | null = qd.faqId || null;
    if (b.teach && !faqId) {
      const q = str(b.q, 200) || str(qd.summary, 200) || str(qd.question, 200);
      faqId = (await adminDb.collection('plazaNpcFaq').add({ q, a: answer, by: gate.uid, fromQuestion: qRef.id, createdAt: FieldValue.serverTimestamp() })).id;
      clearNpcFaqCache();
    }
    await qRef.set({ status: 'answered', answer, answeredBy: gate.uid, answeredAt: FieldValue.serverTimestamp(), ...(faqId ? { faqId } : {}) }, { merge: true });
    return NextResponse.json({ ok: true, delivered, faqId });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// 넘기기(답 없이 닫기) ?id= · FAQ 지우기 ?faq=
export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const u = new URL(req.url);
    const faq = u.searchParams.get('faq'), id = u.searchParams.get('id');
    if (faq) { await adminDb.collection('plazaNpcFaq').doc(faq).delete(); clearNpcFaqCache(); return NextResponse.json({ ok: true }); }
    if (id) { await adminDb.collection('plazaNpcQuestions').doc(id).set({ status: 'dismissed', answeredBy: gate.uid, answeredAt: FieldValue.serverTimestamp() }, { merge: true }); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: 'missing' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
