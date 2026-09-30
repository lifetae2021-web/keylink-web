'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileGuard() {
  const pathname = usePathname();
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
  }, [user, userData, profileLoading, pathname]);

  return null;
}
