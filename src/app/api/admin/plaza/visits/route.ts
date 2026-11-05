import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

// 관리자: 광장 접속 기록 지우기(운영 점검용 테스트 접속 정리) → Cloudflare 실시간 서버 /admin/visits/delete
const WORKER = process.env.PLAZA_WORKER_URL || 'https://keylink-plaza.keylink-plaza-cf.workers.dev';

export async function DELETE(req: Request) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const secret = process.env.PLAZA_ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: 'PLAZA_ADMIN_SECRET 미설정' }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((x: number) => Number.isInteger(x) && x > 0).slice(0, 200);
  if (!ids.length) return NextResponse.json({ error: 'ids_required' }, { status: 400 });
  try {
    const r = await fetch(WORKER + '/admin/visits/delete', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-plaza-secret': secret }, body: JSON.stringify({ ids }), cache: 'no-store',
    });
    return NextResponse.json(await r.json().catch(() => ({ error: 'worker_error' })), { status: r.status });
  } catch {
    return NextResponse.json({ error: '실시간 서버에 연결하지 못했어요' }, { status: 502 });
  }
}
