import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// 관리자: 광장 신고 목록 조회 / 처리 상태 변경
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
    const snap = await adminDb.collection('plazaReports').orderBy('createdAt', 'desc').limit(300).get();
    const reports = snap.docs.map((d) => {
      const x = d.data() as Record<string, any>;
      return {
        id: d.id, reporter: x.reporter, reporterNick: x.reporterNick || '', targetUid: x.targetUid || null,
        targetKey: x.targetKey || null, targetNick: x.targetNick || '', reason: x.reason, detail: x.detail || '',
        convId: x.convId || null, status: x.status || 'open', createdAt: x.createdAt?.toMillis?.() || null,
      };
    });
    return NextResponse.json({ reports });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const b = await req.json().catch(() => ({}));
    const status = b.status === 'resolved' ? 'resolved' : 'open';
    if (!b.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    await adminDb.collection('plazaReports').doc(String(b.id)).update({
      status, handledBy: gate.uid, handledAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
