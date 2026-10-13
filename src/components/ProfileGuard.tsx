'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidBirthDate, normalizeBirthDate } from '@/lib/utils';

const BIRTH_NOTICE_KEY = 'kl_birth_notice_shown';

export default function ProfileGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userData, profileLoading } = useAuth();

  useEffect(() => {
    // 1. If not logged in, nothing to guard (PublicLayout handles public pages)
    if (!user || profileLoading) return;

    // 2. Avoid infinite redirect loop if already on profile or auth pages
    const isAuthPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/login/callback');
    const isProfilePage = pathname === '/register/social-profile';
    const isAdminPage = pathname.startsWith('/admin');

    if (isProfilePage || isAuthPage || isAdminPage) return;

    const isNewUser = !userData;
    const isIncomplete = userData && (!userData.gender || !userData.birthDate || !userData.phone);

    // 사용자가 "프로필 입력 없이 카카오 인증만으로 가입/이용"을 원하므로 강제 리다이렉트 해제
    if (isNewUser || isIncomplete) {
      console.log('New User Detected, but skipping forced profile redirect per user request.');
      // router.replace('/register/social-profile');
    }

    // 생년월일이 저장돼 있지만 형식이 깨진 회원에게는 이동을 강제하지 않고 안내만 한다 (세션당 1회)
    // 비회원도 마이페이지의 '내 프로필 수정하기'에서 생년월일을 고칠 수 있으므로 회원/비회원 모두 안내
    const birthDate = userData?.birthDate;
    if (birthDate && pathname !== '/mypage' && !isValidBirthDate(normalizeBirthDate(birthDate))) {
      try {
        if (sessionStorage.getItem(BIRTH_NOTICE_KEY)) return;
        sessionStorage.setItem(BIRTH_NOTICE_KEY, '1');
      } catch {}
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>생년월일이 올바르게 저장되어 있지 않아요.</span>
          <span style={{ fontSize: '0.85rem' }}>아래 버튼을 눌러 프로필의 생년월일을 수정해 주세요.</span>
          <button
            onClick={() => { toast.dismiss(t.id); router.push('/mypage?mode=edit'); }}
            style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, background: '#FF7E7E', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}
          >
            수정하러 가기
          </button>
        </div>
      ), { duration: 12000 });
    }
  }, [user, userData, profileLoading, pathname, router]);

  return null;
}
