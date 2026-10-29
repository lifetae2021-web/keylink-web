import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  DAILY_VISIT_POINTS, MIN_REDEEM_POINTS, VISITOR_POINT_CAP,
  DEFAULT_DROP_ENABLED, DEFAULT_DROP_CHANCE_PERCENT, DEFAULT_DROP_DAILY_LIMIT,
} from '@/lib/pointsConfig';

/**
 * 포인트 제도 (1P = 1원)
 * - 매일 첫 방문(한국 시간 자정 기준) 100P, 사이트에 머무는 동안 낮은 확률로 떨어지는 포인트(하루 최대 3개)
 * - 비회원(로그인 안 한 방문자, 비회원 신청자)은 브라우저 쿠키 기준으로 최대 1,000P까지 적립, 사용은 정식 회원만
 * - 정식 회원 로그인 시 그 브라우저의 비회원 포인트를 1회 합침
 * - 적립 건별 유효기간 1년, 사용 시 먼저 만료되는 포인트부터 차감
 * 잔액/내역은 서버(Admin SDK)에서만 쓰고, 회원 잔액은 users/{uid}.points, 적립 건은 users/{uid}/pointHistory에 둔다.
 */

export { DAILY_VISIT_POINTS, MIN_REDEEM_POINTS, VISITOR_POINT_CAP };
export const DROP_ROLL_INTERVAL_MS = 3 * 60 * 1000;
const DROP_CLAIM_WINDOW_MS = 30 * 1000;
const POINT_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

export const VISITOR_COOKIE = 'kl_vid';
const VISITOR_ID_RE = /^[0-9a-f-]{36}$/;

export type PointOwner =
  | { kind: 'member'; uid: string }
  | { kind: 'visitor'; vid: string };

interface Lot {
  amount: number;
  remaining: number;
  expiresAt: number;
  source: string;
  createdAt: number;
}

interface DailyState {
  date: string;
  visit: boolean;
  drops: number;
  lastRollAt: number;
  firstDrop?: boolean; // 오늘 첫 입장 보장 드롭을 이미 줬는지
  pending: { id: string; amount: number; expiresAt: number } | null;
}

/** 서버 시간대(UTC)와 무관하게 항상 한국 날짜(YYYY-MM-DD) */
export function seoulToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function walletRef(owner: PointOwner) {
  return adminDb.doc(`pointWallets/${owner.kind === 'member' ? `m_${owner.uid}` : `v_${owner.vid}`}`);
}

function freshDaily(today: string, prev?: DailyState): DailyState {
  if (prev && prev.date === today) return prev;
  return { date: today, visit: false, drops: 0, lastRollAt: prev?.lastRollAt || 0, firstDrop: false, pending: null };
}

/** 관리자 설정(settings/general)의 떨어지는 포인트 on/off·확률·하루 개수. 매 요청 조회를 피하려고 1분 캐시 */
let dropSettingsCache: { at: number; value: { enabled: boolean; chance: number; dailyLimit: number; images: string[] } } | null = null;
async function getDropSettings() {
  if (dropSettingsCache && Date.now() - dropSettingsCache.at < 60 * 1000) return dropSettingsCache.value;
  const s = (await adminDb.doc('settings/general').get()).data() || {};
  const chancePercent = Number(s.pointDropChance ?? DEFAULT_DROP_CHANCE_PERCENT);
  const dailyLimit = Number(s.pointDropDailyLimit ?? DEFAULT_DROP_DAILY_LIMIT);
  const value = {
    enabled: s.pointDropEnabled ?? DEFAULT_DROP_ENABLED,
    chance: Math.min(100, Math.max(0, Number.isFinite(chancePercent) ? chancePercent : DEFAULT_DROP_CHANCE_PERCENT)) / 100,
    dailyLimit: Math.max(0, Number.isFinite(dailyLimit) ? Math.floor(dailyLimit) : DEFAULT_DROP_DAILY_LIMIT),
    // 관리자가 선택한 이미지들(기본 제공 'preset:*' 또는 업로드 URL) 중 떨어질 때마다 하나를 무작위로
    images: Array.isArray(s.pointDropImages) ? s.pointDropImages.filter((v: unknown) => typeof v === 'string' && v) : [],
  };
  dropSettingsCache = { at: Date.now(), value };
  return value;
}

/** 10~50P 90%, 100P 9%, 500P(대박) 1% */
function rollDropAmount(): number {
  const r = Math.random();
  if (r < 0.01) return 500;
  if (r < 0.10) return 100;
  return (1 + Math.floor(Math.random() * 5)) * 10;
}

/**
 * 요청자를 포인트 주인으로 확정한다.
 * 정식 회원(가입 완료, 병합되지 않은 계정)만 member, 그 외(비로그인/익명/비회원 신청자)는 쿠키 기반 visitor.
 */
