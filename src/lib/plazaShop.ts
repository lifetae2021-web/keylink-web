import { adminDb } from '@/lib/firebaseAdmin';
import { spendMemberPointsInTx } from '@/lib/points';
import { plazaKey } from '@/lib/plazaKey';
import { SHOP_ACC, SEASON_ACC, CAT_FOOD_PRICE, WISH_PRICE, WISH_MAX, WISH_ORNS, ENTRY_BONUS, ENTRY_BONUS_GAP_MS } from '../../public/plaza/shop.js';
import crypto from 'crypto';
import { getActiveTheme } from '@/lib/plazaTheme';
import { hasBadWord, isReservedNick } from '../../public/plaza/badwords.js';
import { AFF_FEED, PET_IDS, FEED_ONLY_IDS } from '../../public/plaza/pets.js';
import { feedAffInTx, petRef } from '@/lib/plazaPets';

// 키링 월드 상점: 동물 밥주기 · 분수대 소원 · 꾸미기 구매 (회원만, 키링크 포인트 차감)
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
  const aid = animal && PET_IDS.includes(animal) ? animal : null;   // 호감이 오르는 동물
  const fid = !aid && animal && FEED_ONLY_IDS.includes(animal) ? animal : null;   // 밥만 주는 동물(펭귄·순록)
  await adminDb.runTransaction(async (tx) => {
    const ref = adminDb.doc(`plazaKeys/${uid}`);
    const snap = await tx.get(ref);
    const petSnap = aid ? await tx.get(petRef(uid)) : null;   // 읽기는 쓰기보다 먼저
    if (Date.now() - (snap.data()?.lastFeedAt || 0) < FEED_COOLDOWN_MS) throw new ShopError('cooldown');
    await spendMemberPointsInTx(tx, uid, CAT_FOOD_PRICE, '키링 월드 동물 밥주기', 'plaza_shop');
    tx.set(ref, { lastFeedAt: Date.now() }, { merge: true });
    if (aid) feedAffInTx(tx, uid, petSnap?.data(), aid, AFF_FEED);
  });
  await announce({ t: 'feed', key: plazaKey(uid), nick: me.nick, aid: aid || fid });
  return shopState(uid);
}

export async function makeWish(uid: string, raw: unknown, ornRaw?: unknown) {
  const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, WISH_MAX);
  if (!text) throw new ShopError('empty');
  if (hasBadWord(text)) throw new ShopError('bad_word');
  const me = await memberInfo(uid);
  // 크리스마스 테마에서는 고른 장식에 담겨 소원 트리에 계속 걸린다(그 밖의 테마는 분수대 위에 잠깐 떠오름)
  const theme = await getActiveTheme();
  const orn = theme === 'xmas' ? (WISH_ORNS.includes(String(ornRaw)) ? String(ornRaw) : 'star') : null;
  const ref = adminDb.collection('plazaWishes').doc();
  await adminDb.runTransaction(async (tx) => {
    await spendMemberPointsInTx(tx, uid, WISH_PRICE, theme === 'xmas' ? '키링 월드 소원 트리' : '키링 월드 분수대 소원', 'plaza_shop');
    tx.set(ref, { uid, nick: me.nick, text, theme, ...(orn ? { orn } : {}), createdAt: new Date() });   // 트리 장식 표시·신고·관리용 기록
  });
  await announce({ t: 'wish', key: plazaKey(uid), nick: me.nick, text, id: ref.id, orn, theme });
  return shopState(uid);
}


