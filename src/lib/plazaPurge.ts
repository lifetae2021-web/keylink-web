import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, type Query } from 'firebase-admin/firestore';

// 키링 월드 개인정보 파기 — 개인정보처리방침 '보유 및 이용기간'과 숫자를 맞춘다(바꾸면 방침도 같이 고칠 것)
// - 탈퇴 즉시 파기: 프로필, 반려동물·호감도, 황금 열쇠·꾸미기, 차단 목록, 입장 동의 기록
// - 탈퇴 후 1년 보관: 1:1 대화, 키키 대화(요약 메모·운영진 전달 질문 포함), 분수대 소원 → purgeAt 표시 후 매일 정리
// - 비회원 키키 대화·운영진 전달 질문·입장 동의: 마지막 이용 후 1년
// - 처리 완료한 신고: 처리 후 1년
const DAY = 24 * 60 * 60 * 1000;
export const KEEP_AFTER_WITHDRAW_MS = 365 * DAY;
const GUEST_KEEP_MS = 365 * DAY;
const REPORT_KEEP_MS = 365 * DAY;

async function setPurgeAt(q: Query, purgeAt: Timestamp): Promise<number> {
  const snap = await q.get();
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = adminDb.batch();
    for (const d of snap.docs.slice(i, i + 400)) {
      if (d.get('purgeAt')) continue;
      batch.set(d.ref, { purgeAt, withdrawn: true }, { merge: true });
      n++;
    }
    await batch.commit();
  }
  return n;
}

// 회원 탈퇴(본인 탈퇴·관리자 삭제 둘 다) 때 호출
export async function purgePlazaOnWithdraw(uid: string) {
  const purgeAt = Timestamp.fromMillis(Date.now() + KEEP_AFTER_WITHDRAW_MS);
  await Promise.all([
    adminDb.doc(`plazaProfiles/${uid}`).delete(),
    adminDb.doc(`plazaPets/${uid}`).delete(),
    adminDb.doc(`plazaKeys/${uid}`).delete(),
    adminDb.doc(`plazaBlocks/${uid}`).delete(),
    adminDb.doc(`plazaConsents/u:${uid}`).delete(),
  ]);
  const chats = await setPurgeAt(adminDb.collection('plazaChats').where('participants', 'array-contains', uid), purgeAt);
  const wishes = await setPurgeAt(adminDb.collection('plazaWishes').where('uid', '==', uid), purgeAt);
  const questions = await setPurgeAt(adminDb.collection('plazaNpcQuestions').where('who', '==', uid), purgeAt);
  return { chats, wishes, questions };
}

// keep()이 true인 문서는 건너뛰며 쪽 단위로 끝까지 훑는다(한 번 실행에 최대 300건 삭제)
async function deleteDocs(q: Query, keep?: (d: FirebaseFirestore.QueryDocumentSnapshot) => boolean, recursive = false): Promise<number> {
  let n = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (let page = 0; page < 20 && n < 300; page++) {
    const snap = await (last ? q.startAfter(last) : q).limit(300).get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      if (n >= 300) break;
      if (keep && keep(d)) continue;
      if (recursive) await adminDb.instance.recursiveDelete(d.ref);
      else await d.ref.delete();
      n++;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }
  return n;
}

// 매일 한 번(Vercel Cron) — 보관 기간이 끝난 기록을 지운다. 한 번에 종류별 최대 300건, 남으면 다음 날 이어서.
export async function runPlazaRetention() {
  const now = Timestamp.now();
  const guestCut = Timestamp.fromMillis(Date.now() - GUEST_KEEP_MS);
  const reportCut = Timestamp.fromMillis(Date.now() - REPORT_KEEP_MS);
  const chats = await deleteDocs(adminDb.collection('plazaChats').where('purgeAt', '<=', now), undefined, true);
  const guestChats = await deleteDocs(adminDb.collection('plazaChats').where('updatedAt', '<', guestCut), (d) => d.get('isGuest') !== true, true);
  const wishes = await deleteDocs(adminDb.collection('plazaWishes').where('purgeAt', '<=', now));
  const guestConsents = await deleteDocs(adminDb.collection('plazaConsents').where('agreedAt', '<', guestCut), (d) => !d.id.startsWith('g:'));
  const reports = await deleteDocs(adminDb.collection('plazaReports').where('handledAt', '<', reportCut), (d) => d.get('status') !== 'resolved');
  const questions = await deleteDocs(adminDb.collection('plazaNpcQuestions').where('purgeAt', '<=', now));
  const guestQuestions = await deleteDocs(adminDb.collection('plazaNpcQuestions').where('createdAt', '<', guestCut), (d) => d.get('guest') !== true);
  return { chats, guestChats, wishes, guestConsents, reports, questions, guestQuestions };
}
