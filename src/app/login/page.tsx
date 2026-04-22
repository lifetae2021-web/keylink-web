'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import SocialAuth from '@/components/SocialAuth';
import { getAuthErrorMessage } from '@/lib/auth-errors';

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Show error messages from URL (e.g. from Kakao OAuth callback)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    if (errorParam) {
      if (messageParam) {
        toast.error(`카카오 로그인 오류: ${messageParam}`);
      } else {
        toast.error(`오류 발생: ${errorParam}`);
      }
      
      // Remove query string to prevent repeated toasts on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // Load saved ID on mount
  useEffect(() => {
    const savedId = localStorage.getItem('keylink_saved_id');
    if (savedId) {
      setUserId(savedId);
      setRememberId(true);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleNormalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      toast.error('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // 1. Query Firestore for the email associated with this ID
      const q = query(collection(db, 'users'), where('username', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('아이디 또는 비밀번호가 일치하지 않습니다.');
        setIsLoading(false);
        return;
      }
      
      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      // 2. Set Persistence based on Auto Login preference
      const persistence = autoLogin ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      // 3. Perform Firebase Auth Login with retrieved email
      await signInWithEmailAndPassword(auth, userEmail, password);
      
      // 4. Handle Remember ID
      if (rememberId) {
        localStorage.setItem('keylink_saved_id', userId);
      } else {
        localStorage.removeItem('keylink_saved_id');
      }

      toast.success('로그인에 성공했습니다!');
      router.push('/');
    } catch (error: any) {
      console.error('Firebase Auth Error (Login):', error.code, error.message, error);
      const msg = getAuthErrorMessage(error.code);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (setter: (val: string) => void, val: string) => {
    setter(val);
  };


  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '90px 20px 60px',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(255,111,97,0.08) 0%, transparent 70%)',
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        {/* Login Card */}
        <div style={{
          background: 'var(--gradient-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '32px',
          padding: '44px 32px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.03)',
        }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', marginBottom: '32px', color: '#111', textAlign: 'center' }}>로그인</h1>

          {/* Normal Login Form */}
          <form onSubmit={handleNormalLogin} style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', display: 'block', marginBottom: '8px' }}>아이디</label>
              <input
                type="text"
                className="kl-input"
                placeholder="아이디를 입력해 주세요"
                value={userId}
                onChange={(e) => handleInputChange(setUserId, e.target.value)}
                style={{ borderRadius: '12px', padding: '14px' }}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', display: 'block', marginBottom: '8px' }}>비밀번호</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="kl-input"
                  placeholder="비밀번호를 입력해 주세요"
                  value={password}
                  onChange={(e) => handleInputChange(setPassword, e.target.value)}
                  style={{ borderRadius: '12px', padding: '14px', paddingRight: '46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {/* Checkboxes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', padding: '0 4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#FF6F61' }}
                />
                아이디 기억하기
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#FF6F61' }}
                />
                자동 로그인
              </label>
            </div>

            <button
              type="submit"
              className="kl-btn-primary"
              disabled={isLoading}
              style={{ width: '100%', padding: '16px', borderRadius: '100px', fontWeight: '800', fontSize: '1rem' }}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Sub Links */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
            <button
              onClick={() => toast.error('준비 중인 기능입니다. 고객센터로 문의해 주세요.')}
              style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: '#888', cursor: 'pointer', fontWeight: '500' }}
            >
              아이디/비밀번호 찾기
            </button>
            <div style={{ width: '1px', height: '12px', background: '#ddd', alignSelf: 'center' }} />
            <Link href="/register" style={{ fontSize: '0.8rem', color: '#888', fontWeight: '700', textDecoration: 'none' }}>
              회원가입
            </Link>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <div style={{ flex: 1, height: '1px', background: '#eee' }} />
            <span style={{ fontSize: '0.78rem', color: '#bbb' }}>또는</span>
            <div style={{ flex: 1, height: '1px', background: '#eee' }} />
          </div>

          {/* Social Buttons Container */}
          <SocialAuth isLoading={isLoading} setIsLoading={setIsLoading} />
        </div>


      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>로딩 중...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
