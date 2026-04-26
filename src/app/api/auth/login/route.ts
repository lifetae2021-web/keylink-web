import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 });
    }

    // username 또는 email로 조회
    let userDoc = null;

    const byUsername = await adminDb.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (!byUsername.empty) {
      userDoc = byUsername.docs[0].data();
    } else {
      const byEmail = await adminDb.collection('users')
        .where('email', '==', username)
        .limit(1)
        .get();
      if (!byEmail.empty) {
        userDoc = byEmail.docs[0].data();
      }
    }

    if (!userDoc) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 404 });
    }

    return NextResponse.json({ email: userDoc.email });

  } catch (error: any) {
    console.error('[Login API] Error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
