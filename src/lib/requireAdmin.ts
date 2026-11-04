import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// 관리자 전용 API 공통 확인: Authorization: Bearer <Firebase ID 토큰> + users/{uid}.role 이 admin/super_admin
// 통과하면 { uid }, 아니면 그대로 반환할 NextResponse(401/403).
export async function requireAdmin(req: Request): Promise<{ uid: string } | NextResponse> {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const uid = (await adminAuth.verifyIdToken(h.split('Bearer ')[1])).uid;
    const role = (await adminDb.collection('users').doc(uid).get()).data()?.role;
    if (role !== 'admin' && role !== 'super_admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    return { uid };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
