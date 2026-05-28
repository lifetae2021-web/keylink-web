import { NextResponse } from 'next/server';
// Force Turbopack cache invalidation
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { name, phone } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ error: '이름과 전화번호를 입력해주세요.' }, { status: 400 });
    }

    // 하이픈이 없이 숫자만 입력된 경우 자동 변환 (예: 01012345678 -> 010-1234-5678)
    let formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.length === 11) {
      formattedPhone = `${formattedPhone.slice(0, 3)}-${formattedPhone.slice(3, 7)}-${formattedPhone.slice(7)}`;
    } else {
      formattedPhone = phone; // 길이나 형태가 다를 경우 원본 사용 (혹시 모를 예외 대비)
    }

    // users 컬렉션에서 name과 phone이 일치하는 유저 찾기
    const usersRef = adminDb.collection('users');
    const q = usersRef.where('name', '==', name).where('phone', '==', formattedPhone).limit(1);
    const snapshot = await q.get();

    if (snapshot.empty) {
      return NextResponse.json({ error: '일치하는 회원 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const userId = snapshot.docs[0].data().username; // 로그인에 쓰이는 실제 아이디는 username 필드에 저장됨

    // 스마트 마스킹 처리 (기본: 앞 3글자, 뒤 2글자 노출)
    let maskedId = userId;
    const len = userId.length;
    
    if (len >= 6) {
      // 6글자 이상: 앞 3글자 + (나머지 별표) + 뒤 2글자 (예: lifetae2021 -> lif******21)
      maskedId = userId.substring(0, 3) + '*'.repeat(len - 5) + userId.substring(len - 2);
    } else if (len === 5) {
      // 5글자: 앞 2글자 + 별 2개 + 뒤 1글자 (예: hello -> he**o)
      maskedId = userId.substring(0, 2) + '**' + userId.substring(len - 1);
    } else if (len === 4) {
      // 4글자: 앞 1글자 + 별 2개 + 뒤 1글자 (예: test -> t**t)
      maskedId = userId.substring(0, 1) + '**' + userId.substring(len - 1);
    } else if (len === 3) {
      // 3글자: 앞 1글자 + 별 1개 + 뒤 1글자 (예: jsy -> j*y)
      maskedId = userId.substring(0, 1) + '*' + userId.substring(len - 1);
    } else if (len > 1) {
      // 2글자: 앞 1글자 + 별 1개
      maskedId = userId.substring(0, 1) + '*';
    }

    return NextResponse.json({ maskedId });
  } catch (error: any) {
    console.error('Find ID Error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
