'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, AlertCircle, Heart } from 'lucide-react';
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
        // Sign in with Firebase Custom Token received from our API
        const userCredential = await signInWithCustomToken(auth, token);
        const user = userCredential.user;
        
        if (state === 'admin') {
          toast.success('관리자 로그인 성공!');
          router.replace('/admin');
        } else {
          // Check if user exists in Firestore (v3.5.6)
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          
          if (userSnap.exists()) {
            toast.success('로그인에 성공했습니다!');
            router.replace('/');
          } else {
            console.log('New User Detected');
            toast.success('환영합니다! 필수 정보를 입력해 주세요.');
            router.replace('/register/social-profile');
          }
        }
      } catch (err: any) {
        console.error('Firebase custom token sign-in error:', err);
        setStatus('error');
        setErrorMessage('로그인 인증 처리에 실패했습니다. 다시 시도해 주세요.');
        toast.error('로그인 처리에 실패했습니다.');
      }
    };

    finalizeAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-[#FF6F61]/20 border-t-[#FF6F61] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Heart className="text-[#FF6F61] animate-pulse" size={24} fill="#FF6F61" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-[#111] tracking-tight">키링크 로그인 중</h2>
              <p className="text-gray-500 text-sm font-medium">안전하게 본인 인증을 마무리하고 있습니다.</p>
            </div>
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
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#FF6F61]/20 border-t-[#FF6F61] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="text-[#FF6F61] animate-pulse" size={24} fill="#FF6F61" />
          </div>
        </div>
      </div>
    }>
      <KakaoCallbackContent />
    </Suspense>
  );
}
