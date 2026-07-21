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
  UserPlus, ClipboardList, Clock, Zap, Lock, Crown, FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { APP_VERSION } from '@/lib/constants';
const version = APP_VERSION;

const PAGE_TITLE: Record<string, string> = {
  '/admin':               '대시보드',
  '/admin/users':         '회원 관리',
  '/admin/applications':  '신청 관리',
  '/admin/events':        '행사 / 매칭 관리',
  '/admin/timer':         '소개팅 진행',
  '/admin/revenue':       '매출 통계',
  '/admin/cms':           '콘텐츠 편집',
  '/admin/settings':      '시스템 설정',
  '/admin/sms-templates': 'SMS 템플릿',
  '/admin/excel-cleaner': '참여자 엑셀 정리',
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
  const [userNotis, setUserNotis] = useState<NotificationItem[]>([]);
  const [appNotis, setAppNotis] = useState<NotificationItem[]>([]);
  const [privateNotis, setPrivateNotis] = useState<NotificationItem[]>([]);
  const [cancelledNotis, setCancelledNotis] = useState<NotificationItem[]>([]);
  const [lastViewedNoti, setLastViewedNoti] = useState<number>(0);
  const [authState, setAuthState] = useState<'loading' | 'super_admin' | 'admin' | 'denied'>('loading');
  const isSuperAdmin = authState === 'super_admin';
  const [pendingCount, setPendingCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // 소개팅 진행 실시간 플로팅 미니 타이머용 상태
  const [runningSession, setRunningSession] = useState<any>(null);
  const [miniRemainingMs, setMiniRemainingMs] = useState<number>(0);
  const [miniCurrentBlock, setMiniCurrentBlock] = useState<any>(null);
  const [miniProgressPct, setMiniProgressPct] = useState<number>(0);
  const [miniOverallProgressPct, setMiniOverallProgressPct] = useState<number>(0);

  const NAV = [
    { label: '대시보드',      icon: LayoutDashboard, path: '/admin' },
    { label: '회원 관리',      icon: Users,           path: '/admin/users' },
    { label: '신청 관리',      icon: FileText,        path: '/admin/applications', badge: pendingCount },
    { label: '행사 / 매칭',   icon: Calendar,        path: '/admin/events' },
    { label: '소개팅 진행',   icon: Timer,           path: '/admin/timer' },
    { label: '매출 통계',     icon: TrendingUp,      path: '/admin/revenue',       superOnly: true },
    { label: 'SMS 템플릿',     icon: MessageSquare,   path: '/admin/sms-templates' },
    { label: '콘텐츠 편집',   icon: FileText,        path: '/admin/cms' },
    { label: '시스템 설정',   icon: Settings,        path: '/admin/settings',       superOnly: true },
    { label: '엑셀 정리기',   icon: FileSpreadsheet, path: '/admin/excel-cleaner' },
  ];

  // [소개팅 진행] 글로벌 실시간 동기화 구독
  useEffect(() => {
    if (pathname === '/admin/login' || pathname === '/admin/timer') {
      setRunningSession(null);
      return;
    }
    if (authState !== 'admin' && authState !== 'super_admin') return;

    // timerConfig.status가 'running'인 첫 번째 세션 실시간 스캔
    const q = query(
      collection(db, 'sessions'),
      where('timerConfig.status', '==', 'running'),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setRunningSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        setRunningSession(null);
      }
    }, (err) => {
      console.error('Error fetching global running timer session:', err);
    });

    return () => unsub();
  }, [pathname, authState]);

  // [소개팅 진행] 초정밀 1초 단위 타이머 역산 연산기
  useEffect(() => {
    if (!runningSession || !runningSession.timerConfig) {
      setMiniRemainingMs(0);
      setMiniCurrentBlock(null);
      return;
    }

    const timerConfig = runningSession.timerConfig;
    
    const tick = () => {
      const startTime = timerConfig.startTime;
      if (!startTime) return;

      const now = Date.now();
      const elapsedMs = now - startTime;

      const cakeRoundNum = timerConfig.cakeRound || 4;
      const talkTimeVal = timerConfig.talkTime || 15;
      const totalRoundsVal = timerConfig.totalRounds || 7;
      const customDurations = timerConfig.customDurations || {};

      // 1. 대화 일정표 블록 어레이 계산
      const list: { type: 'talk' | 'break'; label: string; durationMs: number; roundNum?: number }[] = [];

      for (let r = 1; r <= totalRoundsVal; r++) {
        // 대화 시간 (커스텀 시간 최우선)
        const roundTalkMin = customDurations[r] !== undefined ? customDurations[r] : talkTimeVal;
        const roundTalkMs = roundTalkMin * 60000;

        list.push({
          type: 'talk',
          label: `${r}회차 대화 진행 중`,
          durationMs: roundTalkMs,
          roundNum: r
        });

        // 쉬는 시간 블록 (마지막 회차 제외)
        if (r < totalRoundsVal) {
          if (r + 1 === cakeRoundNum) {
            list.push({ type: 'break', label: '교체 및 케이크 5분 휴식', durationMs: 5 * 60000 });
          } else {
            list.push({ type: 'break', label: '자리 교체 및 이동 시간', durationMs: 1.5 * 60000 }); // 1분 30초
          }
        }
      }

      // 전체 행사 총 밀리초
      const totalDurationMs = list.reduce((sum, item) => sum + item.durationMs, 0);

      if (elapsedMs >= totalDurationMs) {
        // 소개팅 종료 도달
        setMiniRemainingMs(0);
        setMiniCurrentBlock({ label: '모든 소개팅 일정 종료됨', type: 'break', durationMs: 0 });
        return;
      }

      // 현재 어느 블록에 속하는지 파악
      let accumMs = 0;
      let currentBlockObj = null;
      let remainingInBlockMs = 0;

      for (const block of list) {
        const blockStart = accumMs;
        const blockEnd = accumMs + block.durationMs;

        if (elapsedMs >= blockStart && elapsedMs < blockEnd) {
          currentBlockObj = block;
          remainingInBlockMs = blockEnd - elapsedMs;
          break;
        }
        accumMs += block.durationMs;
      }

      if (currentBlockObj) {
        setMiniRemainingMs(remainingInBlockMs);
        setMiniCurrentBlock(currentBlockObj);
        setMiniProgressPct(((currentBlockObj.durationMs - remainingInBlockMs) / currentBlockObj.durationMs) * 100);
        setMiniOverallProgressPct((elapsedMs / totalDurationMs) * 100);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [runningSession]);

  // 1. 신청 관리 뱃지 리얼타임 연동 (applied OR selected)
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set());
  const [pendingApps, setPendingApps] = useState<any[]>([]);

  useEffect(() => {
    if (authState !== 'admin' && authState !== 'super_admin') return;

    // 1-a. 활성 기수 동기화
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      const activeIds = new Set<string>();
      const now = new Date();
      snap.forEach(d => {
        const data = d.data();
        let eventDate = new Date(0);
        if (data.eventDate) {
          eventDate = typeof data.eventDate.toDate === 'function' ? data.eventDate.toDate() : new Date(data.eventDate);
        }
        const isEnded = data.status === 'completed' || data.isForceHidden || now >= new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        if (!isEnded) activeIds.add(d.id);
      });
      setActiveSessionIds(activeIds);
    }, (err) => {
      console.error('Error syncing active sessions:', err);
    });

    // 1-b. 대기 신청서 동기화
    const q = query(
      collection(db, 'applications'),
      where('status', 'in', ['applied', 'selected'])
    );

    const unsubApps = onSnapshot(q, (snap) => {
      const realDocs = snap.docs.filter(d => {
        const data = d.data();
        const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
        return !isDummy;
      }).map(d => d.data());
      setPendingApps(realDocs);
    }, (err) => {
      console.error('Error syncing pending apps:', err);
    });

    return () => {
      unsubSessions();
      unsubApps();
    };
  }, [authState]);

  useEffect(() => {
    // 종료되지 않은 활성 기수에 속한 신청서만 카운트
    const count = pendingApps.filter(app => activeSessionIds.has(app.sessionId)).length;
    setPendingCount(count);
  }, [pendingApps, activeSessionIds]);

  // 2. 통합 알림 시스템 (회원, 신청, 매칭 리얼타임 통합)
  useEffect(() => {
    if (authState !== 'admin' && authState !== 'super_admin') return;

    const saved = localStorage.getItem('kl_admin_noti_viewed');
    if (saved) setLastViewedNoti(Number(saved));

    const safeDate = (d: any) => {
      if (!d) return new Date(0);
      if (d.toDate) return d.toDate();
      if (d instanceof Date) return d;
      if (typeof d === 'number') return new Date(d);
      if (typeof d === 'string') return new Date(d);
      return new Date(0);
    };

    // 2a. 회원 알림 (가입 대기 + 프로필 수정, 더미계정 제외)
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(50)),
      (snapshot) => {
        const items = snapshot.docs.filter(d => {
          const data = d.data();
          const isDummy = data.isDummy === true || d.id.startsWith('dummy') || d.id.startsWith('user_m_') || d.id.startsWith('user_f_');
          return !isDummy;
        }).map(d => {
          const data = d.data();
          const status = data.status || 'pending';
          const list: NotificationItem[] = [];

          if (status === 'pending') {
            const date = safeDate(data.createdAt);
            list.push({
              id: d.id + '_join',
              type: 'user',
              text: `${data.name || '신규유저'}님이\n가입 승인을 대기 중입니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/users'
            });
          }

          if (data.isJobReviewed === false) {
            let date = safeDate(data.updatedAt) || safeDate(data.createdAt);
            if (data.user_logs && data.user_logs.length > 0) {
              const lastLog = data.user_logs[data.user_logs.length - 1];
              if (lastLog.changedAt) date = safeDate(lastLog.changedAt);
            }
            list.push({
              id: d.id + '_update',
              type: 'user',
              text: `${data.name || '회원'}님이\n프로필 정보를 수정했습니다.`,
              date,
              time: formatTimeAgo(date),
              path: '/admin/users'
            });
          }
          return list;
        }).flat();
        setUserNotis(items);
      },
      (err) => {
        console.error('Error syncing user notifications:', err);
      }
    );

    // 2b. 로테이션 신청 알림 (더미계정 제외)
    const unsubApps = onSnapshot(
      query(collection(db, 'applications'), orderBy('appliedAt', 'desc'), limit(20)),
      (snapshot) => {
        const items = snapshot.docs.filter(d => {
          const data = d.data();
          if ((data.status || 'applied') !== 'applied') return false;
          const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
          return !isDummy;
        }).map(d => {
          const data = d.data();
          const date = safeDate(data.appliedAt);
          return {
            id: d.id,
            type: 'app' as const,
            text: `${data.name || '신청자'}님이\n새로운 로테이션 참가를 신청했습니다.`,
            date,
            time: formatTimeAgo(date),
            path: '/admin/applications'
          };
        });
        setAppNotis(items);
      },
      (err) => {
        console.error('Error syncing app notifications:', err);
      }
    );

    // 2c. 프라이빗 매칭 알림 (더미계정 제외)
    const unsubPrivate = onSnapshot(
      query(collection(db, 'private_applications'), orderBy('appliedAt', 'desc'), limit(20)),
      (snapshot) => {
        const items = snapshot.docs.filter(d => {
          const data = d.data();
          const status = data.status;
          if (status && status !== 'pending_consult' && status !== 'applied') return false;
          const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
          return !isDummy;
        }).map(d => {
          const data = d.data();
          const date = safeDate(data.appliedAt);
          return {
            id: d.id,
            type: 'private' as const,
            text: `${data.name || '신청자'}님이\n1:1 프라이빗 매칭을 신청했습니다.`,
            date,
            time: formatTimeAgo(date),
            path: '/admin/applications'
          };
        });
        setPrivateNotis(items);
      },
      (err) => {
        console.error('Error syncing private notifications:', err);
      }
    );

    // 2d. 취소 알림 (더미계정 제외)
    const unsubCancelled = onSnapshot(
      query(collection(db, 'applications'), orderBy('cancelledAt', 'desc'), limit(15)),
      (snapshot) => {
        const items = snapshot.docs.filter(d => {
          const data = d.data();
          if (data.status !== 'cancelled') return false;
          const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true;
          return !isDummy;
        }).map(d => {
          const data = d.data();
          const date = safeDate(data.cancelledAt);
          return {
            id: d.id + '_cancelled',
            type: 'app' as const,
            text: `${data.name || '참여자'}님이\n로테이션 신청을 취소했습니다.`,
            date,
            time: formatTimeAgo(date),
            path: '/admin/applications'
          };
        });
        setCancelledNotis(items);
      },
      (err) => {
        console.error('Error syncing cancelled notifications:', err);
      }
    );

    return () => { unsubUsers(); unsubApps(); unsubPrivate(); unsubCancelled(); };
  }, [authState]);

  // 3. 알림 통합 및 정렬
  useEffect(() => {
    const combined = [...userNotis, ...appNotis, ...privateNotis, ...cancelledNotis]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20);
    setNotifications(combined);
  }, [userNotis, appNotis, privateNotis, cancelledNotis]);

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

  const unreadCount = notifications.filter(n => n.date.getTime() > lastViewedNoti).length;

  const markAllRead = () => {
    const now = Date.now();
    setLastViewedNoti(now);
    localStorage.setItem('kl_admin_noti_viewed', String(now));
  };
  const pageTitle   = PAGE_TITLE[pathname] ?? '관리자';

  // Auth guard
  useEffect(() => {
    if (pathname === '/admin/login') {
      setAuthState('denied');
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState('denied');
        router.replace('/admin/login');
        return;
      }
      try {
        // v12.1.0: 토큰 강제 갱신 후 role 확인 → Firestore 리스너 실행 전에 최신 인증 토큰 보장
        await user.getIdToken(true);
        const snap = await getDoc(doc(db, 'users', user.uid));
        const role = snap.exists() ? snap.data().role : null;
        if (role === 'super_admin') {
          setAuthState('super_admin');
        } else if (role === 'admin') {
          setAuthState('admin');
        } else {
          setAuthState('denied');
          await auth.signOut();
          router.replace('/admin/login');
        }
      } catch {
        setAuthState('denied');
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
  if (authState === 'loading' || (authState === 'denied' && pathname !== '/admin/login')) {
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${
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
            const locked = (item as any).superOnly && !isSuperAdmin;

            if (locked) {
              return null;
            }


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

          {/* 빈 공간을 채워 우측 버튼들을 오른쪽으로 밀어냅니다 */}
          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {/* Live site link */}
            <a
              href="https://www.keylink.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg transition-all duration-200"
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
                  className="fixed sm:absolute top-[74px] sm:top-[calc(100%+12px)] left-4 right-4 sm:left-auto sm:right-0 w-auto sm:w-[360px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', zIndex: 1000 }}
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
                            <p style={{ fontSize: '0.88rem', lineHeight: 1.5, color: isNew ? '#0F172A' : '#64748B', fontWeight: isNew ? '800' : '600', letterSpacing: '-0.01em', whiteSpace: 'pre-line' }}>{n.text}</p>
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
                      href="/admin/notifications" 
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
            <div className="flex items-center gap-2.5 select-none" style={{ paddingLeft: 12, borderLeft: '1px solid rgba(0,0,0,0.06)' }}>
              <div
                className="flex items-center justify-center rounded-full relative"
                style={{
                  width: 34, height: 34,
                  background: isSuperAdmin ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#FF7E7E',
                  color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                  boxShadow: isSuperAdmin ? '0 2px 10px rgba(245,158,11,0.4)' : '0 2px 8px rgba(255,126,126,0.3)',
                  border: isSuperAdmin ? '2px solid #FCD34D' : 'none',
                }}
              >
                {isSuperAdmin ? <Crown size={16} /> : (auth.currentUser?.email?.[0]?.toUpperCase() ?? 'A')}
              </div>
              <div className="hidden sm:block pr-2">
                <p style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
                  {auth.currentUser?.email?.split('@')[0] ?? 'Admin'}
                </p>
                <p style={{ fontSize: '0.65rem', color: isSuperAdmin ? '#D97706' : '#555', fontWeight: isSuperAdmin ? 700 : 400 }}>
                  {isSuperAdmin ? '👑 최고관리자' : 'Administrator'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10">
          {children}
        </main>

        {/* 소개팅 진행 실시간 플로팅 미니 타이머 (경로가 timer가 아니고, 액티브 세션이 돌고 있을 때만 노출) */}
        {runningSession && miniCurrentBlock && pathname !== '/admin/timer' && (
          <div 
            onClick={() => router.push('/admin/timer')}
            className={`fixed bottom-24 right-6 z-[9999] group flex flex-col items-stretch bg-slate-950/95 text-white rounded-2xl border backdrop-blur-lg shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer max-w-[280px] select-none ${
              miniRemainingMs < 60000 && miniCurrentBlock.durationMs > 0
                ? 'border-rose-500 shadow-rose-500/20 text-rose-200 animate-pulse'
                : 'border-slate-800 shadow-black/40'
            }`}
          >
            {/* 기본 콤팩트 바 */}
            <div className="flex items-center gap-3 px-4 py-3 min-w-[230px]">
              <div className={`p-1.5 rounded-lg ${
                miniRemainingMs < 60000 && miniCurrentBlock.durationMs > 0
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <Timer size={18} className={miniRemainingMs < 60000 && miniCurrentBlock.durationMs > 0 ? 'animate-bounce' : ''} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-400 tracking-wider truncate uppercase">
                  {miniCurrentBlock.type === 'break' ? '교체 및 휴식 시간' : `${miniCurrentBlock.roundNum}회차 대화 진행 중`}
                </p>
                <p className="text-xs font-black text-white truncate mt-0.5">
                  {miniCurrentBlock.label}
                </p>
              </div>
              <div className="font-mono text-base font-black tracking-tight text-white pl-2 border-l border-slate-800/80">
                {(() => {
                  const m = Math.floor(miniRemainingMs / 60000);
                  const s = Math.floor((miniRemainingMs % 60000) / 1000);
                  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                })()}
              </div>
            </div>

            {/* 마우스 호버 시 확장되는 세부 매치 트래커 보드 */}
            <div className="max-h-0 overflow-hidden group-hover:max-h-[180px] transition-all duration-300 ease-in-out border-t border-transparent group-hover:border-slate-850 px-4 group-hover:pb-4 group-hover:pt-3">
              <div className="space-y-3">
                {/* 1. 현재 라운드 진행바 */}
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-1">
                    <span>현재 라운드</span>
                    <span>{Math.floor(miniProgressPct)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                    <div 
                      className={`h-full transition-all duration-1000 ${miniCurrentBlock.type === 'break' ? 'bg-purple-500' : 'bg-[#FF6F61]'}`} 
                      style={{ width: `${miniProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* 2. 전체 매칭 진행바 */}
                <div>
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-1">
                    <span>📍 전체 매칭 진행률</span>
                    <span>{Math.floor(miniOverallProgressPct)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000" 
                      style={{ width: `${miniOverallProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* 바로가기 액션 안내 */}
                <div className="pt-2 text-center border-t border-slate-900/50">
                  <span className="text-[10px] font-black text-rose-400 group-hover:underline">
                    클릭하여 소개팅 진행 배치표로 이동 ➔
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

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
