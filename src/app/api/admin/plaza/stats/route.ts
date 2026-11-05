import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { adminDb } from '@/lib/firebaseAdmin';

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
    // 회원 접속 기록에 회원 이름(users/{uid}.name)을 붙인다 — 관리자 화면 전용
    if (r.ok && Array.isArray(j.visits)) {
      const uids = [...new Set(j.visits.map((v: { uid?: string | null }) => v.uid).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      for (let i = 0; i < uids.length; i += 100) {
        const snaps = await adminDb.getAll(...uids.slice(i, i + 100).map((u) => adminDb.doc(`users/${u}`)));
        for (const s of snaps) { const n = s.data()?.name; if (n) names[s.id] = String(n); }
      }
      j.visits = j.visits.map((v: { uid?: string | null }) => ({ ...v, name: v.uid ? names[v.uid] || null : null }));
    }
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ error: '실시간 서버에 연결하지 못했어요' }, { status: 502 });
  }
}
