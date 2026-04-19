'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminKakaoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const authProcessed = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(searchParams.get('message') || '관리자 로그인 중 오류가 발생했습니다.');
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
        // Sign in with Firebase Custom Token
        await signInWithCustomToken(auth, token);
        toast.success('관리자 인증 성공');
        router.replace('/admin');
      } catch (err: any) {
        console.error('Firebase custom token sign-in error:', err);
        setStatus('error');
        setErrorMessage('관리자 인증 처리에 실패했습니다.');
        toast.error('인증 처리에 실패했습니다.');
      }
    };

    finalizeAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1115] px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="text-blue-500" size={24} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">관리자 권한 확인 중</h2>
              <p className="text-gray-400 text-sm">보안 세션을 설정하고 있습니다.</p>
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
              <h2 className="text-xl font-bold text-white tracking-tight">인증 실패</h2>
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
