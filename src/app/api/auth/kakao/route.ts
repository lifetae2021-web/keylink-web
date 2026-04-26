import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

async function getKakaoProfile(code: string, redirectUri: string) {
  const tokenRes = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID || '',
      client_secret: process.env.KAKAO_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error_description);

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
  const userDoc = await adminDb.collection('users').doc(firebaseUid).get();
  const isNewUser = !userDoc.exists;

  return { firebaseUid, isNewUser, existingData: userDoc.data() };
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
      if (isNewUser || existingData?.role !== 'admin') {
        return NextResponse.redirect(`${origin}/login?error=not_admin`);
      }
    }

    const customToken = await adminAuth.createCustomToken(firebaseUid);
    const targetPath = isAdmin ? '/admin/callback' : '/login/callback';
    return NextResponse.redirect(`${origin}${targetPath}?token=${customToken}&state=${state}&isNew=${isNewUser}`);

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
      if (isNewUser || existingData?.role !== 'admin') {
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
