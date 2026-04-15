'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsLoading(false);
    toast.success('카카오 로그인 연동 예정입니다.');
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
          }}>Keylink</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>로그인하여 일정 신청과 매칭 결과를 확인하세요</p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'var(--gradient-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
        }}>
          {/* Kakao Login */}
          <button
            onClick={handleKakaoLogin}
            disabled={isLoading}
            style={{
              width: '100%', padding: '16px',
              background: isLoading ? 'rgba(254,229,0,0.6)' : '#FEE500',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              fontSize: '1rem', fontWeight: '700', color: '#191919',
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(254,229,0,0.25)',
              marginBottom: '16px',
            }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {isLoading ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', color: '#191919' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" />
              </svg>
            )}
            {isLoading ? '카카오 로그인 중...' : '카카오로 시작하기'}
          </button>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              로그인 시 키링크 <Link href="/notices#terms" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>이용약관</Link>과{' '}
              <Link href="/notices#privacy" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>개인정보처리방침</Link>에 동의하게 됩니다.
            </p>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>또는</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>

          {/* Quick contact */}
          <a
            href="https://open.kakao.com/keylink-inquiry"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)', fontSize: '0.875rem',
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            <MessageCircle size={17} />
            카카오 채널로 문의하기
          </a>
        </div>

        {/* Register link */}
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          처음 방문하셨나요?{' '}
          <Link href="/register" style={{ color: '#FF6F61', fontWeight: '700', textDecoration: 'none' }}>
            회원가입 <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
