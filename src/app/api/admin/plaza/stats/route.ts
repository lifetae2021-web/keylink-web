import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

// 관리자: 광장 현황(지금 접속·동시접속 추이·일별 요약·접속 기록) → Cloudflare 실시간 서버 /admin/stats
// 둘 사이는 비밀키(PLAZA_ADMIN_SECRET)로만 통한다.
const WORKER = process.env.PLAZA_WORKER_URL || 'https://keylink-plaza.keylink-plaza-cf.workers.dev';

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const secret = process.env.PLAZA_ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: 'PLAZA_ADMIN_SECRET 미설정' }, { status: 500 });

  const url = new URL(req.url);
  const type = ['member', 'guest'].includes(url.searchParams.get('type') || '') ? url.searchParams.get('type') : 'all';
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 20);
  try {
    const r = await fetch(WORKER + '/admin/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-plaza-secret': secret },
      body: JSON.stringify({ type, q, limit: 300 }),
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({ error: 'worker_error' }));
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ error: '실시간 서버에 연결하지 못했어요' }, { status: 502 });
  }
}
