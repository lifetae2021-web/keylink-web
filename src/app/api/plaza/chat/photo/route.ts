import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { plazaKey } from '@/lib/plazaKey';

// 광장 1:1 대화 — 서로 합의하면 대표 사진(users.photos[0]) 한 장씩 교환
// 상태는 plazaChats/{convId}.photoSwap = { state: 'asked' | 'done', by(요청한 uid), at } (없으면 교환 전)
// 사진 주소(토큰 포함 URL)는 절대 내보내지 않고, 교환이 끝난 두 사람에게만 이 API가 이미지를 대신 보내 준다.
// 한 번 교환하면 계속 볼 수 있다(내리기 없음, 2026-11-07). 차단 관계면 요청·열람 모두 막는다.
// 광장에서 상대 캐릭터를 눌렀을 때는 uid 대신 광장 키(key)로 묻는다 — 내 대화방 중 교환을 마친 상대만 찾아 준다(uid는 내보내지 않음).
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const convOf = (a: string, b: string) => [a, b].sort().join('__');
type Swap = { state?: 'asked' | 'done'; by?: string };

async function me(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  return (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
}

async function firstPhoto(uid: string): Promise<string | null> {
  const d = (await adminDb.doc(`users/${uid}`).get()).data();
  const p = Array.isArray(d?.photos) ? d.photos.find((x: unknown) => typeof x === 'string' && x) : null;
  return p || null;
}

async function blockedBetween(a: string, b: string) {
  const [x, y] = await Promise.all([adminDb.doc(`plazaBlocks/${a}`).get(), adminDb.doc(`plazaBlocks/${b}`).get()]);
  return !!(x.data()?.keys?.[plazaKey(b)] || y.data()?.keys?.[plazaKey(a)]);
}

// 광장 키 → 사진을 교환한 상대 uid(없으면 null)
async function swappedByKey(uid: string, key: string): Promise<string | null> {
  if (!/^[0-9a-f]{16}$/.test(key)) return null;
  const snap = await adminDb.collection('plazaChats').where('participants', 'array-contains', uid).limit(200).get();
  for (const d of snap.docs) {
    if (d.data()?.photoSwap?.state !== 'done') continue;
    const other = (d.data().participants as string[] | undefined)?.find((p) => p !== uid);
    if (other && plazaKey(other) === key) return other;
  }
  return null;
}

function view(s: Swap, uid: string) {
  return { state: s.state || 'none', byMe: s.by === uid };
}

export async function GET(req: Request) {
  try {
    const uid = await me(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const key = str(url.searchParams.get('key'), 32);
    let other = str(url.searchParams.get('with'), 128);
    if (!other && key) {
      other = (await swappedByKey(uid, key)) || '';
      if (!other) return url.searchParams.get('img') === '1' ? NextResponse.json({ error: 'not_shared' }, { status: 403 }) : NextResponse.json({ state: 'none' });
      if (url.searchParams.get('img') !== '1') return NextResponse.json({ state: (await blockedBetween(uid, other)) ? 'none' : 'done' });
    }
    if (!other || other === uid || other === 'npc') return NextResponse.json({ error: 'bad_target' }, { status: 400 });
    const s: Swap = (await adminDb.doc(`plazaChats/${convOf(uid, other)}`).get()).data()?.photoSwap || {};

    if (url.searchParams.get('img') === '1') {
      if (s.state !== 'done' || await blockedBetween(uid, other)) return NextResponse.json({ error: 'not_shared' }, { status: 403 });
      const src = await firstPhoto(other);
      if (!src) return NextResponse.json({ error: 'no_photo' }, { status: 404 });
      let body: ArrayBuffer, type = 'image/jpeg';
      const m = src.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) { type = m[1]; const buf = Buffer.from(m[2], 'base64'); body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer; }
      else {
        // 저장소 다운로드 주소만 허용(다른 주소로 요청을 보내게 만드는 공격 방지)
        if (!/^https:\/\/firebasestorage\.googleapis\.com\//.test(src)) return NextResponse.json({ error: 'no_photo' }, { status: 404 });
        const r = await fetch(src);
        if (!r.ok) return NextResponse.json({ error: 'no_photo' }, { status: 404 });
        type = r.headers.get('content-type') || type; body = await r.arrayBuffer();
      }
      if (!type.startsWith('image/')) return NextResponse.json({ error: 'no_photo' }, { status: 404 });
      return new NextResponse(body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store' } });
    }

    const [meHas, themHas] = await Promise.all([firstPhoto(uid), firstPhoto(other)]);
    return NextResponse.json({ ...view(s, uid), meHas: !!meHas, themHas: !!themHas });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}

const SYS_TEXT: Record<string, string> = {
  ask: '사진 교환을 요청했어요',
  done: '사진 교환이 완료됐어요\n서로의 대표 사진 한 장을 볼 수 있어요',
  decline: '사진 교환 요청이 거절됐어요',
  cancel: '사진 교환 요청이 취소됐어요',
  hide: '사진 공개가 해제됐어요',   // 예전 기록 표시용(이제 내리기는 없음)
};

export async function POST(req: Request) {
  try {
    const uid = await me(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const other = str(b.with, 128), action = str(b.action, 10);
    if (!other || other === uid || other === 'npc') return NextResponse.json({ error: 'bad_target' }, { status: 400 });
    if (!['ask', 'accept', 'decline'].includes(action)) return NextResponse.json({ error: 'bad_action' }, { status: 400 });
    if (await blockedBetween(uid, other)) return NextResponse.json({ error: 'blocked' }, { status: 403 });
    if (action === 'ask' || action === 'accept') {
      const [meHas, themHas] = await Promise.all([firstPhoto(uid), firstPhoto(other)]);
      if (!meHas) return NextResponse.json({ error: 'no_my_photo' }, { status: 400 });
      if (!themHas) return NextResponse.json({ error: 'no_their_photo' }, { status: 400 });
    }

    const ref = adminDb.doc(`plazaChats/${convOf(uid, other)}`);
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // 대화를 나눈 적 있는 사이에서만(대화방이 있어야 함)
      if (!snap.exists) return { error: 'no_chat' as const };
      const s: Swap = snap.data()?.photoSwap || {};
      let next: Swap | null = s, ev = '';
      if (action === 'ask') {
        if (s.state === 'done') return { error: 'already' as const };
        if (s.state === 'asked' && s.by !== uid) { next = { state: 'done', by: s.by }; ev = 'done'; }   // 서로 동시에 요청하면 바로 교환
        else if (s.state === 'asked') return { error: 'already' as const };
        else { next = { state: 'asked', by: uid }; ev = 'ask'; }
      } else if (action === 'accept') {
        if (s.state !== 'asked' || s.by === uid) return { error: 'bad_state' as const };
        next = { state: 'done', by: s.by }; ev = 'done';
      } else {
        if (s.state !== 'asked') return { error: 'bad_state' as const };
        next = null; ev = s.by === uid ? 'cancel' : 'decline';
      }
      const now = FieldValue.serverTimestamp();
      tx.update(ref, { photoSwap: next ? { ...next, at: now } : FieldValue.delete() });
      tx.set(ref.collection('messages').doc(), { from: 'sys', by: uid, ev, text: SYS_TEXT[ev], createdAt: now });
      return { ev, swap: next || {} };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true, ev: result.ev, text: SYS_TEXT[result.ev], ...view(result.swap, uid) });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
