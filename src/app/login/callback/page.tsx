'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const authProcessed = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const state = searchParams.get('state') || 'user';
    const isNew = searchParams.get('isNew') === 'true';
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(searchParams.get('message') || '로그인 중 오류가 발생했습니다.');
      return;
    }

    if (!token) {
      if (!authProcessed.current) {
        setStatus('error');
        setErrorMessage('인증 토큰이 누락되었습니다.');
      }
      return;
    }

    if (authProcessed.current) return;
    authProcessed.current = true;

    const finalizeAuth = async () => {
      try {
        // Sign in with Firebase Custom Token received from our API (인앱 브라우저/시크릿 모드 방어 로직 추가)
        let userCredential;
        try {
          userCredential = await signInWithCustomToken(auth, token);
        } catch (signInErr: any) {
          console.warn('First signIn attempt failed, retrying with fallback persistence:', signInErr);
          try {
            const { setPersistence, inMemoryPersistence, browserSessionPersistence } = await import('firebase/auth');
            try {
              await setPersistence(auth, browserSessionPersistence);
            } catch {
              await setPersistence(auth, inMemoryPersistence);
            }
            userCredential = await signInWithCustomToken(auth, token);
          } catch (retryErr: any) {
            throw retryErr || signInErr;
          }
        }
        const user = userCredential.user;
        
        // Parse state for redirectUrl
        let targetState = state;
        let redirectUrl = '/';
        if (state.startsWith('user|')) {
          targetState = 'user';
          redirectUrl = state.split('|')[1] || '/';
        }

        if (targetState === 'admin') {
          toast.success('관리자 로그인 성공!');
          router.replace('/admin');
        } else if (targetState === 'fast_apply') {
          // Fast apply flow: restore saved application data and redirect back
          router.replace('/apply/fast?kakao_done=1');
        } else if (targetState === 'upgrade_guest_done') {
          toast.success('기존 비회원 정보가 성공적으로 연동되었습니다!');
          router.replace('/mypage');
        } else {
          // 신규 가입자거나 필수 정보가 누락된 경우 소셜 프로필 설정 페이지로 이동
          let userData = null;
          try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            userData = userSnap.exists() ? userSnap.data() : null;
          } catch (docErr: any) {
            console.warn('First getDoc attempt failed, retrying after delay...', docErr);
            await new Promise(res => setTimeout(res, 500));
            try {
              const userSnap2 = await getDoc(doc(db, 'users', user.uid));
              userData = userSnap2.exists() ? userSnap2.data() : null;
            } catch (docErr2: any) {
              console.error('getDoc failed completely, proceeding with default redirect:', docErr2);
            }
          }
          const isComplete = userData && userData.gender && userData.birthDate && userData.phone;

          if (isNew || !isComplete) {
            toast.success('회원가입을 위해 추가 정보를 입력해 주세요!');
            router.replace('/register/social-profile');
          } else {
            toast.success('로그인에 성공했습니다!');
            router.replace(redirectUrl);
          }
        }
      } catch (err: any) {
        console.error('Firebase custom token sign-in error:', err);
        setStatus('error');
        const detailMsg = err?.message || err?.code || String(err);
        setErrorMessage(`로그인 인증 처리에 실패했습니다. (원인: ${detailMsg}) 다시 시도해 주세요.`);
        toast.error('로그인 처리에 실패했습니다.');
      }
    };

    finalizeAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <Loader2 size={40} color="#FF6F61" className="animate-spin" />
            <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#FF6F61' }}>로그인 중...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-500" size={32} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#111] tracking-tight">로그인 실패</h2>
              <p className="text-red-500 text-sm px-4 font-medium">{errorMessage}</p>
            </div>
            <button
              onClick={() => router.replace('/login')}
              className="px-8 py-3 bg-[#111] text-white rounded-full transition-all text-sm font-bold shadow-lg active:scale-95"
            >
              로그인 페이지로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <Loader2 size={40} color="#FF6F61" className="animate-spin" />
        <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#FF6F61' }}>로그인 중...</p>
      </div>
    }>
      <KakaoCallbackContent />
    </Suspense>
  );
}
