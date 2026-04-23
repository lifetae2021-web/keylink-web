import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * v7.3.3 - ID Duplicate Check API
 * 비로그인 상태에서 Firestore 'users' 컬렉션을 조회해야 하므로
 * 클라이언트 SDK 대신 Admin SDK를 사용해 보안 규칙을 우회합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 });
    }

    // Admin SDK로 username 중복 조회 (보안 규칙 우회)
    const snapshot = await adminDb
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return NextResponse.json({ available: false, message: '이미 사용 중인 아이디입니다.' });
    }

    return NextResponse.json({ available: true, message: '사용 가능한 아이디입니다.' });

  } catch (error: any) {
    console.error('[check-id API] Error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
