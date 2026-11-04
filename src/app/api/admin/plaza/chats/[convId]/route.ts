import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// 관리자: 특정 1:1 대화의 전체 메시지 열람 (모더레이션)
async function requireAdmin(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
  const role = (await adminDb.collection('users').doc(uid).get()).data()?.role;
  if (role !== 'admin' && role !== 'super_admin') return { error: 'Admin only', status: 403 as const };
  return { uid };
}

export async function GET(req: Request, ctx: { params: Promise<{ convId: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { convId } = await ctx.params;
    const convRef = adminDb.collection('plazaChats').doc(convId);
    const conv = (await convRef.get()).data() || {};
    const url = new URL(req.url);
    const limit = Math.min(Math.max(+(url.searchParams.get('limit') || '500'), 1), 1000);

    const snap = await convRef.collection('messages').orderBy('createdAt', 'asc').limitToLast(limit).get();
    const messages = snap.docs.map((d) => {
      const x = d.data() as { from?: string; text?: string; createdAt?: { toMillis?: () => number } };
      return { id: d.id, from: x.from, text: x.text, at: x.createdAt?.toMillis?.() || null };
    });
    return NextResponse.json({
      convId,
      participants: (conv as any).participants || [],
      nicks: (conv as any).nicks || {},
      messages,
    });
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: m }, { status: 500 });
  }
}
