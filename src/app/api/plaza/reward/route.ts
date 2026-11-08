import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { plazaEnter, plazaTick, RewardError } from '@/lib/plazaReward';
import { guestKeyOf, guestEnter } from '@/lib/plazaShop';

// 키링 월드 포인트 적립: { action: 'enter' } 입장(처음 한 번 입장 보너스) · { action: 'tick' } 머문 시간 신호
// 비회원(x-plaza-dev 헤더)은 첫 입장 보너스만 — 키링 월드 전용 지갑(plazaGuestWallets)
export async function POST(req: Request) {
  try {
    const h = req.headers.get('Authorization');
    if (!h?.startsWith('Bearer ')) {
      const gk = guestKeyOf(req.headers.get('x-plaza-dev'));
      if (!gk) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const b = await req.json().catch(() => ({}));
      if (b.action === 'enter') return NextResponse.json({ ok: true, ...(await guestEnter(gk)) });
      return NextResponse.json({ ok: true, guest: true, earned: 0 });
    }
    const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
    const b = await req.json().catch(() => ({}));
    if (b.action === 'enter') return NextResponse.json({ ok: true, ...(await plazaEnter(uid)) });
    if (b.action === 'tick') return NextResponse.json({ ok: true, ...(await plazaTick(uid)) });
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  } catch (e: unknown) {
    if (e instanceof RewardError) return NextResponse.json({ error: e.code }, { status: 403 });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
}
