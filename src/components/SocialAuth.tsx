'use client';

import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface SocialAuthProps {
  isAdmin?: boolean;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function SocialAuth({ isAdmin, isLoading, setIsLoading }: SocialAuthProps) {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (isAdmin) {
        // Check for admin role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          toast.success('관리자 구글 로그인 성공!');
          router.push('/admin');
        } else {
          await auth.signOut();
          toast.error('관리 권한이 없는 계정입니다.');
        }
      } else {
        // Regular user check
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          toast.success('구글 계정으로 가입을 진행합니다.');
          router.push('/register?social=true');
        } else {
          toast.success('로그인에 성공했습니다!');
          router.push('/');
        }
      }
    } catch (error: any) {
      console.error('Google Auth Error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
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

  const handleKakaoLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    const redirectUri = 'https://www.keylink.kr/api/auth/kakao';
    const state = isAdmin ? 'admin' : 'user';
    
    if (!clientId) {
      toast.error('카카오 클라이언트 ID가 설정되지 않았습니다.');
      return;
    }

    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}&scope=profile_nickname`;
    window.location.href = kakaoAuthUrl;
  };

  const handleNaverLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
    const redirectUri = 'https://www.keylink.kr/api/auth/naver';
    const state = isAdmin ? 'admin' : 'user';

    if (!clientId) {
      toast.error('네이버 클라이언트 ID가 설정되지 않았습니다.');
      return;
    }

    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
    window.location.href = naverAuthUrl;
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Kakao Login */}
      <button
        onClick={handleKakaoLogin}
        disabled={isLoading}
        className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-full font-bold text-[#191919] transition-all
          ${isLoading ? 'bg-[#FEE500]/60' : 'bg-[#FEE500] hover:bg-[#FADA0A]'}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" />
        </svg>
        카카오로 시작하기
      </button>

      {/* Naver Login */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={handleNaverLogin}
          disabled={isLoading}
          className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-full font-bold text-white transition-all
            ${isLoading ? 'bg-[#03C75A]/60' : 'bg-[#03C75A] hover:bg-[#02b150]'}`}
        >
          <span className="font-black text-xl font-sans">N</span>
          네이버로 시작하기
        </button>
        <p className="text-center text-[11px] text-gray-400 font-medium">
          * 네이버 로그인 시 단체 아이디 연동 불가 (개인 아이디 전용)
        </p>
      </div>

      {/* Google Login */}
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50 transition-all text-[#3c4043] font-bold"
      >
        {isLoading ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Google로 시작하기
          </>
        )}
      </button>
    </div>
  );
}
