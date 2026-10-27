import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const GROUP_COUPON_TITLE = '동반 쿠폰';
const GROUP_COUPON_VALUE = 10000;
const GROUP_COUPON_VALIDITY_MONTHS = 3;

/** 행사 종료 여부: 매칭 승인(completed), 수동 종료(isForceHidden), 행사 24시간 경과 중 하나. */
export function isSessionEnded(session: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!session) return false;
  if (session.status === 'completed' || session.isForceHidden === true) return true;
  const eventDate = session.eventDate?.toDate?.() as Date | undefined;
  return !!eventDate && Date.now() >= eventDate.getTime() + 24 * 60 * 60 * 1000;
}

/**
 * 여성 동반 신청 → 입금확정 → 출석 → 행사 종료 후 1만원 쿠폰 1회 발송.
 * 비회원(게스트 신청)은 가입(신청서 이전)이 끝난 뒤에야 지급되고, 이미 발송된 신청서는 건너뛴다.
 */
export async function grantGroupCoupon(
  appRef: FirebaseFirestore.DocumentReference
): Promise<'granted' | 'skipped'> {
  return adminDb.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    const app = appSnap.data();
    if (!app) return 'skipped';
    if (app.groupCouponIssued) return 'skipped';
    if (app.femaleOption !== 'group' || app.status !== 'confirmed' || app.paymentConfirmed !== true) return 'skipped';
    if (app.attended !== true) return 'skipped';
    if (app.isGuestApply === true || !app.userId) return 'skipped';

    const [userSnap, sessionSnap] = await Promise.all([
      tx.get(adminDb.doc(`users/${app.userId}`)),
      tx.get(adminDb.doc(`sessions/${app.sessionId}`)),
    ]);
    if (!userSnap.exists || userSnap.data()?.isRegistered === false) return 'skipped';
    if (!isSessionEnded(sessionSnap.data())) return 'skipped';

    const couponRef = adminDb.collection('users').doc(app.userId).collection('coupons').doc();
    tx.set(couponRef, {
      title: GROUP_COUPON_TITLE,
      type: 'amount',
      value: GROUP_COUPON_VALUE,
      validityMonths: GROUP_COUPON_VALIDITY_MONTHS,
      isUsed: false,
      issuedBy: 'system',
      sourceApplicationId: appRef.id,
      createdAt: new Date(),
    });
    tx.update(appRef, { groupCouponIssued: true, groupCouponIssuedAt: FieldValue.serverTimestamp() });
    return 'granted';
  });
}
