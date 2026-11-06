import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { listBgm, addBgm, removeBgm, BGM_MAX_BYTES, BGM_TYPES } from '@/lib/plazaBgm';
import { THEMES } from '../../../../../../public/plaza/themes.js';

// 관리자: 키링 월드 배경음악 목록 · 올리기 · 켜고 끄기/테마/순서/이름 바꾸기 · 지우기
async function requireAdmin(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return { error: 'Unauthorized', status: 401 as const };
  const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
  const role = (await adminDb.collection('users').doc(uid).get()).data()?.role;
  if (role !== 'admin' && role !== 'super_admin') return { error: 'Admin only', status: 403 as const };
  return { uid };
}
const themeOk = (t: unknown) => t === 'all' || (typeof t === 'string' && Object.prototype.hasOwnProperty.call(THEMES, t));

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    return NextResponse.json({ tracks: await listBgm(), themes: Object.entries(THEMES).map(([id, t]) => ({ id, label: t.label })) });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// multipart: file, title, theme
export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const fd = await req.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
    if (file.size > BGM_MAX_BYTES) return NextResponse.json({ error: 'too_big' }, { status: 400 });
    const type = file.type || 'audio/mpeg';
    if (!BGM_TYPES.includes(type)) return NextResponse.json({ error: 'bad_type' }, { status: 400 });
    const theme = themeOk(fd.get('theme')) ? String(fd.get('theme')) : 'all';
    const title = String(fd.get('title') || file.name.replace(/\.[^.]+$/, '')).trim();
    const id = await addBgm(Buffer.from(await file.arrayBuffer()), type, title, theme);
    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

// { id, enabled?, theme?, title?, order? }
export async function PATCH(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const b = await req.json().catch(() => ({}));
    if (!b.id) return NextResponse.json({ error: 'missing' }, { status: 400 });
    const up: Record<string, unknown> = {};
    if (typeof b.enabled === 'boolean') up.enabled = b.enabled;
    if (themeOk(b.theme)) up.theme = b.theme;
    if (typeof b.title === 'string' && b.title.trim()) up.title = b.title.trim().slice(0, 40);
    if (typeof b.order === 'number' && Number.isFinite(b.order)) up.order = b.order;
    await adminDb.collection('plazaBgm').doc(String(b.id)).set(up, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing' }, { status: 400 });
    await removeBgm(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
