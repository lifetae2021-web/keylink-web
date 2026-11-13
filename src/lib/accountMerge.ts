import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 같은 사람의 계정 연결 (휴대폰 문자 인증으로 번호 소유가 확인된 경우에만 호출)
 * - 기존 계정(into)을 남기고, 새로 만든 계정(from)의 신청/투표/매칭/쿠폰/포인트를 기존 계정으로 옮긴다.
 * - from 문서에는 mergedTo, into 문서에는 mergedFrom을 남겨, 이후 from 계정으로 로그인해도 into 계정으로 넘어가게 한다
 *   (/api/auth/follow-merge 참고). 양쪽 표시가 모두 있어야만 넘어가므로 본인 문서만 고칠 수 있는 클라이언트가 위조할 수 없다.
 */

const WELCOME_COUPON_TITLE = '웰컴 가입 축하 쿠폰';

// from 계정 값으로 into 계정의 빈 칸을 채울 때 건드리지 않는 필드
const SKIP_FILL_FIELDS = new Set([
  'uid', 'username', 'createdAt', 'updatedAt', 'loginMethod', 'provider', 'role', 'points', 'isRegistered',
  'mergedTo', 'mergedFrom', 'verifiedPhone', 'phone', 'visitCount', 'lastVisitAt', 'knownVisitorIds',
  'participationCount', 'cancelledSessionHistory', 'user_logs', 'status', 'isVerified', 'isJobReviewed',
]);

/** from 계정 값으로 into 계정의 빈 칸만 채울 값 (into에 이미 있는 값은 그대로 둔다) */
export function emptyFieldFill(fromU: Record<string, any>, intoU: Record<string, any>, skip: Set<string> = SKIP_FILL_FIELDS) {
  const fill: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fromU)) {
    if (skip.has(k)) continue;
    const cur = intoU[k];
    const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (empty && v !== undefined && v !== null && v !== '') fill[k] = v;
  }
  return fill;
}

/** 비회원 → 회원 이관 때 건너뛸 필드: 기본 목록에서 인증 상태는 넘기고(관리자가 이미 확인한 같은 사람), 비회원 로그인 정보는 빼고 */
export const GUEST_SKIP_FILL_FIELDS = new Set([
  ...Array.from(SKIP_FILL_FIELDS).filter(k => !['status', 'isVerified', 'isJobReviewed'].includes(k)),
  'guestId', 'guestPwHash', 'guestPw', 'mergedAt',
]);

const isDummyId = (id: string) => /^(dummy|user_m_|user_f_)/.test(id);

export interface ExistingAccountInfo {
  uid: string;
  maskedName: string;
  method: 'kakao' | 'google' | 'id';
  maskedUsername: string | null;
  joinedAt: string | null;
  isAdmin: boolean;
}

/** 이 번호로 가입된 다른 정식 회원 계정 (가장 먼저 가입한 계정). 비회원·더미·이미 합쳐진 계정은 제외. */
export async function findExistingAccount(phone: string, excludeUid?: string | null): Promise<ExistingAccountInfo | null> {
  const snap = await adminDb.collection('users').where('phone', '==', phone).get();
  const candidates = snap.docs.filter(d => {
    const u = d.data();
    return d.id !== excludeUid && !isDummyId(d.id) && u.isDummy !== true && !u.mergedTo
      && u.isRegistered !== false && u.loginMethod !== 'anonymous';
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0));
  const d = candidates[0];
  const u = d.data();
  const method = d.id.startsWith('kakao_') || u.provider === 'kakao' ? 'kakao'
    : u.provider === 'google' || u.loginMethod === 'google' ? 'google' : 'id';
  const created = u.createdAt?.toDate?.() as Date | undefined;
  return {
    uid: d.id,
    maskedName: maskName(u.name || ''),
    method,
    maskedUsername: method === 'id' && u.username ? maskUsername(u.username) : null,
    joinedAt: created ? `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, '0')}` : null,
    isAdmin: u.role === 'admin' || u.role === 'super_admin',
  };
}

export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
}

function maskUsername(id: string): string {
  if (id.length <= 3) return `${id[0]}${'*'.repeat(id.length - 1)}`;
  return `${id.slice(0, 3)}${'*'.repeat(id.length - 3)}`;
}

function replaceUid(value: any, from: string, into: string): any {
  if (value === from) return into;
  if (Array.isArray(value)) return value.map(v => replaceUid(v, from, into));
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k === from ? into : k, replaceUid(v, from, into)]));
  }
  return value;
}

const mentions = (data: unknown, uid: string) => JSON.stringify(data).includes(uid);

