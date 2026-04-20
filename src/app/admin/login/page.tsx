'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Lock, Mail, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const [loginId,   setLoginId]   = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const router = useRouter();

  const checkAdmin = async (uid: string): Promise<boolean> => {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() && snap.data().role === 'admin';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let email = loginId;
      if (!loginId.includes('@')) {
        const colRef = collection(db, 'users');
        const queries = [
          query(colRef, where('username', '==', loginId)),
          query(colRef, where('name',     '==', loginId)),
        ];
        const snaps = await Promise.all(queries.map(q => getDocs(q)));
        const found = snaps.find(s => !s.empty)?.docs[0];
        if (!found) { toast.error('존재하지 않는 아이디입니다.'); return; }
        email = found.data().email;
        if (!email) { toast.error('이메일 정보가 없는 계정입니다.'); return; }
      }

      const { user } = await signInWithEmailAndPassword(auth, email, password);
      if (await checkAdmin(user.uid)) {
        toast.success('관리자 로그인 성공!');
        router.push('/admin');
      } else {
        await auth.signOut();
        toast.error('관리 권한이 없는 계정입니다.');
      }
    } catch {
      toast.error('로그인 정보가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      if (await checkAdmin(user.uid)) {
        toast.success('관리자 구글 로그인 성공!');
        router.push('/admin');
      } else {
        await auth.signOut();
        toast.error('관리 권한이 없는 계정입니다.');
      }
    } catch {
      toast.error('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKakao = () => {
    const clientId   = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/auth/kakao`;
    if (!clientId) { toast.error('카카오 클라이언트 ID가 설정되지 않았습니다.'); return; }
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=admin&scope=profile_nickname`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#09090b' }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{ width: 56, height: 56, background: '#FF6F61' }}
          >
            <ShieldCheck size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Keylink Admin
          </h1>
          <p style={{ fontSize: '0.83rem', color: '#555', marginTop: 6 }}>
            관리자 계정으로 로그인하세요
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#111113',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '32px 28px',
        }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email / ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#666', marginBottom: 7 }}>
                아이디 또는 이메일
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  placeholder="admin@keylink.kr"
                  required
                  style={{
                    width: '100%', padding: '10px 14px 10px 38px',
                    fontSize: '0.88rem', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                    color: '#eee', outline: 'none',
                  }}
                  onFocus={e  => (e.currentTarget.style.borderColor = 'rgba(255,111,97,0.5)')}
                  onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#666', marginBottom: 7 }}>
                비밀번호
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '10px 14px 10px 38px',
                    fontSize: '0.88rem', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                    color: '#eee', outline: 'none',
                  }}
                  onFocus={e  => (e.currentTarget.style.borderColor = 'rgba(255,111,97,0.5)')}
                  onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, width: '100%', padding: '11px',
                fontSize: '0.9rem', fontWeight: 700,
                background: loading ? '#7a3830' : '#FF6F61',
                color: '#fff', border: 'none', borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#e85d50'); }}
              onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = '#FF6F61'); }}
            >
              {loading ? <Loader2 className="animate-spin" size={17} /> : '로그인'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: '0.72rem', color: '#444' }}>또는</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Social */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Kakao */}
            <button
              onClick={handleKakao}
              disabled={loading}
              style={{
                width: '100%', padding: '10px',
                fontSize: '0.88rem', fontWeight: 700,
                background: '#FEE500', color: '#191919',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0d800')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FEE500')}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M9 1.5C4.858 1.5 1.5 4.134 1.5 7.377c0 2.07 1.376 3.887 3.452 4.934L4.1 15.09a.281.281 0 0 0 .41.316l3.836-2.553c.21.022.424.033.654.033 4.142 0 7.5-2.634 7.5-5.877C16.5 4.134 13.142 1.5 9 1.5z" fill="#191919"/>
              </svg>
              카카오로 시작하기
            </button>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '10px',
                fontSize: '0.88rem', fontWeight: 600,
                background: '#fff', color: '#333',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Google로 시작하기
            </button>
          </div>

          {/* Warning */}
          <div
            style={{
              marginTop: 20, padding: '12px 14px',
              background: 'rgba(255,111,97,0.05)',
              border: '1px solid rgba(255,111,97,0.12)',
              borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={14} style={{ color: '#FF6F61', marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.5 }}>
              관리자 권한이 부여된 계정만 접근 가능합니다. 비정상적인 접근 시도는 기록됩니다.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.72rem', color: '#333' }}>
          © 2026 Keylink Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
