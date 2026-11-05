import { adminDb } from '@/lib/firebaseAdmin';
import { spendMemberPointsInTx } from '@/lib/points';
import { plazaKey } from '@/lib/plazaKey';
import { SHOP_ACC, SEASON_ACC, CAT_FOOD_PRICE, WISH_PRICE, WISH_MAX } from '../../public/plaza/shop.js';
import { getActiveTheme } from '@/lib/plazaTheme';
import { hasBadWord } from '../../public/plaza/badwords.js';
import { AFF_FEED, PET_IDS } from '../../public/plaza/pets.js';
import { feedAffInTx, petRef } from '@/lib/plazaPets';

// 키링 월드 상점: 고양이 밥주기 · 분수대 소원 · 꾸미기 구매 (회원만, 키링크 포인트 차감)
// 차감이 끝난 뒤에만 실시간 서버(워커 /admin/announce)로 모두에게 알린다 → 화면 조작으로 공짜로 퍼뜨릴 수 없음
const WORKER = process.env.PLAZA_WORKER_URL || 'https://keylink-plaza.keylink-plaza-cf.workers.dev';
const FEED_COOLDOWN_MS = 10_000;

export class ShopError extends Error { constructor(public code: string) { super(code); } }

async function announce(msg: Record<string, unknown>) {
  const secret = process.env.PLAZA_ADMIN_SECRET;
  if (!secret) return;
  try {
    await fetch(WORKER + '/admin/announce', { method: 'POST', headers: { 'content-type': 'application/json', 'x-plaza-secret': secret }, body: JSON.stringify({ msg }), cache: 'no-store' });
  } catch { /* 알림 실패해도 결제는 이미 끝남 — 본인 화면에는 바로 보여 준다 */ }
}

/** 회원 여부 + 키링 월드 닉네임 */
async function memberInfo(uid: string) {
  const [u, p] = await Promise.all([adminDb.doc(`users/${uid}`).get(), adminDb.doc(`plazaProfiles/${uid}`).get()]);
  const d = u.data();
  if (!u.exists || d?.isRegistered === false || d?.mergedTo) throw new ShopError('not_member');
  return { nick: String(p.data()?.nick || '회원'), points: Number(d?.points || 0) };
}

export async function shopState(uid: string) {
  const [u, k] = await Promise.all([adminDb.doc(`users/${uid}`).get(), adminDb.doc(`plazaKeys/${uid}`).get()]);
  return { points: Number(u.data()?.points || 0), owned: (k.data()?.unlocks || []) as string[] };
}

export async function buyItem(uid: string, item: string) {
  const price = (SHOP_ACC as Record<string, number>)[item];
  if (!price) throw new ShopError('bad_item');
  // 시즌 한정 꾸미기는 그 테마일 때만 판다(화면 조작으로 시즌 밖에 사지 못하게 서버가 확인)
  const season = (SEASON_ACC as Record<string, string>)[item];
  if (season && (await getActiveTheme()) !== season) throw new ShopError('season_over');
  await memberInfo(uid);
  await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.doc(`plazaKeys/${uid}`);
    const snap = await tx.get(ref);
    const unlocks: string[] = snap.data()?.unlocks || [];
    if (unlocks.includes(item)) throw new ShopError('owned');
    await spendMemberPointsInTx(tx, uid, price, `키링 월드 꾸미기 구매(${item})`, 'plaza_shop');
    tx.set(ref, { unlocks: [...unlocks, item], updatedAt: new Date() }, { merge: true });
  });
  return shopState(uid);
}

export async function feedCat(uid: string, animal?: string) {
  const me = await memberInfo(uid);
  const aid = animal && PET_IDS.includes(animal) ? animal : null;
  await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.doc(`plazaKeys/${uid}`);
    const snap = await tx.get(ref);
    const petSnap = aid ? await tx.get(petRef(uid)) : null;   // 읽기는 쓰기보다 먼저
    if (Date.now() - (snap.data()?.lastFeedAt || 0) < FEED_COOLDOWN_MS) throw new ShopError('cooldown');
    await spendMemberPointsInTx(tx, uid, CAT_FOOD_PRICE, '키링 월드 고양이 밥주기', 'plaza_shop');
    tx.set(ref, { lastFeedAt: Date.now() }, { merge: true });
    if (aid) feedAffInTx(tx, uid, petSnap?.data(), aid, AFF_FEED);
  });
  await announce({ t: 'feed', key: plazaKey(uid), nick: me.nick, aid });
  return shopState(uid);
}

export async function makeWish(uid: string, raw: unknown) {
  const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, WISH_MAX);
  if (!text) throw new ShopError('empty');
  if (hasBadWord(text)) throw new ShopError('bad_word');
  const me = await memberInfo(uid);
  await adminDb.runTransaction(async (tx) => {
    await spendMemberPointsInTx(tx, uid, WISH_PRICE, '키링 월드 분수대 소원', 'plaza_shop');
    tx.set(adminDb.collection('plazaWishes').doc(), { uid, nick: me.nick, text, createdAt: new Date() });   // 신고·관리용 기록
  });
  await announce({ t: 'wish', key: plazaKey(uid), nick: me.nick, text });
  return shopState(uid);
}
