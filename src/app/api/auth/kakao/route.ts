import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
    }

    // 1. Exchange code for access token
    const tokenResponse = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID || '',
        client_secret: process.env.KAKAO_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Kakao token exchange error:', tokenData);
      return NextResponse.json({ error: tokenData.error_description || 'Failed to exchange token' }, { status: 400 });
    }

    const { access_token } = tokenData;

    // 2. Get user profile from Kakao
    const userProfileResponse = await fetch(KAKAO_USER_PROFILE_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = await userProfileResponse.json();

    if (userData.error) {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 400 });
    }

    const kakaoId = userData.id.toString();
    const email = userData.kakao_account?.email;

    if (!email) {
      return NextResponse.json({ error: 'Kakao account must have an email address' }, { status: 400 });
    }

    // 3. Whitelist check: Find admin user in Firestore by email or kakaoId
    // We prioritize email matching as per user request "계정 정보가 기존 관리자 이메일 정보와 일치할 경우 자동으로 연동"
    const usersRef = adminDb.collection('users');
    const qEmail = await usersRef.where('email', '==', email).where('role', '==', 'admin').limit(1).get();
    
    let adminUser = null;
    if (!qEmail.empty) {
      adminUser = qEmail.docs[0];
    } else {
      // Last resort: check by kakaoId if already linked
      const qKakao = await usersRef.where('kakaoId', '==', kakaoId).where('role', '==', 'admin').limit(1).get();
      if (!qKakao.empty) {
        adminUser = qKakao.docs[0];
      }
    }

    if (!adminUser) {
      return NextResponse.json({ 
        error: 'Admin authorization failed. Unauthorized Kakao account.',
        details: '등록된 관리자 이메일과 카카오 계정 이메일이 일치하지 않습니다.'
      }, { status: 403 });
    }

    // 4. Update kakaoId if not already present
    if (!adminUser.data().kakaoId) {
      await adminUser.ref.update({ kakaoId });
    }

    // 5. Generate Firebase Custom Token
    const customToken = await adminAuth.createCustomToken(adminUser.id);

    return NextResponse.json({ token: customToken });

  } catch (error: any) {
    console.error('Kakao Auth Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
