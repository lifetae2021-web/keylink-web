'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function KakaoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const authProcessed = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(searchParams.get('error_description') || '카카오 로그인 중 오류가 발생했습니다.');
      return;
    }

    if (!code) {
      if (!authProcessed.current) {
        setStatus('error');
        setErrorMessage('인증 코드가 누락되었습니다.');
      }
      return;
    }

    if (authProcessed.current) return;
    authProcessed.current = true;

    const processAuth = async () => {
      try {
        const state = searchParams.get('state') || 'user';
        const isAdmin = state === 'admin';
        const redirectUri = window.location.origin + '/admin/login/callback';
        
        const response = await fetch('/api/auth/kakao', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, redirectUri, isAdmin }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || data.error || '인증 처리에 실패했습니다.');
        }

        // Sign in with Firebase Custom Token
        await signInWithCustomToken(auth, data.token);
        
        if (isAdmin) {
          toast.success('관리자 카카오 로그인 성공!');
          router.replace('/admin');
        } else {
          toast.success('카카오 로그인 성공!');
          router.replace('/');
        }
      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('error');
        setErrorMessage(err.message || '로그인 처리 중 오류가 발생했습니다.');
        
        const state = searchParams.get('state') || 'user';
        if (state === 'admin') {
          toast.error(err.message || '관리자 권한 확인에 실패했습니다.');
        } else {
          toast.error(err.message || '카카오 로그인에 실패했습니다.');
        }
      }
    };

    processAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1115] px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-[#FEE500]/20 border-t-[#FEE500] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 3C5.582 3 2 5.8 2 9.25C2 11.45 3.45 13.4 5.65 14.5C5.55 14.85 5.15 16.15 5.1 16.45C5.05 16.75 5.25 16.75 5.4 16.65C5.55 16.55 7.4 15.35 8.2 14.8C8.8 14.95 9.4 15.05 10 15.05C14.418 15.05 18 12.25 18 8.8C18 5.35 14.418 2.55 10 2.55V3Z" fill="#FEE500"/>
                  </svg>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">카카오 로그인 처리 중</h2>
              <p className="text-gray-400 text-sm">잠시만 기다려 주세요...</p>
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
              <h2 className="text-xl font-bold text-white tracking-tight">로그인 실패</h2>
              <p className="text-red-400 text-sm px-4">{errorMessage}</p>
            </div>
            <button
              onClick={() => router.replace('/admin/login')}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              로그인 페이지로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
