import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { plazaKey } from '@/lib/plazaKey';

// 광장(플라자) 회원 프로필 조회
// 로그인한 본인의 plazaProfiles/{uid} 문서를 돌려준다. 없으면 profile:null (아직 광장 가입 전).
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const snap = await adminDb.collection('plazaProfiles').doc(decoded.uid).get();
    if (!snap.exists) {
      return NextResponse.json({ profile: null });
    }
    const data = snap.data() || {};
    // 예전 프로필에 익명 키가 없으면 채워 둔다(신고 대상 조회용)
    if (!data.key) { try { await snap.ref.set({ key: plazaKey(decoded.uid) }, { merge: true }); } catch {} }
    // 내부 필드는 빼고 광장 표시용만 돌려준다
    const { nickLower, uid, key, createdAt, updatedAt, nickChangedAt, ...profile } = data as Record<string, any>;
    // 닉네임 변경 잠금(24시간) 해제 시각 — 예전 프로필(변경 기록 없음)과 관리자는 잠금 없음
    const changedMs: number | null = nickChangedAt?.toMillis?.() ?? null;
    const role = (await adminDb.doc(`users/${decoded.uid}`).get()).data()?.role;
    const isStaff = role === 'admin' || role === 'super_admin';
    const nickLockedUntil = changedMs && !isStaff ? changedMs + 24 * 60 * 60 * 1000 : null;
    return NextResponse.json({ profile: { ...profile, nickLockedUntil } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
