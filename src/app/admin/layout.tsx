'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  LayoutDashboard, Users, Calendar, TrendingUp,
  Settings, LogOut, Bell, Menu, X,
  ExternalLink, ChevronDown, ShieldCheck,
  FileText, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { version } from '../../../package.json';

const NAV = [
  { label: '대시보드',      icon: LayoutDashboard, path: '/admin' },
  { label: '신청자 관리',    icon: Users,           path: '/admin/users',   badge: 2 },
  { label: '행사 / 매칭',   icon: Calendar,        path: '/admin/events' },
  { label: '매출 통계',     icon: TrendingUp,      path: '/admin/revenue' },
  { label: '콘텐츠 편집',   icon: FileText,        path: '/admin/cms' },
  { label: '시스템 설정',   icon: Settings,        path: '/admin/settings' },
];

const PAGE_TITLE: Record<string, string> = {
  '/admin':          '대시보드',
  '/admin/users':    '신청자 관리',
  '/admin/events':   '행사 / 매칭 관리',
  '/admin/revenue':  '매출 통계',
  '/admin/cms':      '콘텐츠 편집',
  '/admin/settings': '시스템 설정',
};

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'new',    text: '박준형 님이 신원인증을 요청했습니다.',   time: '2분 전',  read: false },
  { id: 2, type: 'new',    text: '이서윤 님이 신원인증을 요청했습니다.',   time: '11분 전', read: false },
  { id: 3, type: 'update', text: '부산 120기 신청 인원이 14/16명 달성.',  time: '1시간 전', read: true  },
  { id: 4, type: 'cancel', text: '정다혜 님이 120기 참가를 취소했습니다.', time: '3시간 전', read: true  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notiOpen, setNotiOpen]       = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [authState, setAuthState] = useState<'loading' | 'admin' | 'denied'>('loading');
  const notiRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;
  const pageTitle   = PAGE_TITLE[pathname] ?? '관리자';

  // Auth guard
  useEffect(() => {
    if (pathname === '/admin/login') return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().role === 'admin') {
          setAuthState('admin');
        } else {
          await auth.signOut();
          router.replace('/admin/login');
        }
      } catch {
        await auth.signOut();
        router.replace('/admin/login');
      }
    });

    return () => unsub();
  }, [pathname, router]);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  if (pathname === '/admin/login') return <>{children}</>;

  // Loading / access denied
  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: '#09090b' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: '#FF6F61' }} />
        <p style={{ fontSize: '0.85rem', color: '#555' }}>권한 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#09090b', color: '#fff', fontFamily: 'inherit' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 250, background: '#111113', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6" style={{ height: 72, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FF6F61' }}>
              <ShieldCheck size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.5px' }}>KEYLINK</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#FF6F61', background: 'rgba(255,111,97,0.12)', padding: '2px 6px', borderRadius: 4 }}>
              ADMIN
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ color: '#666' }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto" style={{ padding: '16px 12px' }}>
          {NAV.map(item => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg mb-0.5 transition-all duration-150"
                style={{
                  padding: '10px 14px',
                  color: active ? '#FF6F61' : '#777',
                  background: active ? 'rgba(255,111,97,0.08)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9rem',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#ccc'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#777'; }}
              >
                <item.icon size={16} />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#FF6F61', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 rounded-lg transition-all duration-150"
            style={{ padding: '10px 14px', color: '#555', fontSize: '0.9rem', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
          <p style={{ fontSize: '0.65rem', color: '#333', marginTop: 8, paddingLeft: 14 }}>v{version}</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header
          className="sticky top-0 z-40 flex items-center gap-4 px-6"
          style={{ height: 72, background: 'rgba(17,17,19,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ color: '#666' }}>
            <Menu size={20} />
          </button>

          <h1 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', flex: 1 }}>{pageTitle}</h1>

          <div className="flex items-center gap-3">
            {/* Live site link */}
            <a
              href="https://www.keylink.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-lg transition-all duration-200"
              style={{ padding: '7px 14px', fontSize: '0.8rem', color: '#FF6F61', border: '1px solid rgba(255,111,97,0.25)', background: 'rgba(255,111,97,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,111,97,0.14)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,111,97,0.06)'; }}
            >
              <ExternalLink size={13} /> keylink.kr
            </a>

            {/* Notification Bell */}
            <div className="relative" ref={notiRef}>
              <button
                onClick={() => setNotiOpen(v => !v)}
                className="relative flex items-center justify-center rounded-lg transition-all duration-150"
                style={{ width: 38, height: 38, color: '#666', background: notiOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ccc'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!notiOpen) { (e.currentTarget as HTMLElement).style.color = '#666'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#ef4444', border: '1.5px solid #111113' }} />
                )}
              </button>

              {notiOpen && (
                <div
                  className="absolute right-0 flex flex-col overflow-hidden"
                  style={{ top: 'calc(100% + 12px)', width: 320, background: '#111113', border: '1px solid rgba(255,255,255,0.08)', borderTop: '2px solid #FF6F61', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', zIndex: 1000 }}
                >
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>알림</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ fontSize: '0.75rem', color: '#666', cursor: 'pointer' }}>
                        모두 읽음
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <p className="text-center py-10" style={{ color: '#555', fontSize: '0.85rem' }}>새로운 알림이 없습니다.</p>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        className="flex gap-3 px-5 py-4 cursor-pointer transition-all duration-150"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.read ? 'transparent' : 'rgba(255,111,97,0.04)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(255,111,97,0.04)'; }}
                      >
                        <div
                          className="flex items-center justify-center rounded-full shrink-0"
                          style={{
                            width: 32, height: 32,
                            background: n.type === 'new' ? 'rgba(74,222,128,0.1)' : n.type === 'update' ? 'rgba(250,204,21,0.1)' : 'rgba(239,68,68,0.1)',
                            color: n.type === 'new' ? '#4ade80' : n.type === 'update' ? '#facc15' : '#ef4444',
                            fontSize: '0.8rem',
                          }}
                        >
                          {n.type === 'new' ? '✓' : n.type === 'update' ? '↑' : '✕'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: '0.83rem', lineHeight: 1.4, color: n.read ? '#888' : '#ddd' }}>{n.text}</p>
                          <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 3 }}>{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Admin profile */}
            <div className="flex items-center gap-2.5 cursor-pointer" style={{ paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 34, height: 34, background: '#FF6F61', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}
              >
                {auth.currentUser?.email?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="hidden sm:block">
                <p style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
                  {auth.currentUser?.email?.split('@')[0] ?? 'Admin'}
                </p>
                <p style={{ fontSize: '0.65rem', color: '#555' }}>Administrator</p>
              </div>
              <ChevronDown size={13} style={{ color: '#555' }} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto" style={{ padding: '32px 40px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
