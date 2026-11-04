import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// 관리자: 광장 입장 금지 / 해제 / 상태 조회 → Cloudflare 실시간 서버(/admin/*)로 전달
// 둘 사이는 비밀키(PLAZA_ADMIN_SECRET)로만 통한다. 대상은 tid('k:'+회원해시 / 'g:'+손님기기해시).
const WORKER = process.env.PLAZA_WORKER_URL || 'https://keylink-plaza.keylink-plaza-cf.workers.dev';

async function requireAdmin(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
  const role = (await adminDb.collection('users').doc(uid).get()).data()?.role;
  if (role !== 'admin' && role !== 'super_admin') return { error: 'Admin only', status: 403 as const };
  return { uid };
}

async function worker(path: string, body: unknown) {
  const secret = process.env.PLAZA_ADMIN_SECRET;
  if (!secret) return { status: 500, json: { error: 'PLAZA_ADMIN_SECRET 미설정' } };
  const r = await fetch(WORKER + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-plaza-secret': secret },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({ error: 'worker_error' })) };
}

const cleanTid = (v: unknown) => String(v ?? '').replace(/[^a-z0-9:]/gi, '').slice(0, 40);

// 입장 금지: { tid, hours } — hours 0 = 영구
export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const b = await req.json().catch(() => ({}));
    const tid = cleanTid(b.tid);
    if (!tid) return NextResponse.json({ error: 'missing_tid' }, { status: 400 });
    const hours = [24, 168, 0].includes(+b.hours) ? +b.hours : 24;
    const r = await worker('/admin/ban', { tid, hours });
    return NextResponse.json(r.json, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// 해제: ?tid=
export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const tid = cleanTid(new URL(req.url).searchParams.get('tid'));
    if (!tid) return NextResponse.json({ error: 'missing_tid' }, { status: 400 });
    const r = await worker('/admin/unban', { tid });
    return NextResponse.json(r.json, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// 상태 조회: { tids: [...] } → 각 대상의 입장 금지 해제 시각
export async function PUT(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const b = await req.json().catch(() => ({}));
    const tids = (Array.isArray(b.tids) ? b.tids : []).map(cleanTid).filter(Boolean).slice(0, 300);
    const r = await worker('/admin/status', { tids });
    return NextResponse.json(r.json, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
