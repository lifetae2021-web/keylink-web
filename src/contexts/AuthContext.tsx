'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

interface AuthContextValue {
  user: User | null;
  userData: any | null;
  isAdmin: boolean;
  coupons: any[]; // 유효(미사용, 미만료) 쿠폰 목록
  authLoading: boolean; // 로그인 상태 확인 중
  profileLoading: boolean; // users/{uid} 문서 로딩 중
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  isAdmin: false,
  coupons: [],
  authLoading: true,
  profileLoading: true,
});

function resolveCouponExpireAt(data: any): Date | null {
  const raw = data.expireAt || data.expiresAt;
  if (raw) return raw.toDate ? raw.toDate() : new Date(raw);
  if (data.validityMonths && data.validityMonths !== 'unlimited' && data.createdAt) {
    const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const exp = new Date(created);
    exp.setMonth(exp.getMonth() + Number(data.validityMonths));
    return exp;
  }
  return null;
}

// 로그인 유저 문서(users/{uid})와 보유 쿠폰 목록을 앱 전체에서 하나의 구독으로 공유한다.
// Navbar/ProfileGuard 등 여러 컴포넌트가 각자 같은 문서를 중복으로 읽던 걸 통합.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setUserData(null);
        setCoupons([]);
        setProfileLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setUserData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setProfileLoading(false);
    });

    const couponsQ = query(collection(db, 'users', user.uid, 'coupons'), where('isUsed', '==', false));
    const unsubCoupons = onSnapshot(couponsQ, (snap) => {
      const now = new Date();
      const valid = snap.docs
        .map(d => {
          const data = d.data();
          const expireAt = resolveCouponExpireAt(data);
          let title = data.title || data.name || '할인 쿠폰';
          if (title === '가입 축하 5,000원 할인쿠폰') title = '웰컴 가입 축하 쿠폰';
          return { id: d.id, ...data, expireAt, title };
        })
        .filter(c => !c.expireAt || c.expireAt > now);
      setCoupons(valid);
    });

    return () => { unsubUser(); unsubCoupons(); };
  }, [user]);

  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, userData, isAdmin, coupons, authLoading, profileLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
