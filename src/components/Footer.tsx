'use client';
import Link from 'next/link';
import { Heart, MessageCircle, Camera } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      padding: '60px 20px 30px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px',
                background: 'linear-gradient(135deg, #FFDBE9, #E6E6FA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Heart size={16} fill="#FF6F61" color="#FF6F61" />
              </div>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.25rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Keylink</span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.7 }}>
              부산·창원 지역 프리미엄<br/>로테이션 소개팅 서비스
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <a href="https://instagram.com/keylink_official" target="_blank" rel="noopener noreferrer"
                style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-secondary)', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              >
                <Camera size={17} />
              </a>
              <a href="https://open.kakao.com/keylink" target="_blank" rel="noopener noreferrer"
                style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-secondary)', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              >
                <MessageCircle size={17} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>서비스</h4>
            {[
              { href: '/events', label: '일정 신청' },
              { href: '/events?region=busan', label: '부산점' },
              { href: '/events?region=changwon', label: '창원점' },
              { href: '/matching', label: '매칭 순위 입력' },
              { href: '/matching/result', label: '매칭 결과 확인' },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{
                display: 'block', marginBottom: '10px',
                fontSize: '0.875rem', color: 'var(--color-text-muted)',
                textDecoration: 'none', transition: 'color 0.2s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >{l.label}</Link>
            ))}
          </div>

          <div>
            <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>고객 지원</h4>
            {[
              { href: '/notices', label: '공지사항' },
              { href: '/notices#faq', label: 'FAQ' },
              { href: '/notices#rules', label: '이용 규정' },
              { href: '/mypage', label: '마이페이지' },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{
                display: 'block', marginBottom: '10px',
                fontSize: '0.875rem', color: 'var(--color-text-muted)',
                textDecoration: 'none', transition: 'color 0.2s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >{l.label}</Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>문의</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              카카오톡 채널<br/>
              <strong style={{ color: 'var(--color-primary-light)' }}>@키링크</strong>
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7, marginTop: '12px' }}>
              인스타그램 DM<br/>
              <strong style={{ color: 'var(--color-primary-light)' }}>@keylink_official</strong>
            </p>
            <div style={{
              marginTop: '20px',
              padding: '14px',
              background: 'rgba(255,111,97,0.08)',
              border: '1px solid rgba(255,111,97,0.2)',
              borderRadius: '12px',
            }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: '600' }}>운영 시간</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>평일 10:00 – 22:00<br/>주말 09:00 – 22:00</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            © 2026 Keylink. All rights reserved. | 사업자등록번호 준비중
          </p>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/notices#terms" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>이용약관</Link>
            <Link href="/notices#privacy" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