export async function mergeAccountInto(fromUid: string, intoUid: string, phone: string) {
  if (fromUid === intoUid) throw new Error('같은 계정은 합칠 수 없습니다.');
  const fromRef = adminDb.doc(`users/${fromUid}`);
  const intoRef = adminDb.doc(`users/${intoUid}`);
  const [fromSnap, intoSnap] = await Promise.all([fromRef.get(), intoRef.get()]);
  if (!fromSnap.exists || !intoSnap.exists) throw new Error('계정 정보를 찾을 수 없습니다.');
  const fromU = fromSnap.data()!;
  const intoU = intoSnap.data()!;

  const batch = adminDb.batch();
  let ops = 0;
  const op = () => { if (++ops > 450) throw new Error('옮길 기록이 너무 많아 자동 연결할 수 없습니다. 고객센터로 문의해 주세요.'); };

  // 1. 신청서
  const [apps, privateApps] = await Promise.all([
    adminDb.collection('applications').where('userId', '==', fromUid).get(),
    adminDb.collection('private_applications').where('userId', '==', fromUid).get(),
  ]);
  const sessionIds = new Set<string>();
  apps.forEach(a => { sessionIds.add(a.data().sessionId); batch.update(a.ref, { userId: intoUid }); op(); });
  privateApps.forEach(a => { batch.update(a.ref, { userId: intoUid }); op(); });

  // 2. 투표(내가 한 투표 + 남이 나를 고른 투표)와 매칭 결과
  for (const sid of Array.from(sessionIds)) {
    if (!sid) continue;
    const [votes, summary] = await Promise.all([
      adminDb.collection('votes').where('sessionId', '==', sid).get(),
      adminDb.doc(`matchingSummaries/${sid}`).get(),
    ]);
    votes.forEach(v => {
      const d = v.data();
      if (!mentions(d, fromUid)) return;
      if (d.userId === fromUid) {
        batch.set(adminDb.doc(`votes/${sid}_${intoUid}`), replaceUid(d, fromUid, intoUid)); op();
        batch.delete(v.ref); op();
      } else {
        batch.set(v.ref, replaceUid(d, fromUid, intoUid)); op();
      }
    });
    if (summary.exists && mentions(summary.data(), fromUid)) {
      batch.set(summary.ref, replaceUid(summary.data(), fromUid, intoUid)); op();
    }
  }

  // 3. 쿠폰 (새 계정에서 자동 발급된 미사용 웰컴 쿠폰은 기존 회원이므로 옮기지 않는다)
  const coupons = await fromRef.collection('coupons').get();
  coupons.forEach(c => {
    const d = c.data();
    if (d.title === WELCOME_COUPON_TITLE && !d.isUsed) return;
    batch.set(intoRef.collection('coupons').doc(c.id), { ...d, migratedFrom: fromUid }); op();
  });

  // 4. 포인트 (남은 적립 건을 유효기간 그대로 옮김)
  const lots = await fromRef.collection('pointHistory').where('remaining', '>', 0).get();
  const now = Date.now();
  let movedPoints = 0;
  lots.forEach(l => {
    const d = l.data();
    if ((d.expiresAt?.toMillis?.() ?? 0) <= now) return;
    movedPoints += d.remaining;
    batch.set(intoRef.collection('pointHistory').doc(), {
      type: 'earn',
      source: 'account_merge',
      reason: '연결한 계정의 포인트 이전',
      amount: d.remaining,
      remaining: d.remaining,
      expiresAt: d.expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    }); op();
    batch.update(l.ref, { remaining: 0 }); op();
  });

  // 5. 회원 정보: 기존 계정 값을 우선하고 빈 칸만 새 계정 값으로 채운다
  const fill = emptyFieldFill(fromU, intoU);
  batch.update(intoRef, {
    ...fill,
    phone,
    verifiedPhone: phone,
    participationCount: (intoU.participationCount || 0) + (fromU.participationCount || 0),
    cancelledSessionHistory: [...(intoU.cancelledSessionHistory || []), ...(fromU.cancelledSessionHistory || [])],
    user_logs: [...(intoU.user_logs || []), ...(fromU.user_logs || [])],
    points: FieldValue.increment(movedPoints),
    mergedFrom: FieldValue.arrayUnion(fromUid),
    updatedAt: new Date(),
  }); op();
  batch.update(fromRef, {
    mergedTo: intoUid,
    points: FieldValue.increment(-movedPoints),
    updatedAt: new Date(),
  }); op();

  await batch.commit();
  return { applications: apps.size + privateApps.size, points: movedPoints };
}

/** from 계정이 into 계정으로 합쳐졌는지 (양쪽 표시가 모두 있는지) 확인하고, 최종 계정 uid를 돌려준다. */
export async function resolveMergedAccount(uid: string): Promise<string | null> {
  let current = uid;
  for (let i = 0; i < 3; i++) {
    const snap = await adminDb.doc(`users/${current}`).get();
    const target = snap.data()?.mergedTo;
    if (!target || target === current) return current === uid ? null : current;
    const targetSnap = await adminDb.doc(`users/${target}`).get();
    const mergedFrom: string[] = targetSnap.data()?.mergedFrom || [];
    if (!mergedFrom.includes(current)) return current === uid ? null : current;
    current = target;
  }
  return current === uid ? null : current;
}
