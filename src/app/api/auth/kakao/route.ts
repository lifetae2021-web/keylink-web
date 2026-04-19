import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || 'user';
  const isAdmin = state === 'admin';
  const redirectUri = `${origin}/api/auth/kakao`;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=code_missing`);
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch(KAKAO_TOKEN_URL, {
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

    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    const { access_token } = tokenData;

    // 2. Get user profile
    const userProfileResponse = await fetch(KAKAO_USER_PROFILE_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userData = await userProfileResponse.json();
    if (userData.error) throw new Error('Failed to fetch user profile');

    const kakaoId = userData.id.toString();
    const email = userData.kakao_account?.email || null;
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname || '카카오 사용자';

    // 3. Firestore Logic - Prioritize Kakao ID
    const usersRef = adminDb.collection('users');
    
    // Check if user exists by kakaoId
    const qId = await usersRef.where('kakaoId', '==', kakaoId).limit(1).get();
    
    let targetUid = `kakao_${kakaoId}`;
    let userDoc = null;

    if (!qId.empty) {
      userDoc = qId.docs[0];
      targetUid = userDoc.id;
      
      if (isAdmin && userDoc.data().role !== 'admin') {
        return NextResponse.redirect(`${origin}/login?error=not_admin`);
      }
    } else if (email) {
      // Fallback: check by email if available
      const qEmail = await usersRef.where('email', '==', email).limit(1).get();
      if (!qEmail.empty) {
        userDoc = qEmail.docs[0];
        targetUid = userDoc.id;
        if (isAdmin && userDoc.data().role !== 'admin') {
          return NextResponse.redirect(`${origin}/login?error=not_admin`);
        }
        // Link kakaoId to existing account
        await userDoc.ref.update({ kakaoId, updatedBy: 'kakao-login' });
      }
    }

    if (!userDoc) {
      if (isAdmin) return NextResponse.redirect(`${origin}/login?error=not_admin_registered`);
      
      const newUser = {
        uid: targetUid,
        email: email, // Could be null
        name: nickname,
        role: 'user',
        kakaoId,
        provider: 'kakao',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await usersRef.doc(targetUid).set(newUser);
    }

    // 4. Generate Token & Redirect
    const customToken = await adminAuth.createCustomToken(targetUid);
    const targetPath = isAdmin ? '/admin/callback' : '/login/callback';
    return NextResponse.redirect(`${origin}${targetPath}?token=${customToken}&state=${state}`);

  } catch (error: any) {
    console.error('Kakao Redirect Auth Error:', error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, redirectUri, isAdmin } = await req.json();

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
    const email = userData.kakao_account?.email || null;
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname || '카카오 사용자';

    // 3. Firestore Logic - Prioritize Kakao ID
    const usersRef = adminDb.collection('users');
    const qId = await usersRef.where('kakaoId', '==', kakaoId).limit(1).get();
    
    let targetUid = `kakao_${kakaoId}`;
    let userDoc = null;

    if (!qId.empty) {
      userDoc = qId.docs[0];
      targetUid = userDoc.id;

      if (isAdmin && userDoc.data().role !== 'admin') {
        return NextResponse.json({ 
          error: 'Admin authorization failed.',
          details: '관리자 권한이 없는 계정입니다.'
        }, { status: 403 });
      }
    } else if (email) {
      // Fallback: check by email if available
      const qEmail = await usersRef.where('email', '==', email).limit(1).get();
      if (!qEmail.empty) {
        userDoc = qEmail.docs[0];
        targetUid = userDoc.id;
        if (isAdmin && userDoc.data().role !== 'admin') {
          return NextResponse.json({ 
            error: 'Admin authorization failed.',
            details: '관리자 권한이 없는 계정입니다.'
          }, { status: 403 });
        }
        // Link kakaoId to existing account
        await userDoc.ref.update({ kakaoId, updatedBy: 'kakao-login' });
      }
    }

    if (!userDoc) {
      if (isAdmin) {
        return NextResponse.json({ 
          error: 'Admin authorization failed.',
          details: '등록된 관리자 정보가 없습니다.'
        }, { status: 403 });
      }

      // 4. Create new user
      const newUser = {
        uid: targetUid,
        email: email,
        name: nickname,
        role: 'user',
        kakaoId,
        provider: 'kakao',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await usersRef.doc(targetUid).set(newUser);
    }

    // 5. Generate Firebase Custom Token
    const customToken = await adminAuth.createCustomToken(targetUid);

    return NextResponse.json({ token: customToken });

  } catch (error: any) {
    console.error('Kakao Auth Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
