import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 });
    }

    // username으로 조회
    const byUsername = await adminDb.collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (byUsername.empty) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 404 });
    }

    const userDoc = byUsername.docs[0].data();

    // 이메일 가입 계정은 내부 가상 이메일 사용, 소셜 계정은 실제 이메일 사용 불가
    if (userDoc.provider !== 'email') {
      return NextResponse.json({ error: '소셜 계정(카카오/구글)으로 가입된 아이디입니다. 해당 소셜 로그인을 이용해 주세요.' }, { status: 400 });
    }

    const internalEmail = `${username}@keylink.user`;
    return NextResponse.json({ email: internalEmail });

  } catch (error: any) {
    console.error('[Login API] Error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
