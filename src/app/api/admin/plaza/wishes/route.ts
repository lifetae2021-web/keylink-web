import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// 관리자: 소원 목록 보기 · 부적절한 소원 내리기(트리에서 바로 떼어짐)
const WORKER = process.env.PLAZA_WORKER_URL || 'https://keylink-plaza.keylink-plaza-cf.workers.dev';

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
    const snap = await adminDb.collection('plazaWishes').orderBy('createdAt', 'desc').limit(200).get();
    const wishes = snap.docs.map((d) => ({
      id: d.id, nick: String(d.get('nick') || ''), text: String(d.get('text') || ''), theme: String(d.get('theme') || 'default'),
      orn: d.get('orn') || null, hidden: !!d.get('hidden'), createdAt: d.get('createdAt')?.toMillis?.() ?? null,
    }));
    return NextResponse.json({ wishes });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// ?id= 내리기 · ?id=&restore=1 되돌리기
export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const u = new URL(req.url); const id = u.searchParams.get('id'); const restore = u.searchParams.get('restore') === '1';
    if (!id) return NextResponse.json({ error: 'missing' }, { status: 400 });
    await adminDb.collection('plazaWishes').doc(id).set(restore ? { hidden: false } : { hidden: true, hiddenBy: gate.uid, hiddenAt: FieldValue.serverTimestamp() }, { merge: true });
    const secret = process.env.PLAZA_ADMIN_SECRET;
    if (secret && !restore) {
      try { await fetch(WORKER + '/admin/announce', { method: 'POST', headers: { 'content-type': 'application/json', 'x-plaza-secret': secret }, body: JSON.stringify({ msg: { t: 'wishhide', id } }), cache: 'no-store' }); } catch { /* 새로 들어오는 사람부터 안 보임 */ }
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
