'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  linkWithCredential,
  OAuthCredential,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Loader2, X } from 'lucide-react';

interface SocialAuthProps {
  isAdmin?: boolean;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  lastMethod?: string | null;
}

export default function SocialAuth({ isAdmin, isLoading, setIsLoading, lastMethod }: SocialAuthProps) {
  const router = useRouter();

  // 계정 연동 모달 상태
  const [linkModal, setLinkModal] = useState<{
    email: string;
    credential: OAuthCredential;
  } | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      localStorage.setItem('keylink_last_login_method', 'google');

      if (isAdmin) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          toast.success('관리자 구글 로그인 성공!');
          router.push('/admin');
        } else {
          await auth.signOut();
          toast.error('관리 권한이 없는 계정입니다.');
        }
      } else {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          toast.success('환영합니다! 필수 정보를 입력해 주세요.');
          router.push('/register/social-profile');
        } else {
          toast.success('로그인에 성공했습니다!');
          router.push('/');
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        // 동일 이메일 기존 계정 존재 → 연동 모달 표시
        const email = error.customData?.email || '';
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (email && credential) {
          setLinkModal({ email, credential });
        } else {
          toast.error('계정 연동 중 오류가 발생했습니다.');
        }
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('로그인이 취소되었습니다.');
      } else if (error.code === 'auth/configuration-not-found') {
        toast.error('Firebase 콘솔에서 Google 로그인을 활성화해 주세요.');
      } else {
        toast.error('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!linkModal || !linkPassword) return;
    setLinkLoading(true);
    setLinkError('');

    try {
      // 1. 기존 이메일/비밀번호로 로그인
      const result = await signInWithEmailAndPassword(auth, linkModal.email, linkPassword);

      // 2. 구글 계정 연동
      await linkWithCredential(result.user, linkModal.credential);

      // 3. Firestore에 구글 연동 정보 업데이트
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { linkedProviders: ['email', 'google'] });
      }

      localStorage.setItem('keylink_last_login_method', 'google');
      toast.success('구글 계정 연동이 완료되었습니다! 이제 두 방법 모두 로그인 가능합니다.');
      setLinkModal(null);
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLinkError('비밀번호가 올바르지 않습니다.');
      } else if (error.code === 'auth/too-many-requests') {
        setLinkError('시도 횟수가 초과되었습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setLinkError('연동 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const handleKakaoLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/auth/kakao`;
    const state = isAdmin ? 'admin' : 'user';

    if (!clientId) {
      toast.error('카카오 클라이언트 ID가 설정되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}&scope=profile_nickname`;
    setTimeout(() => { window.location.href = kakaoAuthUrl; }, 300);
  };

  return (
    <>
      <div className="flex items-center justify-center gap-5 w-full pt-2">
        {/* Kakao Login */}
        <div style={{ position: 'relative' }}>
          {lastMethod === 'kakao' && (
            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', fontSize: '0.55rem', padding: '1px 5px', borderRadius: '3px', fontWeight: '800', zIndex: 10, whiteSpace: 'nowrap' }}>최근 사용</div>
          )}
          <button
            onClick={() => {
              localStorage.setItem('keylink_last_login_method', 'kakao');
              handleKakaoLogin();
            }}

            disabled={isLoading}
            style={{ width: '54px', height: '54px', background: '#FEE500' }}
            className="flex items-center justify-center rounded-full hover:brightness-95 transition-all shadow-sm"
            title="카카오 로그인"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#3c1e1e">
              <path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" />
            </svg>
          </button>
        </div>

        {/* Google Login */}
        <div style={{ position: 'relative' }}>
          {lastMethod === 'google' && (
            <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', fontSize: '0.55rem', padding: '1px 5px', borderRadius: '3px', fontWeight: '800', zIndex: 10, whiteSpace: 'nowrap' }}>최근 사용</div>
          )}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{ width: '54px', height: '54px' }}
            className="flex items-center justify-center bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all shadow-sm"
            title="구글 로그인"
          >
            <svg width="22" height="22" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 계정 연동 모달 */}
      {linkModal && (
        <div
          onClick={() => { setLinkModal(null); setLinkPassword(''); setLinkError(''); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', marginBottom: '6px' }}>구글 계정 연동</h2>
                <p style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.5 }}>
                  <strong style={{ color: '#111' }}>{linkModal.email}</strong>로 이미 가입된 계정이 있습니다.<br />
                  비밀번호를 입력하면 구글 계정과 연동됩니다.
                </p>
              </div>
              <button
                onClick={() => { setLinkModal(null); setLinkPassword(''); setLinkError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <input
              type="password"
              placeholder="기존 계정 비밀번호"
              value={linkPassword}
              onChange={e => { setLinkPassword(e.target.value); setLinkError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLinkAccount()}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '12px', fontSize: '0.9rem',
                border: linkError ? '1.5px solid #FF6F61' : '1.5px solid #eee',
                background: linkError ? '#FFF5F4' : '#fafafa',
                outline: 'none', boxSizing: 'border-box',
              }}
              autoFocus
            />
            {linkError && (
              <p style={{ color: '#FF6F61', fontSize: '0.78rem', fontWeight: '700', marginTop: '8px' }}>{linkError}</p>
            )}

            <button
              onClick={handleLinkAccount}
              disabled={linkLoading || !linkPassword}
              style={{
                width: '100%', marginTop: '16px', padding: '14px',
                borderRadius: '100px', border: 'none', cursor: linkPassword ? 'pointer' : 'not-allowed',
                background: linkPassword ? '#FF6F61' : '#ddd',
                color: '#fff', fontWeight: '800', fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {linkLoading ? <Loader2 size={18} className="animate-spin" /> : '연동하고 로그인'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
