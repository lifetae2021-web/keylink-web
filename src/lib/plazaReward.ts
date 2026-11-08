import { adminDb } from '@/lib/firebaseAdmin';
import { earnMemberPointsInTx, seoulToday } from '@/lib/points';
import { ENTRY_BONUS, STAY_POINTS, STAY_UNIT_MS, STAY_TICK_MS, STAY_DAILY_MAX } from '../../public/plaza/shop.js';

// 키링 월드 포인트 적립(웹사이트 방문 포인트와 별개, 회원만)
// - 처음 입장할 때 한 번만 ENTRY_BONUS(이미 받은 기록 entryBonusAt이 있으면 다시 안 줌)
// - 머문 시간 STAY_UNIT_MS마다 STAY_POINTS (하루 STAY_DAILY_MAX번까지)
// 머문 시간은 화면이 STAY_TICK_MS마다 보내는 신호 사이 간격으로만 센다. 신호가 끊기면(창 닫음·자리 비움) 그 사이는 0.
// 상태는 plazaKeys/{uid}: entryBonusAt · stayMs · stayLastAt · stayDay · stayDayCount
const TICK_GRACE_MS = STAY_TICK_MS + 5 * 60 * 1000;   // 백그라운드 탭은 타이머가 늦게 돌 수 있어 여유를 둔다

export class RewardError extends Error { constructor(public code: string) { super(code); } }

async function assertMember(uid: string) {
  const d = (await adminDb.doc(`users/${uid}`).get()).data();
  if (!d || d.isRegistered === false || d.mergedTo) throw new RewardError('not_member');
}

export async function plazaEnter(uid: string) {
  await assertMember(uid);
  const ref = adminDb.doc(`plazaKeys/${uid}`), now = Date.now();
  const bonus = await adminDb.runTransaction(async (tx) => {
    const k = (await tx.get(ref)).data() || {};
    const due = !k.entryBonusAt;
    if (due) earnMemberPointsInTx(tx, uid, ENTRY_BONUS, 'plaza_entry', '키링 월드 첫 입장 보너스');
    tx.set(ref, { ...(due ? { entryBonusAt: now } : {}), stayLastAt: now }, { merge: true });
    return due ? ENTRY_BONUS : 0;
  });
  return { bonus, ...(await stayState(uid)) };
}

export async function plazaTick(uid: string) {
  await assertMember(uid);
  const ref = adminDb.doc(`plazaKeys/${uid}`), now = Date.now(), today = seoulToday();
  const earned = await adminDb.runTransaction(async (tx) => {
    const k = (await tx.get(ref)).data() || {};
    const gap = now - Number(k.stayLastAt || 0);
    let ms = Number(k.stayMs || 0) + (gap > 0 && gap <= TICK_GRACE_MS ? gap : 0);
    let count = k.stayDay === today ? Number(k.stayDayCount || 0) : 0, got = 0;
    while (ms >= STAY_UNIT_MS && count < STAY_DAILY_MAX) { ms -= STAY_UNIT_MS; count++; got += STAY_POINTS; }
    if (count >= STAY_DAILY_MAX) ms = Math.min(ms, STAY_UNIT_MS);   // 오늘 다 받았으면 더 쌓아 두지 않는다
    if (got) earnMemberPointsInTx(tx, uid, got, 'plaza_stay', `키링 월드 머문 시간 보상(${got / STAY_POINTS}시간)`);
    tx.set(ref, { stayMs: ms, stayLastAt: now, stayDay: today, stayDayCount: count }, { merge: true });
    return got;
  });
  return { earned, ...(await stayState(uid)) };
}

async function stayState(uid: string) {
  const [u, k] = await Promise.all([adminDb.doc(`users/${uid}`).get(), adminDb.doc(`plazaKeys/${uid}`).get()]);
  const d = k.data() || {}, today = seoulToday();
  const count = d.stayDay === today ? Number(d.stayDayCount || 0) : 0;
  return {
    points: Number(u.data()?.points || 0),
    stayLeft: STAY_DAILY_MAX - count,                                   // 오늘 남은 적립 횟수
    nextInMs: count >= STAY_DAILY_MAX ? null : Math.max(0, STAY_UNIT_MS - Number(d.stayMs || 0)),
  };
}
