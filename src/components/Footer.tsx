'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Camera } from 'lucide-react';
import { useRef } from 'react';

export default function Footer() {
  const pathname = usePathname();
  const router = useRouter();
  const lastTapTime = useRef<number>(0);

  if (pathname === '/register') return null;

  const handleHiddenAdminLink = () => {
    const now = Date.now();
    const gap = now - lastTapTime.current;
    if (gap > 0 && gap < 2000) {
      router.push('/admin');
    }
    lastTapTime.current = now;
  };

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
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', height: '60px', overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: '180px', width: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  src="/logo.png"
                  alt="키링크 로고"
                  width={180}
                  height={180}
                  style={{ height: '180px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.7 }}>
              부산 지역 프리미엄<br />로테이션 소개팅 서비스
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '0.875rem', color: 'var(--color-text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>서비스</h4>
            {[
              { href: '/events', label: '참여 신청' },
              { href: '/events?region=busan', label: '부산점' },
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a href="https://open.kakao.com/keylink" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                  <MessageCircle size={16} />
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>카카오톡 채널</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>@키링크</strong>
                </div>
              </a>
              <a href="https://instagram.com/keylink_official" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                  <Camera size={16} />
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>인스타그램 DM</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>@keylink_official</strong>
                </div>
              </a>
            </div>
            <div style={{
              marginTop: '20px',
              padding: '14px',
              background: 'rgba(255,111,97,0.08)',
              border: '1px solid rgba(255,111,97,0.2)',
              borderRadius: '12px',
            }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: '600' }}>운영 시간</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>평일 10:00 – 22:00<br />주말 09:00 – 22:00</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* Business Info */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <p>상호명: 키링크(Keylink)</p>
              <p>대표자: 태영훈</p>
              <p>사업자등록번호: 483-07-03249</p>
              <p>연락처: 010-4896-2040</p>
            </div>
            <div>
              <p>주소: 부산광역시 부산진구 중앙대로 763-1, 4층(부전동)</p>
              <p>개인정보보호책임자: 태영훈 (keylink2025@gmail.com)</p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div 
              style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', cursor: 'default', userSelect: 'none' }}
              onDoubleClick={handleHiddenAdminLink}
              onTouchStart={handleHiddenAdminLink}
            >
              © 2026 키링크. All rights reserved. | <span style={{ opacity: 0.6 }}>v3.5.1</span>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <Link href="/notices?tab=terms" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: '500' }}>이용약관</Link>
              <Link href="/notices?tab=privacy" style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', textDecoration: 'none', fontWeight: '700' }}>개인정보처리방침</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
