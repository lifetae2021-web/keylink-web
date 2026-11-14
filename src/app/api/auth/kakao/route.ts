import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { moveSessionRecords, resolveMergedAccount } from '@/lib/accountMerge';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

async function getKakaoProfile(code: string, redirectUri: string) {
  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
  if (!clientId) {
    console.error('[Kakao Auth] Error: NEXT_PUBLIC_KAKAO_CLIENT_ID is not defined in environment variables.');
    throw new Error('Server Configuration Error: Missing Kakao Client ID');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });

  if (process.env.KAKAO_CLIENT_SECRET) {
    params.append('client_secret', process.env.KAKAO_CLIENT_SECRET);
  } else {
    console.warn('[Kakao Auth] Warning: KAKAO_CLIENT_SECRET is not defined. (It is optional but recommended)');
  }

  let tokenRes;
  try {
    tokenRes = await axios.post(KAKAO_TOKEN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      },
      timeout: 10000,
    });
  } catch (err: any) {
    console.error('[Kakao Auth] Token axios failed:', err.message);
    if (err.cause) console.error('[Kakao Auth] Token axios error cause:', err.cause);
    if (err.response) {
      console.error(`[Kakao Auth] Token error status: ${err.response.status}`);
      console.error(`[Kakao Auth] Token error data:`, err.response.data);
    }
    throw new Error(`Token fetch failed: ${err.message}`);
  }

  const tokenData = tokenRes.data;
  if (tokenData.error) {
    console.error('[Kakao Auth] Kakao Token Error response:', tokenData);
    throw new Error(tokenData.error_description || 'Kakao Token Error');
  }

  let profileRes;
  try {
    profileRes = await axios.get(KAKAO_USER_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      },
      timeout: 10000,
    });
  } catch (err: any) {
    console.error('[Kakao Auth] Profile axios failed:', err.message);
    if (err.cause) console.error('[Kakao Auth] Profile axios error cause:', err.cause);
    if (err.response) {
      console.error(`[Kakao Auth] Profile error status: ${err.response.status}`);
      console.error(`[Kakao Auth] Profile error data:`, err.response.data);
    }
    throw new Error(`Profile fetch failed: ${err.message}`);
  }

  const profile = profileRes.data;
  if (profile.error) {
    console.error('[Kakao Auth] Kakao Profile Error response:', profile);
    throw new Error('카카오 프로필 조회 실패');
  }

  return {
    kakaoId: profile.id.toString(),
    nickname: profile.properties?.nickname || profile.kakao_account?.profile?.nickname || '카카오 사용자',
    email: profile.kakao_account?.email || null,
  };
}

async function getOrCreateFirebaseUser(kakaoId: string, nickname: string, email: string | null) {
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

  // Firestore에 유저 문서 확인 및 생성 (트랜잭션으로 동시성 이슈 방지)
  const userRef = adminDb.collection('users').doc(firebaseUid);
  
  const result = await adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const isNewUser = !userDoc.exists;

    if (isNewUser) {
      const now = new Date();
      const expireAt = new Date(now);
      expireAt.setMonth(expireAt.getMonth() + 3);

      transaction.set(userRef, {
        uid: firebaseUid,
        name: nickname,
        isRegistered: true,
        loginMethod: 'kakao',
        provider: 'kakao',
        role: 'user',
        createdAt: now,
        updatedAt: now,
        kakaoEmail: email,
      });

      // 신규 카카오 가입 시 웰컴 쿠폰 자동 발급
      const couponRef = userRef.collection('coupons').doc();
      transaction.set(couponRef, {
        title: '웰컴 가입 축하 쿠폰',
        type: 'amount',
        value: 5000,
        isUsed: false,
        createdAt: now,
        expireAt,
      });
      
      return { firebaseUid, isNewUser: true, existingData: null };
    } else {
      // 기존 유저인 경우에도 이메일 정보 업데이트
      if (email && userDoc.data()?.kakaoEmail !== email) {
        transaction.update(userRef, { kakaoEmail: email });
      }
      return { firebaseUid, isNewUser: false, existingData: userDoc.data() };
    }
  });

  return result;
}

