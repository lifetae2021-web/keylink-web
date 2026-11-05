import { adminDb } from '@/lib/firebaseAdmin';
import { earnMemberPointsInTx, seoulToday } from '@/lib/points';
import { KEY_TOTAL } from '../../public/plaza/keys.js';
import { LOCKED_ACC } from '../../public/plaza/look.js';

// 키링 월드 황금 열쇠 보상 (회원만)
// - 하루에 열쇠 8개를 모두 모으면 100P(하루 한 번)
// - 7일 연속으로 모두 모을 때마다 오프라인 소개팅 3,000원 할인 쿠폰(유효 30일)
// - 모은 날 누적 3일: 황금 키링, 10일: 왕관 (look.js LOCKED_ACC)
// 포인트·쿠폰은 키링 월드 안에서 쓰는 혜택이고, 소개팅 선발과는 무관하다(화면에도 안내).
// 기록: plazaKeys/{uid} = { lastDay, streak, totalDays, unlocks[], coupons }
export const KEY_DAILY_POINTS = 100;
export const KEY_STREAK_FOR_COUPON = 7;
export const KEY_COUPON_VALUE = 3000;
const COUPON_VALID_DAYS = 30;
const WORKER = process.env.PLAZA_WORKER_URL || 'https://keylink-plaza.keylink-plaza-cf.workers.dev';

export type KeyState = { lastDay: string | null; streak: number; totalDays: number; unlocks: string[]; coupons: number };

export async function readKeyState(uid: string): Promise<KeyState> {
  const d = (await adminDb.doc(`plazaKeys/${uid}`).get()).data() || {};
  return { lastDay: d.lastDay || null, streak: d.streak || 0, totalDays: d.totalDays || 0, unlocks: d.unlocks || [], coupons: d.coupons || 0 };
}

/** 실시간 서버가 위치를 확인하고 기록한 오늘의 열쇠 개수 */
export async function countTodayKeys(uid: string, day: string): Promise<number> {
  const secret = process.env.PLAZA_ADMIN_SECRET;
  if (!secret) throw new Error('PLAZA_ADMIN_SECRET 미설정');
  const r = await fetch(WORKER + '/admin/keys', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-plaza-secret': secret },
    body: JSON.stringify({ uid, day }), cache: 'no-store',
  });
  if (!r.ok) throw new Error('worker_' + r.status);
  return (await r.json()).n || 0;
}

function prevDay(day: string) {
  const t = new Date(day + 'T00:00:00+09:00').getTime() - 86400000;
  return new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** 오늘 다 모았으면 보상(하루 한 번). 이미 받았으면 그대로 상태만 돌려준다 */
export async function claimKeyReward(uid: string) {
  const day = seoulToday();
  const n = await countTodayKeys(uid, day);
  if (n < KEY_TOTAL) return { ok: false as const, reason: 'not_all', n, total: KEY_TOTAL, state: await readKeyState(uid) };
  return adminDb.runTransaction(async (tx) => {
    const ref = adminDb.doc(`plazaKeys/${uid}`);
    const userRef = adminDb.doc(`users/${uid}`);
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(userRef)]);
    const u = userSnap.data();
    if (!userSnap.exists || u?.isRegistered === false || u?.mergedTo) return { ok: false as const, reason: 'not_member', n, total: KEY_TOTAL, state: null };
    const d = snap.data() || {};
    const prev: KeyState = { lastDay: d.lastDay || null, streak: d.streak || 0, totalDays: d.totalDays || 0, unlocks: d.unlocks || [], coupons: d.coupons || 0 };
    if (prev.lastDay === day) return { ok: true as const, already: true, n, total: KEY_TOTAL, state: prev, points: 0, coupon: false, newUnlocks: [] as string[] };
    const streak = prev.lastDay === prevDay(day) ? prev.streak + 1 : 1;
    const totalDays = prev.totalDays + 1;
    const unlocks = [...prev.unlocks];
    const newUnlocks: string[] = [];
    for (const [acc, need] of Object.entries(LOCKED_ACC)) if (totalDays >= need && !unlocks.includes(acc)) { unlocks.push(acc); newUnlocks.push(acc); }
    const coupon = streak % KEY_STREAK_FOR_COUPON === 0;
    earnMemberPointsInTx(tx, uid, KEY_DAILY_POINTS, 'plaza_keys', '키링 월드 황금 열쇠 8개 모으기');
    if (coupon) {
      const expireAt = new Date(Date.now() + COUPON_VALID_DAYS * 86400000);
      tx.set(adminDb.collection(`users/${uid}/coupons`).doc(), {
        title: `키링 월드 황금 열쇠 ${KEY_STREAK_FOR_COUPON}일 연속 쿠폰`, type: 'amount', value: KEY_COUPON_VALUE, isUsed: false,
        createdAt: new Date(), expireAt, note: '키링 월드 황금 열쇠 연속 모으기 보상',
      });
    }
    const state: KeyState = { lastDay: day, streak, totalDays, unlocks, coupons: prev.coupons + (coupon ? 1 : 0) };
    tx.set(ref, { ...state, updatedAt: new Date() }, { merge: true });
    return { ok: true as const, already: false, n, total: KEY_TOTAL, state, points: KEY_DAILY_POINTS, coupon, newUnlocks };
  });
}
