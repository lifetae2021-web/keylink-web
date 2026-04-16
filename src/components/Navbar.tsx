'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Heart } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'HOME' },
  { href: '/events', label: '참여 신청' },
  { href: '/notices', label: '공지 & FAQ' },
  { href: '/matching/result', label: '매칭 결과' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.4s ease',
        background: isScrolled
          ? 'rgba(253, 253, 253, 0.95)'
          : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled
          ? '1px solid rgba(255, 219, 233, 0.5)'
          : '1px solid transparent',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '70px',
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #FFDBE9, #E6E6FA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Heart size={18} fill="#FF6F61" color="#FF6F61" />
            </div>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.4rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.01em',
            }}>
              키링크
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="desktop-nav">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  color: '#333333',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FF6F61';
                  e.currentTarget.style.background = 'rgba(255, 111, 97, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#333333';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA + Mobile Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/login" className="kl-btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
              로그인/회원가입
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#333333',
                padding: '6px',
                display: 'none',
              }}
              className="mobile-menu-btn"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isMenuOpen && (
        <div style={{
          background: 'rgba(253, 253, 253, 0.98)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--color-border)',
          padding: '16px 20px',
        }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              style={{
                display: 'block',
                padding: '14px 16px',
                fontSize: '1rem',
                fontWeight: '500',
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                borderRadius: '10px',
                marginBottom: '4px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FF6F61';
                e.currentTarget.style.background = 'rgba(255, 111, 97, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/events"
            onClick={() => setIsMenuOpen(false)}
            className="kl-btn-primary"
            style={{ marginTop: '12px', width: '100%' }}
          >
            지금 신청하기
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
