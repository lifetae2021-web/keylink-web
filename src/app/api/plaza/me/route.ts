import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

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
    // 내부 필드는 빼고 광장 표시용만 돌려준다
    const { nickLower, uid, createdAt, updatedAt, ...profile } = data as Record<string, unknown>;
    return NextResponse.json({ profile });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