export async function resolvePointOwner(req: NextRequest): Promise<{ owner: PointOwner; visitorId: string | null; newVisitorId: string | null }> {
  const cookieVid = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = cookieVid && VISITOR_ID_RE.test(cookieVid) ? cookieVid : null;

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      if (decoded.firebase?.sign_in_provider !== 'anonymous') {
        const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
        const u = userSnap.data();
        if (userSnap.exists && u?.isRegistered !== false && !u?.mergedTo) {
          return { owner: { kind: 'member', uid: decoded.uid }, visitorId, newVisitorId: null };
        }
      }
    } catch {
      // 토큰이 만료/위조된 경우 비회원으로 취급
    }
  }

  if (visitorId) return { owner: { kind: 'visitor', vid: visitorId }, visitorId, newVisitorId: null };
  const vid = randomUUID();
  return { owner: { kind: 'visitor', vid }, visitorId: vid, newVisitorId: vid };
}

// ── 회원 적립/사용 (트랜잭션 내부 헬퍼) ─────────────────────────────

function addMemberLot(tx: FirebaseFirestore.Transaction, uid: string, amount: number, source: string, reason: string, expiresAt?: number) {
  const now = Date.now();
  tx.set(adminDb.collection(`users/${uid}/pointHistory`).doc(), {
    type: 'earn',
    source,
    reason,
    amount,
    remaining: amount,
    expiresAt: new Date(expiresAt ?? now + POINT_VALIDITY_MS),
    createdAt: FieldValue.serverTimestamp(),
  });
  tx.update(adminDb.doc(`users/${uid}`), { points: FieldValue.increment(amount) });
}

async function readSpendableLots(tx: FirebaseFirestore.Transaction, uid: string) {
  const snap = await tx.get(adminDb.collection(`users/${uid}/pointHistory`).where('remaining', '>', 0));
  const now = Date.now();
  return snap.docs
    .filter(d => d.data().expiresAt?.toMillis() > now)
    .sort((a, b) => a.data().expiresAt.toMillis() - b.data().expiresAt.toMillis());
}

/** 먼저 만료되는 적립 건부터 차감. 잔액 부족 시 에러. */
function spendFromLots(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  lots: FirebaseFirestore.QueryDocumentSnapshot[],
  amount: number,
  entry: Record<string, unknown>
) {
  const available = lots.reduce((sum, d) => sum + d.data().remaining, 0);
  if (available < amount) throw new Error('포인트가 부족합니다.');

  let left = amount;
  const consumed: { lotId: string; amount: number }[] = [];
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(left, lot.data().remaining);
    tx.update(lot.ref, { remaining: lot.data().remaining - take });
    consumed.push({ lotId: lot.id, amount: take });
    left -= take;
  }
  tx.set(adminDb.collection(`users/${uid}/pointHistory`).doc(), {
    ...entry,
    amount,
    consumed,
    createdAt: FieldValue.serverTimestamp(),
  });
  tx.update(adminDb.doc(`users/${uid}`), { points: FieldValue.increment(-amount) });
}

/** 유효기간이 지난 적립 건을 소멸 처리 (방문 시마다 호출) */
export async function expireMemberPoints(uid: string): Promise<number> {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(adminDb.collection(`users/${uid}/pointHistory`).where('remaining', '>', 0));
    const now = Date.now();
    const expired = snap.docs.filter(d => (d.data().expiresAt?.toMillis() ?? Infinity) <= now);
    if (expired.length === 0) return 0;

    const total = expired.reduce((sum, d) => sum + d.data().remaining, 0);
    expired.forEach(d => tx.update(d.ref, { remaining: 0 }));
    tx.set(adminDb.collection(`users/${uid}/pointHistory`).doc(), {
      type: 'expire',
      reason: '유효기간 만료',
      amount: total,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(adminDb.doc(`users/${uid}`), { points: FieldValue.increment(-total) });
    return total;
  });
}

// ── 적립 공통 ───────────────────────────────────────────────

/** 트랜잭션 내에서 주인에게 적립. visitor는 상한까지만 적립되고 실제 적립액을 반환한다. */
function earn(
  tx: FirebaseFirestore.Transaction,
  owner: PointOwner,
  wallet: FirebaseFirestore.DocumentData | undefined,
  amount: number,
  source: string,
  reason: string
): { earned: number; walletPatch: Record<string, unknown> } {
  if (owner.kind === 'member') {
    addMemberLot(tx, owner.uid, amount, source, reason);
    return { earned: amount, walletPatch: {} };
  }
  const now = Date.now();
  const lots: Lot[] = (wallet?.lots || []).filter((l: Lot) => l.remaining > 0 && l.expiresAt > now);
  const balance = lots.reduce((sum, l) => sum + l.remaining, 0);
  const earned = Math.max(0, Math.min(amount, VISITOR_POINT_CAP - balance));
  if (earned > 0) lots.push({ amount: earned, remaining: earned, expiresAt: now + POINT_VALIDITY_MS, source, createdAt: now });
  return { earned, walletPatch: { lots, balance: balance + earned } };
}

