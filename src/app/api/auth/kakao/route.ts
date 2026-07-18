import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

async function getKakaoProfile(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID || '',
    redirect_uri: redirectUri,
    code,
  });

  if (process.env.KAKAO_CLIENT_SECRET) {
    params.append('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }


  const tokenRes = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: params,
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.error('Kakao Token Error:', tokenData);
    throw new Error(tokenData.error_description || 'Bad credentials');
  }

  const profileRes = await fetch(KAKAO_USER_PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();
  if (profile.error) throw new Error('카카오 프로필 조회 실패');

  return {
    kakaoId: profile.id.toString(),
    nickname: profile.properties?.nickname || profile.kakao_account?.profile?.nickname || '카카오 사용자',
  };
}

async function getOrCreateFirebaseUser(kakaoId: string, nickname: string) {
  const firebaseUid = `kakao_${kakaoId}`;

  // Firebase Auth에 유저가 있는지 확인, 없으면 생성
  try {
    await adminAuth.getUser(firebaseUid);
  } catch {
    await adminAuth.instance.createUser({
      uid: firebaseUid,
      displayName: nickname,
    });
  }

  // Firestore에 유저 문서 확인
  const userRef = adminDb.collection('users').doc(firebaseUid);
  const userDoc = await userRef.get();
  const isNewUser = !userDoc.exists;

  if (isNewUser) {
    const now = new Date();
    const expireAt = new Date(now);
    expireAt.setMonth(expireAt.getMonth() + 3);

    const batch = adminDb.batch();

    batch.set(adminDb.collection('users').doc(firebaseUid), {
      uid: firebaseUid,
      name: nickname,
      isRegistered: true,
      loginMethod: 'kakao',
      provider: 'kakao',
      role: 'user',
      createdAt: now,
    });

    // 신규 카카오 가입 시 웰컴 쿠폰 자동 발급
    const couponRef = adminDb.collection('users').doc(firebaseUid).collection('coupons').doc();
    batch.set(couponRef, {
      title: '웰컴 가입 축하 쿠폰',
      type: 'amount',
      value: 5000,
      isUsed: false,
      createdAt: now,
      expireAt,
    });

    await batch.commit();
  }

  return { firebaseUid, isNewUser, existingData: isNewUser ? null : userDoc.data() };
}

// GET: 리다이렉트 방식 (카카오에서 콜백)
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const KAKAO_REDIRECT_URI = `${origin}/api/auth/kakao`;
  const code = searchParams.get('code');
  const state = searchParams.get('state') || 'user';
  const isAdmin = state === 'admin';

  if (!code) return NextResponse.redirect(`${origin}/login?error=code_missing`);

  try {
    const { kakaoId, nickname } = await getKakaoProfile(code, KAKAO_REDIRECT_URI);
    const { firebaseUid, isNewUser, existingData } = await getOrCreateFirebaseUser(kakaoId, nickname);

    if (isAdmin) {
      const r = existingData?.role;
      if (isNewUser || (r !== 'admin' && r !== 'super_admin')) {
        return NextResponse.redirect(`${origin}/login?error=not_admin`);
      }
    }

    // 비회원 -> 카카오 연동 처리
    let finalState = state;
    if (state.startsWith('upgrade_guest|')) {
      const oldUid = state.split('|')[1];
      if (oldUid) {
        // 기존 비회원 문서 가져오기
        const oldDoc = await adminDb.collection('users').doc(oldUid).get();
        if (oldDoc.exists && oldDoc.data()?.isRegistered === false) {
          const oldData = oldDoc.data()!;
          const batch = adminDb.batch();
          
          // 기존 신청 내역의 userId 업데이트
          const appsSnap = await adminDb.collection('applications').where('userId', '==', oldUid).get();
          appsSnap.forEach(appDoc => {
            batch.update(appDoc.ref, { userId: firebaseUid });
          });
          
          // 기존 비회원 정보를 새 카카오 계정에 병합
          const mergedData: any = { ...oldData, uid: firebaseUid, isRegistered: true, loginMethod: 'kakao', provider: 'kakao', role: 'user', updatedAt: new Date() };
          // 기존 Kakao name 유지 (또는 oldData.name)
          if (oldData.name) mergedData.name = oldData.name;
          // 실수로 병합된 문서가 스스로를 숨기는 것을 방지
          delete mergedData.mergedTo;
          
          batch.set(adminDb.collection('users').doc(firebaseUid), mergedData, { merge: true });
          
          // 이전 문서는 병합됨 표시
          batch.update(adminDb.collection('users').doc(oldUid), { mergedTo: firebaseUid });
          await batch.commit();
        }
      }
      if (state.includes('fast_apply')) {
        finalState = 'fast_apply';
      } else {
        finalState = 'upgrade_guest_done';
      }
    }

    const customToken = await adminAuth.createCustomToken(firebaseUid);
    const targetPath = isAdmin ? '/admin/callback' : '/login/callback';
    return NextResponse.redirect(`${origin}${targetPath}?token=${customToken}&state=${finalState}&isNew=${isNewUser}`);

  } catch (error: any) {
    console.error('Kakao GET Auth Error:', error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`);
  }
}

// POST: 클라이언트에서 직접 호출 방식
export async function POST(req: NextRequest) {
  try {
    const { code, isAdmin } = await req.json();
    const { origin } = new URL(req.url);
    const KAKAO_REDIRECT_URI = `${origin}/api/auth/kakao`;

    if (!code) return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });

    const { kakaoId, nickname } = await getKakaoProfile(code, KAKAO_REDIRECT_URI);
    const { firebaseUid, isNewUser, existingData } = await getOrCreateFirebaseUser(kakaoId, nickname);

    if (isAdmin) {
      const r = existingData?.role;
      if (isNewUser || (r !== 'admin' && r !== 'super_admin')) {
        return NextResponse.json({ error: '관리자 권한이 없는 계정입니다.' }, { status: 403 });
      }
    }

    const customToken = await adminAuth.createCustomToken(firebaseUid);
    return NextResponse.json({ token: customToken, isNewUser });

  } catch (error: any) {
    console.error('Kakao POST Auth Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
