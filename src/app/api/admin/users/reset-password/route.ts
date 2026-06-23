import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// 랜덤 임시 비밀번호 생성 (영문+숫자 8자리)
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    // ── 권한 검증: admin 이상만 가능 ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (!callerDoc.exists || !['admin', 'super_admin'].includes(callerRole)) {
      return NextResponse.json({ error: '관리자만 사용할 수 있습니다.' }, { status: 403 });
    }

    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ error: 'uid가 필요합니다.' }, { status: 400 });

    const tempPassword = generateTempPassword();

    // Firebase Auth 비밀번호 설정 (소셜 계정 포함, 어떤 계정이든 가능)
    await adminAuth.updateUser(uid, { password: tempPassword });

    return NextResponse.json({ success: true, tempPassword });
  } catch (error: any) {
    console.error('[Reset Password]', error.message);
    return NextResponse.json({ error: '비밀번호 재설정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
