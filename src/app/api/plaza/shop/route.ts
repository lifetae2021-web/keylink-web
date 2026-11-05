import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { shopState, buyItem, feedCat, makeWish, ShopError } from '@/lib/plazaShop';

// 키링 월드 상점 — GET 내 포인트·보유 꾸미기 / POST { action: 'buy'|'feed'|'wish', item?, text? }
async function uidOf(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { const d = await adminAuth.verifyIdToken(h.split('Bearer ')[1]); return d.firebase?.sign_in_provider === 'anonymous' ? null : d.uid; } catch { return null; }
}
const MSG: Record<string, string> = {
  not_member: '포인트는 회원만 쓸 수 있어요', bad_item: '없는 상품이에요', owned: '이미 가지고 있어요', cooldown: '조금 있다가 다시 줄 수 있어요',
  empty: '소원을 적어 주세요', bad_word: '그 말은 소원으로 보낼 수 없어요', poor: '포인트가 부족해요',
};

export async function GET(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await shopState(uid));
}

export async function POST(req: Request) {
  const uid = await uidOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized', message: MSG.not_member }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const out = body.action === 'buy' ? await buyItem(uid, String(body.item || ''))
      : body.action === 'feed' ? await feedCat(uid, body.animal ? String(body.animal) : undefined)
      : body.action === 'wish' ? await makeWish(uid, body.text)
      : null;
    if (!out) return NextResponse.json({ error: 'bad_action' }, { status: 400 });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const code = e instanceof ShopError ? e.code : (e instanceof Error && e.message.includes('부족') ? 'poor' : 'error');
    if (code === 'error') console.error('[plaza shop]', e);
    return NextResponse.json({ error: code, message: MSG[code] || '잠시 후 다시 시도해 주세요' }, { status: code === 'error' ? 500 : 400 });
  }
}
