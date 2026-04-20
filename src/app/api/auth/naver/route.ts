import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_USER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || 'user';
  const isAdmin = state === 'admin';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=code_missing`);
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch(NAVER_TOKEN_URL + `?grant_type=authorization_code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&client_secret=${process.env.NAVER_CLIENT_SECRET}&code=${code}&state=${state}`, {
      method: 'GET',
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error_description || 'Token fetch failed');

    const { access_token } = tokenData;

    // 2. Get user profile
    const userProfileResponse = await fetch(NAVER_USER_PROFILE_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    const userData = await userProfileResponse.json();
    if (userData.resultcode !== '00') throw new Error(userData.message || 'Failed to fetch user profile');

    const naverId = userData.response.id.toString();
    const nickname = userData.response.nickname || userData.response.name || '네이버 사용자';

    // 3. Firestore Logic
    const usersRef = adminDb.collection('users');
    const targetUid = `naver_${naverId}`;
    
    const userDocRef = usersRef.doc(targetUid);
    const userDocSnap = await userDocRef.get();

    if (userDocSnap.exists) {
      // User exists
      if (isAdmin && userDocSnap.data()?.role !== 'admin') {
        return NextResponse.redirect(`${origin}/login?error=not_admin`);
      }
    } else {
      // New User
      if (isAdmin) return NextResponse.redirect(`${origin}/login?error=not_admin_registered`);
      
      const newUser = {
        uid: targetUid,
        name: nickname,
        role: 'user',
        naverId,
        provider: 'naver',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await userDocRef.set(newUser);
    }

    // 4. Generate Token & Redirect
    const customToken = await adminAuth.createCustomToken(targetUid);
    const targetPath = isAdmin ? '/admin/callback' : '/login/callback';
    return NextResponse.redirect(`${origin}${targetPath}?token=${customToken}&state=${state}`);

  } catch (error: any) {
    console.error('Naver Redirect Auth Error:', error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, state, isAdmin } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
    }

    // 1. Exchange code for access token
    const tokenResponse = await fetch(NAVER_TOKEN_URL + `?grant_type=authorization_code&client_id=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&client_secret=${process.env.NAVER_CLIENT_SECRET}&code=${code}&state=${state || 'user'}`, {
      method: 'GET',
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Naver token exchange error:', tokenData);
      return NextResponse.json({ error: tokenData.error_description || 'Failed to exchange token' }, { status: 400 });
    }

    const { access_token } = tokenData;

    // 2. Get user profile
    const userProfileResponse = await fetch(NAVER_USER_PROFILE_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = await userProfileResponse.json();

    if (userData.resultcode !== '00') {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 400 });
    }

    const naverId = userData.response.id.toString();
    const nickname = userData.response.nickname || userData.response.name || '네이버 사용자';

    // 3. Firestore Logic
    const usersRef = adminDb.collection('users');
    const targetUid = `naver_${naverId}`;
    
    const userDocRef = usersRef.doc(targetUid);
    const userDocSnap = await userDocRef.get();

    if (userDocSnap.exists) {
      if (isAdmin && userDocSnap.data()?.role !== 'admin') {
        return NextResponse.json({ 
          error: 'Admin authorization failed.',
          details: '관리자 권한이 없는 계정입니다.'
        }, { status: 403 });
      }
    } else {
      if (isAdmin) {
        return NextResponse.json({ 
          error: 'Admin authorization failed.',
          details: '등록된 관리자 정보가 없습니다.'
        }, { status: 403 });
      }

      // 4. Create new user
      const newUser = {
        uid: targetUid,
        name: nickname,
        role: 'user',
        naverId,
        provider: 'naver',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await userDocRef.set(newUser);
    }

    // 5. Generate Firebase Custom Token
    const customToken = await adminAuth.createCustomToken(targetUid);

    return NextResponse.json({ token: customToken });

  } catch (error: any) {
    console.error('Naver Auth Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
