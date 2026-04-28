'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, doc, getDoc 
} from 'firebase/firestore';
import {
  LayoutDashboard, Users, Calendar, TrendingUp,
  Settings, LogOut, Bell, Menu, X,
  ExternalLink, ChevronDown,
  FileText, Loader2, Timer, ChevronsLeft, ChevronsRight, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
const version = '1.0.6';

const PAGE_TITLE: Record<string, string> = {
  '/admin':               '대시보드',
  '/admin/users':         '회원 관리',
  '/admin/applications':  '신청 관리',
  '/admin/events':        '행사 / 매칭 관리',
  '/admin/timer':         '키링크 타이머',
  '/admin/revenue':       '매출 통계',
  '/admin/cms':           '콘텐츠 편집',
  '/admin/settings':      '시스템 설정',
  '/admin/sms-templates': 'SMS 템플릿',
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
  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(true);
  const [notiOpen, setNotiOpen]       = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [authState, setAuthState] = useState<'loading' | 'admin' | 'denied'>('loading');
  const [pendingCount, setPendingCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  const NAV = [
    { label: '대시보드',      icon: LayoutDashboard, path: '/admin' },
    { label: '회원 관리',      icon: Users,           path: '/admin/users' },
    { label: '신청 관리',      icon: FileText,        path: '/admin/applications', badge: pendingCount },
    { label: '행사 / 매칭',   icon: Calendar,        path: '/admin/events' },
    { label: '키링크 타이머', icon: Timer,           path: '/admin/timer' },
    { label: '매출 통계',     icon: TrendingUp,      path: '/admin/revenue' },
    { label: 'SMS 템플릿',     icon: MessageSquare,   path: '/admin/sms-templates' },
    { label: '콘텐츠 편집',   icon: FileText,        path: '/admin/cms' },
    { label: '시스템 설정',   icon: Settings,        path: '/admin/settings' },
  ];

  // 1. 신청 관리 뱃지 리얼타임 연동 (applied OR selected)
  useEffect(() => {
    if (authState !== 'admin') return;

    const q = query(
      collection(db, 'applications'),
      where('status', 'in', ['applied', 'selected'])
    );

    const unsub = onSnapshot(q, (snap) => {
      setPendingCount(snap.size);
    }, (err) => {
      console.error('Error fetching application badge count:', err);
    });

    return () => unsub();
  }, [authState]);

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

  const toggleCollapse = (next: boolean) => {
    if (next) {
      // 접을 때: 텍스트 먼저 숨기고 사이드바 축소
      setShowText(false);
      setCollapsed(true);
    } else {
      // 펼칠 때: 사이드바 먼저 펼치고 300ms 후 텍스트 표시
      setCollapsed(false);
      setTimeout(() => setShowText(true), 280);
    }
  };

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
    <div className="min-h-screen flex" style={{ background: '#F8FAFC', color: '#1E293B', fontFamily: 'inherit' }}>

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: collapsed ? 68 : 220, background: '#FFFFFF', borderRight: '1px solid #E2E8F0', overflow: 'hidden' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5" style={{ height: 72, borderBottom: '1px solid #F1F5F9', minWidth: 0 }}>
          {showText && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#0F172A', whiteSpace: 'nowrap' }}>KEYLINK</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#FF7E7E', background: 'rgba(255,126,126,0.1)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                ADMIN
              </span>
            </div>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? 'mx-auto' : 'ml-auto'}`}>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden shrink-0" style={{ color: '#666' }}>
              <X size={18} />
            </button>
            <button
              onClick={() => toggleCollapse(!collapsed)}
              className="hidden lg:flex items-center justify-center rounded-xl transition-all duration-150 shrink-0"
              style={{ width: 36, height: 36, color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9'; (e.currentTarget as HTMLElement).style.color = '#0F172A'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
            >
              {collapsed ? <ChevronsRight size={24} /> : <ChevronsLeft size={24} />}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: '16px 12px' }}>
          {NAV.map(item => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className="flex items-center rounded-lg mb-0.5 transition-all duration-150"
                style={{
                  padding: '0 10px',
                  height: 40,
                  color: active ? '#fff' : '#64748B',
                  background: active ? '#FF7E7E' : 'transparent',
                  fontWeight: active ? 600 : 500,
                  fontSize: '0.9rem',
                  boxShadow: active ? '0 4px 12px rgba(255,126,126,0.25)' : 'none'
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#F1F5F9'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <item.icon size={16} />
                </span>
                {showText && <span className="flex-1 whitespace-nowrap" style={{ marginLeft: 10 }}>{item.label}</span>}
                {showText && item.badge ? (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#FF6F61', color: '#fff', borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
          {/* 로그아웃 */}
          <button
            onClick={() => auth.signOut()}
            title={collapsed ? '로그아웃' : undefined}
            className="w-full flex items-center rounded-lg mt-0.5 transition-all duration-150"
            style={{ padding: '0 10px', height: 40, justifyContent: 'flex-start', color: '#94A3B8', fontSize: '0.9rem', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LogOut size={16} />
            </span>
            {showText && <span className="whitespace-nowrap" style={{ marginLeft: 10 }}>로그아웃</span>}
          </button>
        </nav>

      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header
          className="sticky top-0 z-40 flex items-center gap-4 px-6 shadow-sm"
          style={{ height: 72, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E2E8F0' }}
        >
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ color: '#666' }}>
            <Menu size={20} />
          </button>

          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', flex: 1 }}>{pageTitle}</h1>

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
                style={{ width: 38, height: 38, color: '#64748B', background: notiOpen ? '#F1F5F9' : 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0F172A'; (e.currentTarget as HTMLElement).style.background = '#F1F5F9'; }}
                onMouseLeave={e => { if (!notiOpen) { (e.currentTarget as HTMLElement).style.color = '#64748B'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
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
                style={{ width: 34, height: 34, background: '#FF7E7E', color: '#fff', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(255,126,126,0.3)' }}
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

        {/* Admin version badge (Pill style) */}
        <div style={{
          position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999,
          background: '#0F172A', color: '#fff',
          fontSize: '0.75rem', fontWeight: '800', padding: '6px 14px',
          borderRadius: '100px', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
        }}>
          v{version}
        </div>
      </div>
    </div>
  );
}
