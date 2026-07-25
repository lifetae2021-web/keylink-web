import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { guestName, guestId, guestPw } = await request.json();

    if (!guestName || !guestId || !guestPw) {
      return NextResponse.json({ error: '이름, 생년월일, 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // Query Firestore for the non-member user by guestId and guestPw only
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef
      .where('isRegistered', '==', false)
      .where('guestId', '==', String(guestId))
      .where('guestPw', '==', String(guestPw))
      .get();

    // 대소문자 무시하고 이름 비교 (숫자가 붙은 이름도 허용 예: 박하린2 -> 박하린)
    const checkNameMatch = (dbNameStr: string, inputNameStr: string) => {
      const dbN = dbNameStr.toLowerCase().trim();
      const inN = inputNameStr.toLowerCase().trim();
      return dbN === inN || dbN.replace(/[0-9]/g, '') === inN;
    };

    const matchedDoc = snapshot.docs.find(doc => checkNameMatch(String(doc.data().name || ''), String(guestName)));

    if (!matchedDoc) {
      // 정식 가입 회원(카카오/구글)이 비회원 폼에서 로그인 시도했는지 2차 검색
      const regSnapshot = await usersRef
        .where('guestId', '==', String(guestId))
        .where('guestPw', '==', String(guestPw))
        .get();
      
      const regDoc = regSnapshot.docs.find(doc => checkNameMatch(String(doc.data().name || ''), String(guestName)));
      if (regDoc) {
        const d = regDoc.data();
        const providerName = (d.loginMethod === 'kakao' || regDoc.id.startsWith('kakao_')) ? '카카오' :
                             (d.loginMethod === 'google' || regDoc.id.startsWith('google_')) ? '구글' : '정식';
        return NextResponse.json(
          { error: `${providerName} 연동으로 가입된 회원님입니다! 비회원 로그인이 아닌 하단의 [${providerName} 로그인] 버튼을 클릭하여 접속해주세요.` },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: '일치하는 비회원 정보가 없습니다. 이름, 생년월일, 비밀번호를 확인해주세요.' },
        { status: 401 }
      );
    }

    const userData = matchedDoc.data();
    if (userData.mergedTo) {
      let providerName = '카카오 또는 구글';
      try {
        const mergedDoc = await usersRef.doc(userData.mergedTo).get();
        if (mergedDoc.exists) {
          const mergedData = mergedDoc.data();
          if (mergedData?.loginMethod === 'kakao' || mergedData?.provider === 'kakao') {
            providerName = '카카오';
          } else if (mergedData?.loginMethod === 'google' || mergedData?.provider === 'google') {
            providerName = '구글';
          }
        }
      } catch (e) {
        console.error('Failed to fetch merged user data:', e);
      }
      
      return NextResponse.json(
        { error: `${providerName} 계정으로 정식 회원가입이 완료되었습니다. 하단의 [${providerName} 로그인] 버튼을 이용해주세요.` },
        { status: 403 }
      );
    }

    const uid = matchedDoc.id;

    // Mint custom token
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ token: customToken });

  } catch (error: any) {
    console.error('[Guest Login API] Error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
