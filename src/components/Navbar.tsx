'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import toast from 'react-hot-toast';

// '진행 과정' is a special anchor link pointing to /#how-it-works
const navLinks = [
  { href: '/', label: 'HOME', anchor: null },
  { href: '/#how-it-works', label: '진행 과정', anchor: 'how-it-works' },
  { href: '/events', label: '참여 신청', anchor: null },
  { href: '/notices', label: '공지 & FAQ', anchor: null },
  { href: '/matching/result', label: '매칭 결과', anchor: null },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const pathname = usePathname();

  // Smooth scroll to anchor, handle cross-page navigation
  const handleAnchorClick = useCallback((e: React.MouseEvent, anchor: string | null) => {
    if (!anchor) return;
    e.preventDefault();
    setIsMenuOpen(false);

    const scrollTo = () => {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    // If already on homepage, scroll directly; otherwise navigate then scroll
    if (pathname === '/') {
      scrollTo();
    } else {
      window.location.href = `/#${anchor}`;
    }
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
      // Active anchor tracking
      const section = document.getElementById('how-it-works');
      if (section) {
        const rect = section.getBoundingClientRect();
        const inView = rect.top <= 120 && rect.bottom > 120;
        setActiveAnchor(inView ? 'how-it-works' : null);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // On mount: check if URL has hash and scroll
    if (window.location.hash === '#how-it-works') {
      setTimeout(() => {
        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('로그아웃되었습니다.');
      setIsMenuOpen(false);
    } catch (error) {
      toast.error('로그아웃 중 오류가 발생했습니다.');
    }
  };

  const isLinkActive = (link: typeof navLinks[0]) => {
    if (link.anchor) return activeAnchor === link.anchor;
    if (link.href === '/') return pathname === '/';
    return pathname.startsWith(link.href);
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        transition: 'all 0.4s ease',
        background: isScrolled ? 'rgba(253, 253, 253, 0.95)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(255, 219, 233, 0.5)' : '1px solid transparent',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '85px' }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <Image
              src="/logo.png"
              alt="키링크 로고"
              width={200}
              height={60}
              style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="desktop-nav">
            {navLinks.map((link) => {
              const active = isLinkActive(link);
              return link.anchor ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.anchor)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: active ? '800' : '600',
                    color: active ? '#FF6F61' : '#333333', textDecoration: 'none', transition: 'all 0.2s',
                    letterSpacing: '0.02em', background: active ? 'rgba(255,111,97,0.1)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6F61'; e.currentTarget.style.background = 'rgba(255, 111, 97, 0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = active ? '#FF6F61' : '#333333'; e.currentTarget.style.background = active ? 'rgba(255,111,97,0.1)' : 'transparent'; }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: active ? '800' : '600',
                    color: active ? '#FF6F61' : '#333333', textDecoration: 'none', transition: 'all 0.2s',
                    letterSpacing: '0.02em', background: active ? 'rgba(255,111,97,0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6F61'; e.currentTarget.style.background = 'rgba(255, 111, 97, 0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = active ? '#FF6F61' : '#333333'; e.currentTarget.style.background = active ? 'rgba(255,111,97,0.1)' : 'transparent'; }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA + Mobile Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link href="/mypage" className="kl-btn-outline" style={{ padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserIcon size={16} /> 마이페이지
                </Link>
                <button onClick={handleLogout} className="kl-btn-outline" style={{ padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  로그아웃 <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="kl-btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
                로그인/회원가입
              </Link>
            )}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333333', padding: '6px', display: 'none' }}
              className="mobile-menu-btn"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isMenuOpen && (
        <div style={{ background: 'rgba(253, 253, 253, 0.98)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--color-border)', padding: '16px 20px' }}>
          {navLinks.map((link) => {
            const active = isLinkActive(link);
            return link.anchor ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.anchor)}
                style={{
                  display: 'block', padding: '14px 16px', fontSize: '1rem', fontWeight: active ? '700' : '500',
                  color: active ? '#FF6F61' : 'var(--color-text-secondary)', textDecoration: 'none',
                  borderRadius: '10px', marginBottom: '4px', background: active ? 'rgba(255,111,97,0.08)' : 'transparent',
                }}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                style={{
                  display: 'block', padding: '14px 16px', fontSize: '1rem', fontWeight: active ? '700' : '500',
                  color: active ? '#FF6F61' : 'var(--color-text-secondary)', textDecoration: 'none',
                  borderRadius: '10px', marginBottom: '4px', background: active ? 'rgba(255,111,97,0.08)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href={user ? "/events" : "/login"}
            onClick={() => setIsMenuOpen(false)}
            className="kl-btn-primary"
            style={{ marginTop: '12px', width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            {user ? "지금 신청하기" : "로그인하고 신청하기"}
          </Link>
          {user && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href="/mypage" onClick={() => setIsMenuOpen(false)} className="kl-btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <UserIcon size={16} /> 마이페이지
              </Link>
              <button onClick={handleLogout} className="kl-btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                로그아웃 <LogOut size={16} />
              </button>
            </div>
          )}
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