function visitorBalance(wallet: FirebaseFirestore.DocumentData | undefined): number {
  const now = Date.now();
  return (wallet?.lots || [])
    .filter((l: Lot) => l.remaining > 0 && l.expiresAt > now)
    .reduce((sum: number, l: Lot) => sum + l.remaining, 0);
}

async function readBalance(owner: PointOwner, wallet: FirebaseFirestore.DocumentData | undefined): Promise<number> {
  if (owner.kind === 'visitor') return visitorBalance(wallet);
  const snap = await adminDb.doc(`users/${owner.uid}`).get();
  return snap.data()?.points || 0;
}

// ── 비회원 → 회원 1회 합치기 ────────────────────────────────

export async function mergeVisitorIntoMember(uid: string, vid: string): Promise<number> {
  const memberWalletRef = walletRef({ kind: 'member', uid });
  const visitorWalletRef = walletRef({ kind: 'visitor', vid });
  return adminDb.runTransaction(async (tx) => {
    const [memberWallet, visitorWallet] = await Promise.all([tx.get(memberWalletRef), tx.get(visitorWalletRef)]);
    if (memberWallet.data()?.visitorMergedFrom) return 0;
    const v = visitorWallet.data();
    if (!v || v.mergedTo) return 0;

    const now = Date.now();
    const lots: Lot[] = (v.lots || []).filter((l: Lot) => l.remaining > 0 && l.expiresAt > now);
    const total = lots.reduce((sum, l) => sum + l.remaining, 0);
    if (total === 0) return 0;

    lots.forEach(l => addMemberLot(tx, uid, l.remaining, 'visitor_merge', '비회원 적립 포인트 이전', l.expiresAt));
    tx.set(memberWalletRef, { visitorMergedFrom: vid }, { merge: true });
    tx.set(visitorWalletRef, { mergedTo: uid, lots: [], balance: 0 }, { merge: true });
    return total;
  });
}

// ── 방문 / 떨어지는 포인트 ───────────────────────────────────

export async function grantDailyVisit(owner: PointOwner) {
  const ref = walletRef(owner);
  const today = seoulToday();
  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const wallet = snap.data();
    const daily = freshDaily(today, wallet?.daily);
    if (daily.visit) return { granted: 0, capped: false };

    const { earned, walletPatch } = earn(tx, owner, wallet, DAILY_VISIT_POINTS, 'daily_visit', '오늘의 방문 포인트');
    tx.set(ref, { ...walletPatch, daily: { ...daily, visit: true } }, { merge: true });
    // 비회원 상한에 막혀 오늘 방문 포인트를 못 받은 경우 → 가입 안내용
    return { granted: earned, capped: earned === 0 };
  });
  const walletSnap = await ref.get();
  return { ...result, balance: await readBalance(owner, walletSnap.data()) };
}

/** 일정 간격으로 호출되어 포인트를 떨어뜨릴지 서버에서 결정한다. 금액은 주울 때 공개. */
export async function rollDrop(owner: PointOwner): Promise<{ dropId: string | null; image?: string | null; disabled?: boolean }> {
  const settings = await getDropSettings();
  if (!settings.enabled) return { dropId: null, disabled: true };

  const ref = walletRef(owner);
  const today = seoulToday();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const wallet = snap.data();
    const daily = freshDaily(today, wallet?.daily);
    const now = Date.now();

    if (daily.drops >= settings.dailyLimit) return { dropId: null };
    if (owner.kind === 'visitor' && visitorBalance(wallet) >= VISITOR_POINT_CAP) return { dropId: null };

    // 오늘 첫 입장이면 간격/확률과 무관하게 한 번은 반드시 떨어뜨림
    const firstOfDay = !daily.firstDrop;
    // 클라이언트 주기보다 약간 짧게 허용해 타이머 오차로 거절되지 않게 함
    if (!firstOfDay && now - daily.lastRollAt < DROP_ROLL_INTERVAL_MS - 15 * 1000) return { dropId: null };

    const next: DailyState = { ...daily, lastRollAt: now, firstDrop: true };
    let dropId: string | null = null;
    if (firstOfDay || Math.random() < settings.chance) {
      dropId = randomUUID();
      next.pending = { id: dropId, amount: rollDropAmount(), expiresAt: now + DROP_CLAIM_WINDOW_MS };
    }
    tx.set(ref, { daily: next }, { merge: true });
    const image = settings.images.length > 0 ? settings.images[Math.floor(Math.random() * settings.images.length)] : null;
    return dropId ? { dropId, image } : { dropId };
  });
}

