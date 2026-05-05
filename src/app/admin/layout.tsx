'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, doc, getDoc,
  orderBy, limit, getDocs
} from 'firebase/firestore';
import {
  LayoutDashboard, Users, Calendar, TrendingUp,
  Settings, LogOut, Bell, Menu, X,
  ExternalLink, ChevronDown,
  FileText, Loader2, Timer, ChevronsLeft, ChevronsRight, MessageSquare,
  UserPlus, ClipboardList, Clock, Zap
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
const version = '1.0.12';

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

// v8.12.8: 리얼타임 알림 시스템 (더미데이터 제거)
interface NotificationItem {
  id: string;
  type: 'user' | 'app' | 'private';
  text: string;
  time: string;
  date: Date;
  path: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(true);
  const [notiOpen, setNotiOpen]       = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastViewedNoti, setLastViewedNoti] = useState<number>(0);
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

  // 2. 통합 알림 시스템 (최근 10건)
  useEffect(() => {
    if (authState !== 'admin') return;

    // 로컬 스토리지에서 마지막 확인 시간 로드
    const saved = localStorage.getItem('kl_admin_noti_viewed');
    if (saved) setLastViewedNoti(Number(saved));

    // 리얼타임 감시 (여러 컬렉션 통합)
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5)),
      () => handleSync()
    );
    const unsubApps = onSnapshot(
      query(collection(db, 'applications'), orderBy('appliedAt', 'desc'), limit(5)),
      () => handleSync()
    );
    const unsubPrivate = onSnapshot(
      query(collection(db, 'private_applications'), orderBy('appliedAt', 'desc'), limit(5)),
      () => handleSync()
    );

    async function handleSync() {
      const combined: NotificationItem[] = [];
      
      const safeDate = (d: any) => {
        if (!d) return new Date(0);
        if (d.toDate) return d.toDate();
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d);
        if (typeof d === 'string') return new Date(d);
        return new Date(0);
      };

      try {
        // 1. 회원가입 (최신순 10명 가져와서 승인 대기 또는 상태 없는 사람 선별)
        const uSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(10)));
        uSnap.forEach(d => {
          const data = d.data();
          const status = data.status || 'pending'; // 상태가 없으면 대기중으로 간주
          if (status === 'pending') {
            const date = safeDate(data.createdAt);
            combined.push({
              id: d.id,
              type: 'user',
              text: `${data.name || '신규유저'}님이 가입 승인을 대기 중입니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/users'
            });
          }
        });

        // 2. 로테이션 신청 (최신순 10건 가져와서 검토 중인 것 선별)
        const aSnap = await getDocs(query(collection(db, 'applications'), orderBy('appliedAt', 'desc'), limit(10)));
        aSnap.forEach(d => {
          const data = d.data();
          const status = data.status || 'applied';
          if (status === 'applied') {
            const date = safeDate(data.appliedAt);
            combined.push({
              id: d.id,
              type: 'app',
              text: `${data.name || '신청자'}님이 새로운 로테이션 참가를 신청했습니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/applications'
            });
          }
        });

        // 3. 1:1 프라이빗 매칭 신청
        const pSnap = await getDocs(query(collection(db, 'private_applications'), orderBy('appliedAt', 'desc'), limit(10)));
        pSnap.forEach(d => {
          const data = d.data();
          const date = safeDate(data.appliedAt);
          // 1:1 매칭은 보통 상담 전 상태인 경우 알림
          if (!data.status || data.status === 'pending_consult' || data.status === 'applied') {
            combined.push({
              id: d.id,
              type: 'private',
              text: `${data.name || '신청자'}님이 1:1 프라이빗 매칭을 신청했습니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/applications'
            });
          }
        });

        // 최종 정렬 (최신순)
        const sorted = combined
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 15);
        
        setNotifications(sorted);
      } catch (e) {
        console.error('Notification sync error:', e);
      }
    }

    function formatTimeAgo(date: Date) {
      if (date.getTime() === 0) return '시간 정보 없음';
      const now = new Date();
      const diff = (now.getTime() - date.getTime()) / 1000;
      
      if (diff < 60) return '방금 전';
      if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
      return format(date, 'MM/dd');
    }

    return () => { unsubUsers(); unsubApps(); unsubPrivate(); };
  }, [authState]);

  const unreadCount = notifications.filter(n => n.date.getTime() > lastViewedNoti).length;

  const markAllRead = () => {
    const now = Date.now();
    setLastViewedNoti(now);
    localStorage.setItem('kl_admin_noti_viewed', String(now));
  };
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

  const markAllReadAction = () => {
    markAllRead();
  };

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
                  style={{ top: 'calc(100% + 12px)', width: 360, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', zIndex: 1000 }}
                >
                  <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <div className="flex items-center gap-2.5">
                      <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>알림</span>
                      {unreadCount > 0 && (
                        <span style={{ background: '#FF6F61', color: '#fff', fontSize: '0.7rem', fontWeight: 900, padding: '2px 8px', borderRadius: '100px', boxShadow: '0 2px 6px rgba(255,111,97,0.3)' }}>{unreadCount}</span>
                      )}
                    </div>
                    <button 
                      onClick={markAllReadAction} 
                      className="text-[0.75rem] font-bold text-slate-400 hover:text-[#FF6F61] transition-colors cursor-pointer bg-transparent border-none"
                    >
                      모두 읽음
                    </button>
                  </div>
                  <div style={{ maxHeight: 420, overflowY: 'auto' }} className="kl-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                          <Bell size={28} className="text-slate-200" />
                        </div>
                        <p style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: '700' }}>새로운 알림이 없습니다.</p>
                      </div>
                    ) : notifications.map(n => {
                      const isNew = n.date.getTime() > lastViewedNoti;
                      const iconBg = n.type === 'user' ? '#ECFDF5' : n.type === 'app' ? '#EFF6FF' : '#F5F3FF';
                      const iconColor = n.type === 'user' ? '#10B981' : n.type === 'app' ? '#3B82F6' : '#8B5CF6';
                      
                      return (
                        <div
                          key={n.id}
                          onClick={() => { setNotiOpen(false); router.push(n.path); }}
                          className="flex gap-4 px-6 py-5 cursor-pointer transition-all duration-200 group"
                          style={{ 
                            borderBottom: '1px solid #F8FAFC', 
                            background: isNew ? '#FFF9F9' : '#FFFFFF',
                            position: 'relative'
                          }}
                        >
                          {isNew && <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '3px', background: '#FF6F61' }} />}
                          <div
                            className="flex items-center justify-center rounded-2xl shrink-0 shadow-sm transition-transform group-hover:scale-110"
                            style={{
                              width: 44, height: 44,
                              background: iconBg,
                              color: iconColor,
                            }}
                          >
                            {n.type === 'user' ? <UserPlus size={18} /> : n.type === 'app' ? <ClipboardList size={18} /> : <Zap size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: '0.88rem', lineHeight: 1.5, color: isNew ? '#0F172A' : '#64748B', fontWeight: isNew ? '800' : '600', letterSpacing: '-0.01em' }}>{n.text}</p>
                            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 6, display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                              <Clock size={11} className="text-slate-300" /> {n.time}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {notifications.length > 0 && (
                    <Link 
                      href="/admin/applications" 
                      onClick={() => setNotiOpen(false)} 
                      className="block text-center py-4 text-[0.8rem] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-[#FF6F61] transition-all border-t border-slate-100"
                    >
                      모든 알림 보기
                    </Link>
                  )}
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
