import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';

// 광장 차단 목록 — plazaBlocks/{내 uid}.keys = { [상대 익명키]: { nick, at } }
// 상대는 익명 키로만 저장해 uid가 드러나지 않는다. 닉네임이 바뀌어도 차단이 유지된다.
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

async function me(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  return (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
}

export async function GET(req: Request) {
  try {
    const uid = await me(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const snap = await adminDb.collection('plazaBlocks').doc(uid).get();
    const keys = (snap.data()?.keys || {}) as Record<string, { nick?: string; at?: number }>;
    return NextResponse.json({ blocks: Object.entries(keys).map(([key, v]) => ({ key, nick: v.nick || '', at: v.at || null })) });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const uid = await me(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const key = str(b.key, 32).replace(/[^a-f0-9]/g, '');
    if (!key) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
    await adminDb.collection('plazaBlocks').doc(uid).set(
      { keys: { [key]: { nick: str(b.nick, 12), at: Date.now() } } },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const uid = await me(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const key = str(new URL(req.url).searchParams.get('key'), 32).replace(/[^a-f0-9]/g, '');
    if (!key) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
    await adminDb.collection('plazaBlocks').doc(uid).update(new FieldPath('keys', key), FieldValue.delete()).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
