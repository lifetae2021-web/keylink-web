'use client';

import { useState, useEffect } from 'react';
import {
  Users, Calendar, Heart, TrendingUp,
  ArrowUpRight, ArrowDownRight, Clock,
  CalendarCheck, UserPlus, ChevronRight, Zap, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, query, where, orderBy, limit 
} from 'firebase/firestore';

// Skeleton Component for the dark theme
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
);

const STATUS = {
  verified: { label: '인증 완료', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  pending:  { label: '승인 대기', color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
  rejected: { label: '인증 반려', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const panel = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
};

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    weeklyApps: 0,
    matches: 624, // Keep mock for now as matching logic is pending
    monthlyRevenue: '₩3.8M', // Keep mock for now
  });
  const [genderData, setGenderData] = useState([
    { name: '남성', value: 0, color: '#60a5fa' },
    { name: '여성', value: 0, color: '#FF6F61' },
  ]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        // 1. Total Users & Gender Analysis
        const usersSnap = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnap.size;
        let maleCount = 0;
        let femaleCount = 0;
        
        usersSnap.forEach(doc => {
          const data = doc.data();
          if (data.gender === 'male') maleCount++;
          else if (data.gender === 'female') femaleCount++;
        });

        // 2. Weekly Applications
        const sevenDaysAgo = subDays(new Date(), 7);
        const appsQuery = query(
          collection(db, 'applications'),
          where('createdAt', '>=', sevenDaysAgo)
        );
        let weeklyApps = 0;
        try {
          const appsSnap = await getDocs(appsQuery);
          weeklyApps = appsSnap.size;
        } catch (e) {
          console.warn('Applications collection error:', e);
        }

        // 3. Upcoming Events
        const now = new Date();
        const eventsQuery = query(
          collection(db, 'events'),
          where('date', '>=', now),
          orderBy('date', 'asc'),
          limit(3)
        );
        let events: any[] = [];
        try {
          const eventsSnap = await getDocs(eventsQuery);
          events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
          console.warn('Events collection error:', e);
        }

        // 4. Recent Members
        const recentQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentSnap = await getDocs(recentQuery);
        const latestUsers = recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setStats(prev => ({
          ...prev,
          totalUsers,
          weeklyApps,
        }));

        const totalGendered = maleCount + femaleCount;
        setGenderData([
          { name: '남성', value: totalGendered > 0 ? Math.round((maleCount / totalGendered) * 100) : 50, color: '#60a5fa' },
          { name: '여성', value: totalGendered > 0 ? Math.round((femaleCount / totalGendered) * 100) : 50, color: '#FF6F61' },
        ]);

        setUpcomingEvents(events);
        setRecentUsers(latestUsers);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const statsCards = [
    { label: '누적 가입자', value: stats.totalUsers.toLocaleString(), change: '+12%', up: true, icon: Users, color: '#FF6F61' },
    { label: '이번 주 신청', value: stats.weeklyApps.toLocaleString(), change: '+8%', up: true, icon: UserPlus, color: '#60a5fa' },
    { label: '매칭 성공 커플', value: stats.matches.toLocaleString(), change: '-2%', up: false, icon: Heart, color: '#f472b6' },
    { label: '이번 달 매출', value: stats.monthlyRevenue, change: '+5%', up: true, icon: TrendingUp, color: '#4ade80' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-400">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: 2 }}>
            {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })}
          </p>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>안녕하세요, 관리자님 👋</h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
          <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>실시간 운영 중</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s, i) => (
          <div key={i} style={{ ...panel, padding: '20px 24px' }} className="hover:border-white/10 transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${s.color}14` }}>
                <s.icon size={17} style={{ color: s.color }} />
              </div>
              <span className="flex items-center gap-0.5" style={{ fontSize: '0.75rem', fontWeight: 700, color: s.up ? '#4ade80' : '#ef4444' }}>
                {s.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {s.change}
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-2/3 mt-2" />
            ) : (
              <p style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</p>
            )}
            <p style={{ fontSize: '0.78rem', color: '#555', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly trend (Kept with illustrative data) */}
        <div style={{ ...panel, padding: '24px' }} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>주간 신청 및 매칭 추이</h3>
            <span style={{ fontSize: '0.75rem', color: '#444' }}>최근 7일</span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { day: '월', applicants: 12, matches: 4 }, { day: '화', applicants: 18, matches: 6 },
                { day: '수', applicants: 25, matches: 8 }, { day: '목', applicants: 20, matches: 5 },
                { day: '금', applicants: 32, matches: 12 }, { day: '토', applicants: 45, matches: 18 },
                { day: '일', applicants: 38, matches: 15 }
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6F61" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#FF6F61" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" stroke="#333" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#333" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#888' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <Area type="monotone" dataKey="applicants" stroke="#FF6F61" strokeWidth={2} fill="url(#gA)" name="신청자" />
                <Area type="monotone" dataKey="matches"    stroke="#60a5fa" strokeWidth={2} fill="url(#gM)" name="매칭 성사" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {[['#FF6F61', '신청자'], ['#60a5fa', '매칭 성사']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-2">
                <div style={{ width: 12, height: 2, borderRadius: 2, background: c }} />
                <span style={{ fontSize: '0.75rem', color: '#555' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gender ratio */}
        <div style={{ ...panel, padding: '24px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 24 }}>성별 비율</h3>
          <div style={{ position: 'relative', height: 160 }}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-[#FF6F61]" size={32} />
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                      {genderData.map((g, i) => <Cell key={i} fill={g.color} strokeWidth={0} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>{stats.totalUsers.toLocaleString()}</span>
                  <span style={{ fontSize: '0.7rem', color: '#555', marginTop: 2 }}>전체 회원</span>
                </div>
              </>
            )}
          </div>
          <div className="space-y-3 mt-4">
            {genderData.map(g => (
              <div key={g.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color }} />
                  <span style={{ fontSize: '0.83rem', color: '#aaa' }}>{g.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div style={{ width: 80, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${g.value}%`, height: '100%', background: g.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: '0.83rem', fontWeight: 700, width: 32, textAlign: 'right' }}>{g.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming events */}
        <div style={{ ...panel, padding: '24px' }} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="flex items-center gap-2" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              <CalendarCheck size={15} style={{ color: '#facc15' }} /> 진행 예정 행사
            </h3>
            <Link href="/admin/events" className="flex items-center gap-1 transition-colors hover:text-white" style={{ fontSize: '0.78rem', color: '#555' }}>
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-4 rounded-xl transition-colors hover:bg-white/[0.04]" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: 'rgba(255,111,97,0.08)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FF6F61' }}>{ev.episode || '신규'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{ev.title} {ev.episode && `${ev.episode}기`}</p>
                    <p className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                      <Clock size={10} /> {ev.date?.seconds ? format(new Date(ev.date.seconds * 1000), 'M월 d일 (E) HH:mm', { locale: ko }) : '날짜 미정'} · {ev.venue}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>모집중</p>
                    <div style={{ width: 72, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `40%`, height: '100%', borderRadius: 4, background: '#60a5fa' }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-600 text-sm">진행 예정인 행사가 없습니다.</div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div style={{ ...panel, padding: '24px' }}>
            <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              <Zap size={15} style={{ color: '#FF6F61' }} /> 빠른 메뉴
            </h3>
            <div className="space-y-1.5">
              {[
                { label: '신청자 승인', desc: '대기 명단 확인', href: '/admin/users', color: '#60a5fa' },
                { label: '행사 등록',   desc: '새 기수 만들기', href: '/admin/events', color: '#4ade80' },
                { label: '매칭 실행',   desc: '알고리즘 가동', href: '/admin/events', color: '#FF6F61' },
              ].map(a => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex items-center gap-3 rounded-lg transition-colors hover:bg-white/[0.04]"
                  style={{ padding: '11px 14px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}14` }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: a.color }}>GO</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: '0.83rem', fontWeight: 600 }}>{a.label}</p>
                    <p style={{ fontSize: '0.72rem', color: '#555' }}>{a.desc}</p>
                  </div>
                  <ChevronRight size={13} style={{ color: '#444' }} />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.12)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#facc15' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#facc15' }}>알림</span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#aaa' }}>
              실시간 데이터가 동기화되었습니다. 최신 가입 정보를 확인하세요.
            </p>
            <span  className="text-[10px] opacity-30">v3.4.0</span>
          </div>
        </div>
      </div>

      {/* Recent members table */}
      <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>최근 가입자</h3>
          <Link href="/admin/users" className="flex items-center gap-1 transition-colors hover:text-white" style={{ fontSize: '0.78rem', color: '#555' }}>
            전체 보기 <ChevronRight size={12} />
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['이름', '이메일', '직업', '상태', '가입일'].map(h => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#444', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={5} style={{ padding: '12px 24px' }}><Skeleton className="h-6 w-full" /></td>
                  </tr>
                ))
              ) : recentUsers.length > 0 ? (
                recentUsers.map((m, i) => {
                  const s = STATUS[m.status as keyof typeof STATUS] || STATUS.pending;
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover:bg-white/[0.02] transition-colors">
                      <td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600 }}>{m.name || '미입력'}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666' }}>{m.email}</td>
                      <td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#888' }}>{m.job || '-'}</td>
                      <td style={{ padding: '12px 24px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: s.color, background: s.bg }}>
                          {s.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555' }}>
                        {m.createdAt?.seconds ? format(new Date(m.createdAt.seconds * 1000), 'yyyy-MM-dd') : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 24px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>가입자가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