// GET: 리다이렉트 방식 (카카오에서 콜백)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || 'user';
  const errorParam = searchParams.get('error');
  const origin = new URL(request.url).origin;
  const isAdmin = state === 'admin';

  if (errorParam) {
    const errorDesc = searchParams.get('error_description');
    console.error('[Kakao Auth] User cancelled or error occurred:', errorParam, errorDesc);
    // Redirect to login with error parameter
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorParam)}&message=${encodeURIComponent(errorDesc || '')}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  try {
    const redirectUri = `${origin}/api/auth/kakao`;
    const profile = await getKakaoProfile(code, redirectUri);
    const { firebaseUid, isNewUser, existingData } = await getOrCreateFirebaseUser(profile.kakaoId, profile.nickname, profile.email);

    if (isAdmin) {
      const r = existingData?.role;
      if (isNewUser || (r !== 'admin' && r !== 'super_admin')) {
        return NextResponse.redirect(`${origin}/login?error=not_admin`);
      }
    }

    // 휴대폰 인증으로 다른 계정에 연결된 카카오 계정이면 연결된 계정으로 로그인시킨다
    const mergedTarget = isNewUser ? null : await resolveMergedAccount(firebaseUid);
    const loginUid = mergedTarget || firebaseUid;

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
          const sessionIds: string[] = [];
          appsSnap.forEach(appDoc => {
            sessionIds.push(appDoc.data().sessionId);
            batch.update(appDoc.ref, { userId: loginUid });
          });
          
          // 투표(내가 한 투표 + 남이 나를 고른 투표)와 이미 계산된 매칭 결과의 ID도 새 계정으로
          await moveSessionRecords(batch, sessionIds, oldUid, loginUid);
          
          // 기존 비회원 정보를 새 카카오 계정에 병합
          const mergedData: any = { ...oldData, uid: loginUid, isRegistered: true, loginMethod: 'kakao', provider: 'kakao', role: 'user', updatedAt: new Date() };
          // 기존 Kakao name 유지 (또는 oldData.name)
          if (oldData.name) mergedData.name = oldData.name;
          // 실수로 병합된 문서가 스스로를 숨기는 것을 방지
          delete mergedData.mergedTo;
          // 연결된 기존 계정으로 합칠 때는 그 계정의 가입 방식·가입일·아이디를 유지
          if (mergedTarget) {
            delete mergedData.loginMethod;
            delete mergedData.provider;
            delete mergedData.createdAt;
            delete mergedData.username;
          }
          
          batch.set(adminDb.collection('users').doc(loginUid), mergedData, { merge: true });
          
          // 이전 문서는 병합됨 표시
          batch.update(adminDb.collection('users').doc(oldUid), { mergedTo: loginUid });
          await batch.commit();
        }
      }
      if (state.includes('fast_apply')) {
        finalState = 'fast_apply';
      } else {
        finalState = 'upgrade_guest_done';
      }
    }

    const customToken = await adminAuth.createCustomToken(loginUid);
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

    const { kakaoId, nickname, email } = await getKakaoProfile(code, KAKAO_REDIRECT_URI);
    const { firebaseUid, isNewUser, existingData } = await getOrCreateFirebaseUser(kakaoId, nickname, email);

    if (isAdmin) {
      const r = existingData?.role;
      if (isNewUser || (r !== 'admin' && r !== 'super_admin')) {
        return NextResponse.json({ error: '관리자 권한이 없는 계정입니다.' }, { status: 403 });
      }
    }

    const mergedTarget = isNewUser ? null : await resolveMergedAccount(firebaseUid);
    const customToken = await adminAuth.createCustomToken(mergedTarget || firebaseUid);
    return NextResponse.json({ token: customToken, isNewUser });

  } catch (error: any) {
    console.error('Kakao POST Auth Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