export async function claimDrop(owner: PointOwner, dropId: string) {
  const settings = await getDropSettings();
  const ref = walletRef(owner);
  const today = seoulToday();
  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const wallet = snap.data();
    const daily = freshDaily(today, wallet?.daily);
    const pending = daily.pending;
    if (!pending || pending.id !== dropId || pending.expiresAt < Date.now() || !settings.enabled || daily.drops >= settings.dailyLimit) {
      return { earned: 0 };
    }
    const { earned, walletPatch } = earn(tx, owner, wallet, pending.amount, 'drop', '떨어진 포인트 줍기');
    tx.set(ref, { ...walletPatch, daily: { ...daily, drops: daily.drops + 1, pending: null } }, { merge: true });
    return { earned };
  });
  const walletSnap = await ref.get();
  return { ...result, balance: await readBalance(owner, walletSnap.data()) };
}

// ── 신청 시 사용 / 환불 ─────────────────────────────────────

/** 본인 신청서에 포인트 할인 적용. 보유 1,000P 이상일 때만, 신청 금액을 넘지 않게. */
export async function redeemForApplication(uid: string, applicationId: string, requested: number) {
  const appRef = adminDb.doc(`applications/${applicationId}`);
  return adminDb.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    const app = appSnap.data();
    if (!app || app.userId !== uid) throw new Error('신청서를 찾을 수 없습니다.');
    if (app.pointsUsed) throw new Error('이미 포인트가 적용된 신청서입니다.');
    if (app.status !== 'applied') throw new Error('포인트를 적용할 수 없는 신청 상태입니다.');

    const lots = await readSpendableLots(tx, uid);
    const balance = lots.reduce((sum, d) => sum + d.data().remaining, 0);
    if (balance < MIN_REDEEM_POINTS) throw new Error(`포인트는 ${MIN_REDEEM_POINTS.toLocaleString()}P 이상부터 사용할 수 있습니다.`);

    const amount = Math.min(Math.floor(requested), balance, app.price || 0);
    if (amount <= 0) return { used: 0 };

    spendFromLots(tx, uid, lots, amount, { type: 'use', reason: '로테이션 신청 할인', applicationId });
    tx.update(appRef, {
      pointsUsed: amount,
      price: Math.max(0, (app.price || 0) - amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { used: amount };
  });
}

/** 신청서 삭제 시 사용한 포인트를 원래 적립 건으로 되돌린다 (중복 환불 방지). */
export async function refundApplicationPoints(uid: string, applicationId: string): Promise<number> {
  const useSnap = await adminDb.collection(`users/${uid}/pointHistory`)
    .where('applicationId', '==', applicationId)
    .get();
  const useDoc = useSnap.docs.find(d => d.data().type === 'use' && !d.data().refunded);
  if (!useDoc) return 0;

  return adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(useDoc.ref);
    if (fresh.data()?.refunded) return 0;
    const consumed: { lotId: string; amount: number }[] = fresh.data()?.consumed || [];
    const lotRefs = consumed.map(c => adminDb.doc(`users/${uid}/pointHistory/${c.lotId}`));
    const lotSnaps = await Promise.all(lotRefs.map(r => tx.get(r)));

    let total = 0;
    lotSnaps.forEach((snap, i) => {
      if (!snap.exists) return;
      tx.update(snap.ref, { remaining: FieldValue.increment(consumed[i].amount) });
      total += consumed[i].amount;
    });
    tx.update(useDoc.ref, { refunded: true });
    tx.set(adminDb.collection(`users/${uid}/pointHistory`).doc(), {
      type: 'refund',
      reason: '신청 취소로 포인트 반환',
      amount: total,
      applicationId,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(adminDb.doc(`users/${uid}`), { points: FieldValue.increment(total) });
    return total;
  });
}

// ── 관리자 수동 지급/차감 ────────────────────────────────────

export async function adminAdjustPoints(uid: string, type: 'add' | 'deduct', amount: number, reason: string) {
  return adminDb.runTransaction(async (tx) => {
    if (type === 'add') {
      const userSnap = await tx.get(adminDb.doc(`users/${uid}`));
      if (!userSnap.exists) throw new Error('회원을 찾을 수 없습니다.');
      addMemberLot(tx, uid, amount, 'admin', reason);
      return;
    }
    const lots = await readSpendableLots(tx, uid);
    spendFromLots(tx, uid, lots, amount, { type: 'deduct', reason });
  });
}
