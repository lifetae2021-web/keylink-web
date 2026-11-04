import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimitOr429, clientIp } from '@/lib/rateLimit';
import { checkGuestPw, hashGuestPw } from '@/lib/guestPassword';

export async function POST(request: Request) {
  try {
    const { guestName, guestId, guestPw } = await request.json();

    if (!guestName || !guestId || !guestPw) {
      return NextResponse.json({ error: '이름, 생년월일, 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    // 비밀번호 대입 방지: IP당 15분 20회 + 같은 생년월일(guestId) 15분 10회
    const limited = await rateLimitOr429([
      ['guest-login-ip', clientIp(request), 20, 900000],
      ['guest-login-id', String(guestId), 10, 900000],
    ]);
    if (limited) return limited;

    // 같은 생년월일(guestId) 후보만 가져와서, 이름이 맞는 사람의 비밀번호를 해시로 비교
    // (비밀번호는 해시라서 DB 쿼리로 찾을 수 없다. 변환 전 평문은 checkGuestPw 가 처리)
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef.where('guestId', '==', String(guestId)).get();
    const pw = String(guestPw);

    // 대소문자 무시하고 이름 비교 (숫자가 붙은 이름도 허용 예: 박하린2 -> 박하린)
    const checkNameMatch = (dbNameStr: string, inputNameStr: string) => {
      const dbN = dbNameStr.toLowerCase().trim();
      const inN = inputNameStr.toLowerCase().trim();
      return dbN === inN || dbN.replace(/[0-9]/g, '') === inN;
    };

    let matchedDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let regDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let legacy = false;
    for (const doc of snapshot.docs) {
      const d = doc.data();
      if (!checkNameMatch(String(d.name || ''), String(guestName))) continue;
      const r = await checkGuestPw(pw, d);
      if (!r.ok) continue;
      if (d.isRegistered === false) { matchedDoc = doc; legacy = r.legacy; break; }
      regDoc = regDoc || doc; // 정식 가입 회원(카카오/구글)이 비회원 폼에서 로그인 시도
    }

    if (!matchedDoc) {
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

    // 아직 평문으로 저장돼 있던 비밀번호는 로그인 성공 시 해시로 바꾼다
    if (legacy) {
      await matchedDoc.ref.update({ guestPwHash: await hashGuestPw(pw), guestPw: FieldValue.delete() })
        .catch((e) => console.error('[Guest Login API] pw upgrade', e));
    }

    // Mint custom token
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ token: customToken });

  } catch (error: any) {
    console.error('[Guest Login API] Error:', error.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
