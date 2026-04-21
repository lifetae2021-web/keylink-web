'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfileGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const checking = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // 1. If not logged in, nothing to guard (PublicLayout handles public pages)
      if (!user) return;

      // 2. Avoid infinite redirect loop if already on profile or auth pages
      const isAuthPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/login/callback');
      const isProfilePage = pathname === '/register/social-profile';
      const isAdminPage = pathname.startsWith('/admin');

      if (isProfilePage || isAuthPage || isAdminPage) return;

      if (checking.current) return;
      checking.current = true;

      try {
        // 3. Fetch user profile from Firestore
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        
        const isNewUser = !userSnap.exists();
        const data = userSnap.data();
        const isIncomplete = data && (!data.gender || !data.birthDate || !data.phone);

        if (isNewUser || isIncomplete) {
          console.log('New User Detected');
          router.replace('/register/social-profile');
        }
      } catch (error) {
        console.error('Profile guard error:', error);
      } finally {
        checking.current = false;
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return null;
}
