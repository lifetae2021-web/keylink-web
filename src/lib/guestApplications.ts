import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const ACTIVE = ['pending', 'applied', 'selected', 'confirmed'];

/**
 * 회원이 휴대폰 문자 인증을 마친 직후: 같은 번호로 낸 "비회원" 진행 중 신청서를 회원 계정으로 옮긴다.
 * - 다른 정식 회원 계정의 신청서는 건드리지 않는다(비회원·익명 기록만).
 * - 이미 같은 기수에 회원 신청서가 있으면 비회원 신청서는 취소(마지막 신청만 남김 — 2026-11 운영 결정).
 * - 옮긴 비회원 기록에는 mergedTo, 회원 계정에는 mergedFrom을 남긴다(관리자 목록에서 합쳐진 기록으로 보임).
 */
export async function adoptGuestApplications(uid: string, phone: string) {
  const snap = await adminDb.collection('applications').where('phone', '==', phone).get();
  const active = snap.docs.filter(d => ACTIVE.includes(d.data().status));
  const mineSessions = new Set(active.filter(d => d.data().userId === uid).map(d => d.data().sessionId));
  const ownerCache = new Map<string, boolean>();
  const isGuest = async (owner: string) => {
    if (!ownerCache.has(owner)) {
      const u = (await adminDb.doc(`users/${owner}`).get()).data();
      ownerCache.set(owner, !u || u.loginMethod === 'anonymous' || u.isRegistered === false);
    }
    return ownerCache.get(owner)!;
  };
  let moved = 0, cancelled = 0; const guests = new Set<string>();
  const batch = adminDb.batch();
  for (const d of active) {
    const a = d.data();
    if (!a.userId || a.userId === uid || !(await isGuest(a.userId))) continue;
    guests.add(a.userId);
    if (mineSessions.has(a.sessionId)) {
      batch.update(d.ref, { status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date(), adminNote: '중복 신청 자동 정리: 같은 기수에 회원 계정 신청서가 있어 비회원 신청서를 취소' });
      cancelled++;
    } else {
      batch.update(d.ref, { userId: uid, isGuestApply: false, updatedAt: new Date(), adminNote: '회원 가입(휴대폰 인증) 후 비회원 신청서를 회원 계정으로 자동 이관' });
      mineSessions.add(a.sessionId); moved++;
    }
  }
  for (const g of guests) batch.set(adminDb.doc(`users/${g}`), { mergedTo: uid, mergedAt: new Date() }, { merge: true });
  if (guests.size) batch.set(adminDb.doc(`users/${uid}`), { mergedFrom: FieldValue.arrayUnion(...guests) }, { merge: true });
  if (moved || cancelled || guests.size) await batch.commit();
  return { moved, cancelled };
}