// ── 비회원 포인트(키링 월드 전용) ──
// 비회원은 로그인이 없어 기기 번호(kl_dev)로 구분하고, 지갑은 plazaGuestWallets/{guestKey}에 따로 둔다.
// 키링크 회원 포인트(users.points)와 섞이지 않고 웹사이트·신청 할인에는 못 쓴다. 호감·반려동물은 회원 전용이라 밥만 준다.
// guestKey = 실시간 서버(워커)의 gkey와 같은 방식(sha256('kl-guest:'+dev) 앞 16자리) → 워커가 산 꾸미기를 확인할 수 있다.
// TODO(사용자와 상의 후): 기기 번호를 바꾸면 다시 받을 수 있어 악용 제한이 필요 — "제한은 차차" (2026-11-06)
export function guestKeyOf(dev: unknown): string | null {
  const d = String(dev ?? '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(d)) return null;
  return crypto.createHash('sha256').update('kl-guest:' + d).digest('hex').slice(0, 16);
}
const guestRef = (gk: string) => adminDb.doc(`plazaGuestWallets/${gk}`);

export async function guestState(gk: string) {
  const d = (await guestRef(gk).get()).data() || {};
  return { points: Number(d.points || 0), owned: (d.unlocks || []) as string[], guest: true };
}

/** 24시간 안의 첫 입장 보너스(비회원) */
export async function guestEnter(gk: string) {
  const ref = guestRef(gk), now = Date.now();
  const bonus = await adminDb.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data() || {};
    if (now - Number(d.entryBonusAt || 0) < ENTRY_BONUS_GAP_MS) return 0;
    tx.set(ref, { points: Number(d.points || 0) + ENTRY_BONUS, entryBonusAt: now, lastSeenAt: now, ...(d.createdAt ? {} : { createdAt: now }) }, { merge: true });
    return ENTRY_BONUS;
  });
  return { bonus, ...(await guestState(gk)) };
}

async function guestSpend(gk: string, price: number, extra: (d: FirebaseFirestore.DocumentData) => Record<string, unknown>) {
  const ref = guestRef(gk);
  await adminDb.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data() || {};
    if (Number(d.points || 0) < price) throw new ShopError('poor');
    tx.set(ref, { points: Number(d.points || 0) - price, lastSeenAt: Date.now(), ...extra(d) }, { merge: true });
  });
}

export async function guestBuy(gk: string, item: string) {
  const price = (SHOP_ACC as Record<string, number>)[item];
  if (!price) throw new ShopError('bad_item');
  const season = (SEASON_ACC as Record<string, string>)[item];
  if (season && (await getActiveTheme()) !== season) throw new ShopError('season_over');
  const owned = ((await guestRef(gk).get()).data()?.unlocks || []) as string[];
  if (owned.includes(item)) throw new ShopError('owned');
  await guestSpend(gk, price, (d) => ({ unlocks: [...((d.unlocks || []) as string[]), item] }));
  return guestState(gk);
}

export async function guestFeed(gk: string, animal?: string) {
  const id = animal && (PET_IDS.includes(animal) || FEED_ONLY_IDS.includes(animal)) ? animal : null;
  const last = Number((await guestRef(gk).get()).data()?.lastFeedAt || 0);
  if (Date.now() - last < FEED_COOLDOWN_MS) throw new ShopError('cooldown');
  await guestSpend(gk, CAT_FOOD_PRICE, () => ({ lastFeedAt: Date.now() }));
  await announce({ t: 'feed', key: gk, nick: '', aid: id });
  return guestState(gk);
}

export async function guestWish(gk: string, nickRaw: unknown, raw: unknown, ornRaw?: unknown) {
  const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, WISH_MAX);
  if (!text) throw new ShopError('empty');
  if (hasBadWord(text)) throw new ShopError('bad_word');
  let nick = String(nickRaw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12);
  if (!nick || hasBadWord(nick) || isReservedNick(nick)) nick = '손님';
  const theme = await getActiveTheme();
  const orn = theme === 'xmas' ? (WISH_ORNS.includes(String(ornRaw)) ? String(ornRaw) : 'star') : null;
  const ref = adminDb.collection('plazaWishes').doc();
  await guestSpend(gk, WISH_PRICE, () => ({}));
  await ref.set({ uid: null, guest: gk, nick, text, theme, ...(orn ? { orn } : {}), createdAt: new Date() });   // 비회원 소원도 신고·관리 대상(guest 키로 추적)
  await announce({ t: 'wish', key: gk, nick, text, id: ref.id, orn, theme });
  return guestState(gk);
}
