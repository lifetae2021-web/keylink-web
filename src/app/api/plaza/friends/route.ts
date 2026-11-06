import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';

// 키링 월드 친구 목록(나만 보는 즐겨찾기 — 상대에게 알림이 가지 않는다). plazaFriends/{uid}.list[익명키] = { nick, at }
// 익명 키(plazaKey)로만 저장하므로 상대 uid를 알 필요가 없고, 접속 중인지는 화면이 같은 키를 가진 사람으로 확인한다.
const MAX = 100;
const keyOk = (k: unknown) => typeof k === 'string' && /^[0-9a-f]{16}$/.test(k);

async function uidOf(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { const d = await adminAuth.verifyIdToken(h.split('Bearer ')[1]); return d.firebase?.sign_in_provider === 'anonymous' ? null : d.uid; } catch { return null; }
}

export async function GET(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const list = ((await adminDb.doc(`plazaFriends/${uid}`).get()).data()?.list || {}) as Record<string, { nick?: string; at?: number }>;
  const friends = Object.entries(list).map(([key, v]) => ({ key, nick: String(v.nick || '친구'), at: v.at || 0 })).sort((a, b) => b.at - a.at);
  return NextResponse.json({ friends });
}

// { key, nick } 추가
export async function POST(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!keyOk(b.key)) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  const ref = adminDb.doc(`plazaFriends/${uid}`);
  const cur = ((await ref.get()).data()?.list || {}) as Record<string, unknown>;
  if (!(b.key in cur) && Object.keys(cur).length >= MAX) return NextResponse.json({ error: 'full' }, { status: 400 });
  const nick = String(b.nick ?? '').trim().slice(0, 12) || '친구';
  await ref.set({ list: { [b.key]: { nick, at: Date.now() } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}

// ?key= 삭제
export async function DELETE(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const key = new URL(req.url).searchParams.get('key');
  if (!keyOk(key)) return NextResponse.json({ error: 'bad_key' }, { status: 400 });
  await adminDb.doc(`plazaFriends/${uid}`).update(new FieldPath('list', key as string), FieldValue.delete()).catch(() => {});
  return NextResponse.json({ ok: true });
}
