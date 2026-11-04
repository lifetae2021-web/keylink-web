import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// 관리자: 광장 1:1 대화 목록 (음란·범죄 예방 모더레이션)
// 최근 대화 순으로 참여자·닉네임·마지막 메시지를 돌려준다.
async function requireAdmin(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
  const role = (await adminDb.collection('users').doc(uid).get()).data()?.role;
  if (role !== 'admin' && role !== 'super_admin') return { error: 'Admin only', status: 403 as const };
  return { uid };
}

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const limit = Math.min(Math.max(+(url.searchParams.get('limit') || '100'), 1), 500);
    const snap = await adminDb.collection('plazaChats').orderBy('lastAt', 'desc').limit(limit).get();

    const chats = snap.docs.map((d) => {
      const x = d.data() as Record<string, any>;
      return {
        convId: d.id,
        participants: x.participants || [],
        nicks: x.nicks || {},
        lastMessage: x.lastMessage || '',
        lastFrom: x.lastFrom || '',
        lastAt: x.lastAt?.toMillis?.() || null,
      };
    });
    return NextResponse.json({ chats });
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: m }, { status: 500 });
  }
}
