'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleNormalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      toast.error('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
    toast.success('로그인에 성공했습니다!');
    router.push('/');
  };

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
    toast.success('카카오 간편 로그인 성공');
    router.push('/register?social=true');
  };

  const handleNaverLogin = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
    toast.success('네이버 간편 로그인 성공');
    router.push('/register?social=true');
  };

  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '90px 20px 60px',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(255,111,97,0.08) 0%, transparent 70%)',
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #FF6F61, #FF8A71)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(255,111,97,0.3)',
          }}>
            <Heart size={36} fill="#FFFFFF" color="#FFFFFF" />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.8rem', fontWeight: '700',
            background: 'linear-gradient(135deg, #FF6F61, #FF8A71)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}>키링크</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>로그인하여 참여 신청과 매칭 결과를 확인하세요</p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'var(--gradient-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '32px',
          padding: '40px 32px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.03)',
        }}>
          {/* Normal Login Form */}
          <form onSubmit={handleNormalLogin} style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', display: 'block', marginBottom: '8px' }}>아이디</label>
              <input
                type="text"
                className="kl-input"
                placeholder="ex. 아이디를 입력해 주세요"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                style={{ borderRadius: '12px', padding: '14px' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', display: 'block', marginBottom: '8px' }}>비밀번호</label>
              <input
                type="password"
                className="kl-input"
                placeholder="ex. 비밀번호를 입력해 주세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ borderRadius: '12px', padding: '14px' }}
              />
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
            <Link href="/register" style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: '700', textDecoration: 'none' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Kakao Login */}
            <button
              onClick={handleKakaoLogin}
              disabled={isLoading}
              style={{
                width: '100%', padding: '16px',
                background: isLoading ? 'rgba(254,229,0,0.6)' : '#FEE500',
                border: 'none', borderRadius: '100px',
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontSize: '1rem', fontWeight: '800', color: '#191919',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" />
              </svg>
              카카오로 시작하기
            </button>

            {/* Naver Login */}
            <button
              onClick={handleNaverLogin}
              disabled={isLoading}
              style={{
                width: '100%', padding: '16px',
                background: isLoading ? 'rgba(3,199,90,0.6)' : '#03C75A',
                border: 'none', borderRadius: '100px',
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontSize: '1rem', fontWeight: '800', color: '#FFFFFF',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <span style={{ fontWeight: '900', fontSize: '1.2rem', fontFamily: 'Arial' }}>N</span>
              네이버로 시작하기
            </button>
          </div>
        </div>


      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
