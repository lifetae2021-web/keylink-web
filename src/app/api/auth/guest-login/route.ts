import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { guestId, guestPw } = await request.json();

    if (!guestId || !guestPw) {
      return NextResponse.json({ error: '생년월일과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // Query Firestore for the non-member user
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef
      .where('isRegistered', '==', false)
      .where('guestId', '==', String(guestId))
      .where('guestPw', '==', String(guestPw))
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: '일치하는 비회원 정보가 없습니다. 생년월일과 비밀번호를 확인해주세요.' },
        { status: 401 }
      );
    }

    const userDoc = snapshot.docs[0];
    const uid = userDoc.id;

    // Mint custom token
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ token: customToken });

  } catch (error: any) {
    console.error('[Guest Login API] Error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
