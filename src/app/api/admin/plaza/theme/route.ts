import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getThemeSetting, clearThemeCache, THEME_DOC } from '@/lib/plazaTheme';
import { THEMES, sanitizeTheme } from '../../../../../../public/plaza/themes.js';

// 관리자: 키링 월드 테마 보기·바꾸기. 바꾸면 접속 중인 모든 방에 알려 새로고침 없이 바뀐다.
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
    const setting = await getThemeSetting();
    const themes = Object.entries(THEMES).map(([id, t]) => ({ id, label: t.label, desc: t.desc }));
    return NextResponse.json({ ...setting, themes });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// { theme, until: 'YYYY-MM-DD' | null } — until은 그날 서울 시간 자정이 지나면 기본으로 돌아간다
export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const b = await req.json().catch(() => ({}));
    const theme = sanitizeTheme(b.theme);
    let until: Timestamp | null = null;
    if (typeof b.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.until)) {
      until = Timestamp.fromMillis(new Date(b.until + 'T23:59:59+09:00').getTime());
    }
    await adminDb.doc(THEME_DOC).set({ theme, until, updatedBy: gate.uid, updatedAt: FieldValue.serverTimestamp() });
    clearThemeCache();
    // 접속 중인 사람들 화면도 바로 바꾸기
    const secret = process.env.PLAZA_ADMIN_SECRET;
    let live = false;
    if (secret) {
      try {
        const r = await fetch(WORKER + '/admin/announce', { method: 'POST', headers: { 'content-type': 'application/json', 'x-plaza-secret': secret }, body: JSON.stringify({ msg: { t: 'theme' } }), cache: 'no-store' });
        live = r.ok;
      } catch { /* 실시간 알림 실패해도 새로 들어오는 사람부터는 바뀐다 */ }
    }
    return NextResponse.json({ ok: true, theme, until: until?.toMillis() ?? null, live });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
