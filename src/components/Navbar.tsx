'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { version } from '../../package.json';
// v8.1.7: Premium Navigation Bar

// '진행 과정' is a special anchor link pointing to /#how-it-works
const navLinks = [
  { href: '/', label: 'HOME', anchor: 'top' },
  { href: '/notices', label: '공지 & FAQ', anchor: null },
  { href: '/#how-it-works', label: '진행 과정', anchor: null },
  { href: '/events', label: '참여 신청', anchor: null },
  { href: '/status', label: '실시간 현황', anchor: null },
  { href: '/matching/result', label: '매칭 결과', anchor: null },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const isManualScrolling = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  // 소셜 가입 미완료 상태에서 네비게이션 시 로그아웃 처리
  const handleNavWithSignOut = useCallback(async (href: string) => {
    if (pathname === '/register/social-profile') {
      await auth.signOut();
    }
    router.push(href);
  }, [pathname, router]);

  // Smooth scroll to anchor, handle cross-page navigation
  const handleAnchorClick = useCallback((e: React.MouseEvent, anchor: string | null) => {
    if (!anchor) return;
    e.preventDefault();
    setIsMenuOpen(false);

    if (anchor === 'top') {
      if (pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = '/';
      }
      return;
    }

    setActiveAnchor(anchor);
    isManualScrolling.current = true;

    const scrollTo = () => {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { isManualScrolling.current = false; }, 800);
      } else {
        isManualScrolling.current = false;
      }
    };

    if (pathname === '/') {
      scrollTo();
    } else {
      window.location.href = `/#${anchor}`;
    }
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
      
      // Active anchor tracking - Reset on mount
      setActiveAnchor(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    let unsubDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      if (currentUser) {
        unsubDoc = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
          setIsAdmin(snap.exists() && snap.data()?.role === 'admin');
        });
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, [pathname]);

  // Reset active anchor when leaving homepage
  useEffect(() => {
    if (pathname !== '/') {
      setActiveAnchor(null);
    }
  }, [pathname]);

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
    // If on homepage, '참여 신청' (/events) is the default active menu
    if (pathname === '/') {
      if (link.href === '/events') return true;
      return false; // Disable HOME and Scroll-spy highlights on homepage
    }

    // On other pages, use standard routing logic
    if (link.anchor) {
      return pathname === '/' && activeAnchor === link.anchor;
    }
    if (link.href === '/') return pathname === '/';
    return pathname === link.href || pathname.startsWith(link.href + '/');
  };

  return (
    <>
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
        <div className="kl-nav-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '85px' }}>
            {/* Logo */}
            <Link href="/" onClick={(e) => { handleAnchorClick(e, 'top'); if (pathname === '/register/social-profile') { e.preventDefault(); handleNavWithSignOut('/'); } }} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', height: '85px' }}>
              <div style={{ position: 'relative', height: '100%', width: '160px', display: 'flex', alignItems: 'center' }}>
                <Image
                  src="/logo.png"
                  alt="키링크 로고"
                  width={160}
                  height={60}
                  style={{ height: 'auto', width: '160px', objectFit: 'contain' }}
                  priority
                />
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="desktop-nav">
              {navLinks.map((link) => {
                const active = isLinkActive(link);
                const isConversionMenu = link.href === '/events';
                const activeColor = isConversionMenu ? '#FF4D3D' : '#FF6F61';
                const activeBg = isConversionMenu ? 'rgba(255, 77, 61, 0.12)' : 'rgba(255, 111, 97, 0.1)';
                
                return link.anchor ? (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => { handleAnchorClick(e, link.anchor); if (pathname === '/register/social-profile') { e.preventDefault(); handleNavWithSignOut(link.href); } }}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: active ? '900' : '600',
                      color: active ? activeColor : '#333333', textDecoration: 'none', transition: 'all 0.2s',
                      letterSpacing: '0.02em', background: active ? activeBg : 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6F61'; e.currentTarget.style.background = 'rgba(255, 111, 97, 0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = active ? activeColor : '#333333'; e.currentTarget.style.background = active ? activeBg : 'transparent'; }}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => { if (pathname === '/register/social-profile') { e.preventDefault(); handleNavWithSignOut(link.href); } }}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: active ? '900' : '600',
                      color: active ? activeColor : '#333333', textDecoration: 'none', transition: 'all 0.2s',
                      letterSpacing: '0.02em', background: active ? activeBg : 'transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6F61'; e.currentTarget.style.background = 'rgba(255, 111, 97, 0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = active ? activeColor : '#333333'; e.currentTarget.style.background = active ? activeBg : 'transparent'; }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* CTA + Mobile Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {user && pathname !== '/register/social-profile' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isAdmin && (
                    <Link href="/admin" className="kl-mypage-btn kl-admin-btn" style={{ padding: '10px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '100px', background: '#111', color: '#fff', textDecoration: 'none', fontWeight: '700' }}>
                      관리자페이지
                    </Link>
                  )}
                  <Link href="/mypage" className="kl-btn-outline kl-mypage-btn" style={{ padding: '10px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '100px' }}>
                    <UserIcon size={16} className="kl-btn-icon" /> 마이페이지
                  </Link>
                  {/* PC 전용 로그아웃 버튼 (v3.5.3) */}
                  <button 
                    onClick={handleLogout} 
                    className="desktop-only-btn"
                    style={{ 
                      padding: '10px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', 
                      borderRadius: '100px', background: 'transparent', border: '1px solid #EDEDED', 
                      color: '#888888', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFDBE9'; e.currentTarget.style.color = '#FF6F61'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDEDED'; e.currentTarget.style.color = '#888888'; }}
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    if (pathname === '/register/social-profile') await auth.signOut();
                    router.push('/login');
                  }}
                  className="kl-btn-primary kl-mypage-btn"
                  style={{ padding: '10px 20px', fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
                >
                  로그인/회원가입
                </button>
              )}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', color: '#333333', padding: '8px',
                  display: user ? 'flex' : 'none' 
                }}
                className="mobile-menu-btn"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Side Panel Overlay */}
      <div
        onClick={() => setIsMenuOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
          opacity: isMenuOpen ? 1 : 0,
          pointerEvents: isMenuOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
          backdropFilter: 'blur(4px)',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '85%', maxWidth: '340px',
          background: '#FFFFFF', zIndex: 2001, display: 'flex', flexDirection: 'column',
          transform: isMenuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.32, 0, 0.15, 1)',
          boxShadow: '-10px 0 50px rgba(0,0,0,0.15)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Panel Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px', borderBottom: '1px solid #F5F5F5' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', letterSpacing: '-0.02em' }}>메뉴</span>
          <button
            onClick={() => setIsMenuOpen(false)}
            style={{ background: '#F8F8F8', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <X size={20} color="#333" />
          </button>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
          {navLinks.map((link) => {
            const active = isLinkActive(link);
            const isConversionMenu = link.href === '/events';
            const activeColor = isConversionMenu ? '#FF4D3D' : '#FF6F61';
            const activeBg = isConversionMenu ? 'rgba(255, 77, 61, 0.08)' : 'rgba(255, 111, 97, 0.08)';

            return link.anchor ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.anchor)}
                style={{
                  display: 'block', padding: '14px 16px', fontSize: '1rem', fontWeight: active ? '800' : '500',
                  color: active ? activeColor : '#444', textDecoration: 'none',
                  borderRadius: '12px', marginBottom: '4px', background: active ? activeBg : 'transparent',
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
                  display: 'block', padding: '14px 16px', fontSize: '1rem', fontWeight: active ? '800' : '500',
                  color: active ? activeColor : '#444', textDecoration: 'none',
                  borderRadius: '12px', marginBottom: '4px', background: active ? activeBg : 'transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsMenuOpen(false)}
              style={{
                display: 'block', padding: '14px 16px', fontSize: '1rem', fontWeight: '700',
                color: '#fff', textDecoration: 'none', textAlign: 'center',
                borderRadius: '12px', marginBottom: '4px', background: '#FF6F61',
                marginTop: '8px',
              }}
            >
              관리자페이지
            </Link>
          )}
        </nav>

        {/* Bottom Actions */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #F5F5F5', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link
            href={user ? "/events" : "/login"}
            onClick={() => setIsMenuOpen(false)}
            className="kl-btn-primary"
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            {user ? "지금 신청하기" : "로그인하고 신청하기"}
          </Link>
          {user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  href="/mypage"
                  onClick={() => setIsMenuOpen(false)}
                  className="kl-btn-outline"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                >
                  <UserIcon size={15} /> 마이페이지
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                    background: 'transparent', border: '1px solid #EDEDED', borderRadius: '100px',
                    color: '#9CA3AF', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer', padding: '10px'
                  }}
                >
                  <LogOut size={15} /> 로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin version badge */}
      {isAdmin && (
        <div style={{
          position: 'fixed', bottom: '16px', right: '16px', zIndex: 999,
          background: '#111', color: '#fff',
          fontSize: '0.82rem', fontWeight: '700', padding: '5px 12px',
          borderRadius: '100px', pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
        }}>
          v{version}
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .desktop-nav { display: none !important; }
          .desktop-only-btn { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .kl-nav-container { padding: 0 10px !important; }
          .kl-mypage-btn {
            padding: 8px 14px !important;
            font-size: 0.78rem !important;
          }
          .kl-admin-btn { display: none !important; }
        }
        @media (max-width: 480px) {
          .kl-mypage-btn {
            padding: 6px 10px !important;
            font-size: 12px !important;
            height: 32px !important;
            min-height: 32px !important;
          }
          .kl-btn-icon {
            width: 13px !important;
            height: 13px !important;
          }
        }
        @media (min-width: 1025px) {
          .mobile-menu-btn { display: none !important; }
          .desktop-only-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
