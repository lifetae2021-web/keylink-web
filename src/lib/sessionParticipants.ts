import { adminDb } from '@/lib/firebaseAdmin';

/**
 * 기수 참가자 정보를 서버에서만 읽어 화면에 필요한 항목만 내보내기 위한 공용 함수.
 * users/applications 문서에는 전화번호·생년월일·재직증명서가 들어 있으므로 클라이언트가 직접 읽지 않게 한다.
 */

export type Gender = 'male' | 'female';

export interface ParticipantRecord {
  appId: string;
  userId: string;
  app: FirebaseFirestore.DocumentData;
  user: FirebaseFirestore.DocumentData;
}

/** 테스트 계정·더미·투명인간(닼템) 참가자 */
export function isTestParticipant(appId: string, app: FirebaseFirestore.DocumentData): boolean {
  return app.isDarkTemplar === true || appId.startsWith('dummy')
    || !!app.userId?.startsWith('user_m_') || !!app.userId?.startsWith('user_f_');
}

/** '94-05-30' 또는 '940530' → '94' (화면의 'OO년생' 표기용) */
export function birthYearOf(raw: string | undefined | null): string {
  const s = raw || '';
  if (s.includes('-')) return s.split('-')[0].slice(-2);
  return s.length >= 2 ? s.slice(0, 2) : '??';
}

/** 기수의 확정 참가자 신청서 + 회원 문서 (테스트 참가자 포함, 거르는 건 호출하는 쪽에서) */
export async function loadConfirmedParticipants(sessionId: string): Promise<ParticipantRecord[]> {
  const apps = await adminDb.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('status', '==', 'confirmed')
    .get();
  const userIds = Array.from(new Set(apps.docs.map(d => d.data().userId).filter(Boolean)));
  const users = userIds.length
    ? await adminDb.getAll(...userIds.map(id => adminDb.doc(`users/${id}`)))
    : [];
  const userMap = new Map(users.map((u: FirebaseFirestore.DocumentSnapshot) => [u.id, u.data() || {}]));
  return apps.docs.map(d => ({ appId: d.id, userId: d.data().userId, app: d.data(), user: userMap.get(d.data().userId) || {} }));
}

/** 한 사람이 이 기수 확정 참가자인지 */
export async function isConfirmedParticipant(sessionId: string, uid: string): Promise<boolean> {
  const snap = await adminDb.collection('applications')
    .where('sessionId', '==', sessionId)
    .where('userId', '==', uid)
    .where('status', '==', 'confirmed')
    .limit(1)
    .get();
  return !snap.empty;
}

export async function isAdminUser(uid: string): Promise<boolean> {
  const role = (await adminDb.doc(`users/${uid}`).get()).data()?.role;
  return role === 'admin' || role === 'super_admin';
}

export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
