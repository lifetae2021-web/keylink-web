'use client';

import { useState, useEffect } from 'react';
import {
  Users, Heart, TrendingUp, Clock,
  CalendarCheck, UserPlus, ChevronRight, Zap, Loader2,
  ClipboardList, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, startOfDay, startOfToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, orderBy, limit
} from 'firebase/firestore';

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />
);

const STATUS = {
  verified: { label: '인증 완료', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  pending:  { label: '승인 대기', color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
  rejected: { label: '인증 반려', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const panel = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val?.toDate) return val.toDate();
  if (val?.seconds) return new Date(val.seconds * 1000);
  return null;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    monthlyNewUsers: 0,
    prevMonthlyNewUsers: 0,
    weeklyApps: 0,
    prevWeeklyApps: 0,
    monthlyApps: 0,
    prevMonthlyApps: 0,
    totalApps: 0,
    matchCount: 0,
    monthlyMatchCount: 0,
    prevMonthlyMatchCount: 0,
    monthlyRevenue: 0,
    prevMonthlyRevenue: 0,
  });
  const [genderData, setGenderData] = useState([
    { name: '남성', value: 0, color: '#60a5fa' },
    { name: '여성', value: 0, color: '#FF6F61' },
  ]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentApps, setRecentApps] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        // 1. 전체 회원 + 성별 + 이번 달 신규
        const usersSnap = await getDocs(collection(db, 'users'));
        let maleCount = 0, femaleCount = 0, monthlyNewUsers = 0, prevMonthlyNewUsers = 0;
        const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const userPrevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        usersSnap.forEach(doc => {
          const data = doc.data();
          const g = data.gender;
          if (g === 'male') maleCount++;
          else if (g === 'female') femaleCount++;
          const created = toDate(data.createdAt);
          if (created && created >= thisMonthStart) monthlyNewUsers++;
          else if (created && created >= userPrevMonthStart) prevMonthlyNewUsers++;
        });

        // 2. 신청 데이터 + 일별 차트 (최근 7일 + 이전 7일)
        const appsSnap = await getDocs(collection(db, 'applications'));
        const allApps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const now = new Date();
        const dayMap: Record<string, { applicants: number; matches: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = subDays(now, i);
          dayMap[format(d, 'yyyy-MM-dd')] = { applicants: 0, matches: 0 };
        }

        const appMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const appPrevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        let weeklyApps = 0, prevWeeklyApps = 0, confirmedCount = 0, monthlyApps = 0, prevMonthlyApps = 0;
        allApps.forEach((app: any) => {
          const d = toDate(app.appliedAt);
          if (!d) return;
          const key = format(d, 'yyyy-MM-dd');
          if (dayMap[key]) {
            dayMap[key].applicants++;
            weeklyApps++;
          }
          // 이전 7일 신청 수
          const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
          if (daysAgo >= 7 && daysAgo <= 13) prevWeeklyApps++;
          // 이번 달 / 전월 신청 수
          if (d >= appMonthStart) monthlyApps++;
          else if (d >= appPrevMonthStart) prevMonthlyApps++;
          // 확정된 신청
          if (app.status === 'confirmed' || app.paymentConfirmed === true) {
            confirmedCount++;
            if (dayMap[key]) dayMap[key].matches++;
          }
        });

        const chart = Object.entries(dayMap).map(([dateStr, v]) => ({
          day: DAY_LABELS[new Date(dateStr).getDay()],
          ...v,
        }));

        // 3. 매칭 성공 커플 (votes 컬렉션)
        let matchCount = 0, monthlyMatchCount = 0, prevMonthlyMatchCount = 0;
        try {
          const votesSnap = await getDocs(collection(db, 'votes'));
          matchCount = votesSnap.size;
          const voteMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const votePrevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          votesSnap.docs.forEach(doc => {
            const d = toDate(doc.data().submittedAt);
            if (d && d >= voteMonthStart) monthlyMatchCount++;
            else if (d && d >= votePrevMonthStart) prevMonthlyMatchCount++;
          });
        } catch (e) { /* votes 없으면 0 */ }

        // 4. sessions 한 번만 fetch — 매출 계산 + 예정 기수
        const sessionsSnap = await getDocs(collection(db, 'sessions'));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const todayStart = startOfToday();

        let monthlyRevenue = 0, prevMonthlyRevenue = 0;
        sessionsSnap.docs.forEach(doc => {
          const s = doc.data();
          const eventDate = toDate(s.eventDate);
          if (!eventDate) return;
          const fee = Number(s.price || 0);
          const cnt = allApps.filter(
            (a: any) => a.sessionId === doc.id && (a.status === 'confirmed' || a.paymentConfirmed === true)
          ).length;
          if (eventDate >= monthStart) monthlyRevenue += fee * cnt;
          else if (eventDate >= prevMonthStart) prevMonthlyRevenue += fee * cnt;
        });

        const upcoming = sessionsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((s: any) => {
            const d = toDate(s.eventDate);
            return d && d >= todayStart;
          })
          .sort((a: any, b: any) => {
            const da = toDate((a as any).eventDate)?.getTime() || 0;
            const db2 = toDate((b as any).eventDate)?.getTime() || 0;
            return da - db2;
          })
          .slice(0, 3);

        // 6. 최근 가입자
        const recentQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentSnap = await getDocs(recentQuery);

        setStats({ totalUsers: usersSnap.size, monthlyNewUsers, prevMonthlyNewUsers, weeklyApps, prevWeeklyApps, monthlyApps, prevMonthlyApps, totalApps: allApps.length, matchCount, monthlyMatchCount, prevMonthlyMatchCount, monthlyRevenue, prevMonthlyRevenue });
        setGenderData([
          { name: '남성', value: maleCount + femaleCount > 0 ? Math.round((maleCount / (maleCount + femaleCount)) * 100) : 50, color: '#60a5fa' },
          { name: '여성', value: maleCount + femaleCount > 0 ? Math.round((femaleCount / (maleCount + femaleCount)) * 100) : 50, color: '#FF6F61' },
        ]);
        setChartData(chart);
        setUpcomingEvents(upcoming);
        setRecentUsers(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 7. 최근 신청자 가공
        const sessionMap: Record<string, string> = {};
        sessionsSnap.docs.forEach(doc => {
          const s = doc.data();
          sessionMap[doc.id] = `${s.region === 'busan' ? '부산' : '창원'} ${s.episodeNumber}기`;
        });

        const recentAppsData = allApps
          .sort((a: any, b: any) => (toDate(b.appliedAt)?.getTime() || 0) - (toDate(a.appliedAt)?.getTime() || 0))
          .slice(0, 5)
          .map((app: any) => ({
            ...app,
            sessionName: sessionMap[app.sessionId] || '알 수 없음'
          }));
        setRecentApps(recentAppsData);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatRevenue = (n: number) => `₩${n.toLocaleString()}`;

  const calcTrend = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

  const statsCards = [
    { label: '가입자',    icon: Users,      color: '#FF6F61', monthlyNew: stats.monthlyNewUsers,   monthlyNewLabel: '이번 달', subValue: stats.totalUsers.toLocaleString(),           subLabel: '누적', trend: calcTrend(stats.monthlyNewUsers, stats.prevMonthlyNewUsers) },
    { label: '신청',      icon: UserPlus,   color: '#60a5fa', monthlyNew: stats.monthlyApps,       monthlyNewLabel: '이번 달', subValue: stats.totalApps.toLocaleString(),            subLabel: '누적', trend: calcTrend(stats.monthlyApps, stats.prevMonthlyApps) },
    { label: '매칭 커플', icon: Heart,      color: '#f472b6', monthlyNew: stats.monthlyMatchCount, monthlyNewLabel: '이번 달', subValue: stats.matchCount.toLocaleString(),           subLabel: '누적', trend: calcTrend(stats.monthlyMatchCount, stats.prevMonthlyMatchCount) },
    { label: '매출',      icon: TrendingUp, color: '#4ade80', monthlyNew: stats.monthlyRevenue,    monthlyNewLabel: '이번 달', subValue: formatRevenue(stats.prevMonthlyRevenue),     subLabel: '전월', trend: calcTrend(stats.monthlyRevenue, stats.prevMonthlyRevenue) },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-400">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0F172A' }}>대시보드</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 2 }}>실시간 데이터와 서비스 현황을 한눈에 확인합니다. <span className="text-[10px] font-bold text-[#FF6F61] ml-2">v1.0.1 Premium</span></p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s, i) => (
          <div key={i} style={{ ...panel, padding: '16px 20px' }} className="hover:border-slate-300 transition-colors group">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${s.color}14` }}>
                <s.icon size={15} style={{ color: s.color }} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{s.label}</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-2/3" />
            ) : (
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.1 }}>
                      {s.label === '매출' ? formatRevenue(s.monthlyNew as number) : (s.monthlyNew ?? 0)}
                      {(s.label === '가입자' || s.label === '신청') && <span style={{ fontSize: '1rem', fontWeight: 600, marginLeft: 2 }}>명</span>}
                      {s.label === '매칭 커플' && <span style={{ fontSize: '1rem', fontWeight: 600, marginLeft: 2 }}>커플</span>}
                    </p>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 5px', borderRadius: 5,
                      color: s.trend >= 0 ? '#16a34a' : '#dc2626',
                      background: s.trend >= 0 ? '#dcfce7' : '#fee2e2',
                    }}>
                      {s.trend >= 0 ? '+' : ''}{s.trend}%
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>{s.monthlyNewLabel}</p>
                </div>
                <div className="text-right shrink-0">
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#cbd5e1', lineHeight: 1.1 }}>{s.subValue}</p>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 4 }}>{s.subLabel}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Row 2: Recent Users & Recent Applicants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 최근 가입자 */}
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
                  {['이름', '이메일', '상태', '가입일'].map(h => (
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
                      <td colSpan={4} style={{ padding: '12px 24px' }}><Skeleton className="h-6 w-full" /></td>
                    </tr>
                  ))
                ) : recentUsers.length > 0 ? (
                  recentUsers.map((m: any) => {
                    const s = STATUS[m.status as keyof typeof STATUS] || STATUS.pending;
                    const d = toDate(m.createdAt);
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover:bg-white/[0.02] transition-colors">
                        <td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600 }}>{m.name || '미입력'}</td>
                        <td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666' }}>{m.email}</td>
                        <td style={{ padding: '12px 24px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: s.color, background: s.bg }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555' }}>
                          {d ? format(d, 'yyyy-MM-dd') : '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>가입자가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 최근 신청자 */}
        <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>최근 신청자</h3>
            <Link href="/admin/applications" className="flex items-center gap-1 transition-colors hover:text-white" style={{ fontSize: '0.78rem', color: '#555' }}>
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['이름', '신청 기수', '상태', '신청일'].map(h => (
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
                      <td colSpan={4} style={{ padding: '12px 24px' }}><Skeleton className="h-6 w-full" /></td>
                    </tr>
                  ))
                ) : recentApps.length > 0 ? (
                  recentApps.map((a: any) => {
                    const d = toDate(a.appliedAt);
                    const isConfirmed = a.status === 'confirmed' || a.paymentConfirmed === true;
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover:bg-white/[0.02] transition-colors">
                        <td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600 }}>{a.name}</td>
                        <td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666' }}>{a.sessionName}</td>
                        <td style={{ padding: '12px 24px' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 600, 
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            color: isConfirmed ? '#4ade80' : '#facc15', 
                            background: isConfirmed ? 'rgba(74,222,128,0.1)' : 'rgba(250,204,21,0.1)' 
                          }}>
                            {isConfirmed ? '확정' : (a.status === 'applied' ? '검토 중' : '대기')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555' }}>
                          {d ? format(d, 'MM-dd HH:mm') : '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px 24px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>신청자가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Row 3: Trends (3/5) & Gender (2/5) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 주간 신청 추이 */}
        <div style={{ ...panel, padding: '24px' }} className="lg:col-span-4">
          <div className="flex items-center justify-between mb-6">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>주간 신청 및 확정 추이</h3>
            <span style={{ fontSize: '0.75rem', color: '#444' }}>최근 7일</span>
          </div>
          <div style={{ height: 220 }}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-[#FF6F61]" size={32} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Area type="monotone" dataKey="applicants" stroke="#FF6F61" strokeWidth={2} fill="url(#gA)" name="신청" />
                  <Area type="monotone" dataKey="matches"    stroke="#60a5fa" strokeWidth={2} fill="url(#gM)" name="확정" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex gap-5 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {[['#FF6F61', '신청'], ['#60a5fa', '확정']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-2">
                <div style={{ width: 12, height: 2, borderRadius: 2, background: c }} />
                <span style={{ fontSize: '0.75rem', color: '#555' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 성별 비율 */}
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

      {/* Bottom row (Upcoming Events) */}
      <div className="grid grid-cols-1 gap-6">
        {/* 예정 행사 */}
        <div style={{ ...panel, padding: '24px' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="flex items-center gap-2" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              <CalendarCheck size={15} style={{ color: '#facc15' }} /> 진행 예정 기수
            </h3>
            <Link href="/admin/events" className="flex items-center gap-1 transition-colors hover:text-white" style={{ fontSize: '0.78rem', color: '#555' }}>
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map((ev: any) => {
                const d = toDate(ev.eventDate);
                const regionLabel = ev.region === 'busan' ? '부산' : '창원';
                return (
                  <div key={ev.id} className="flex items-center gap-4 rounded-xl transition-colors hover:bg-white/[0.04]" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: 'rgba(255,111,97,0.08)' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FF6F61' }}>{ev.episodeNumber}기</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{regionLabel} 키링크 {ev.episodeNumber}기</p>
                      <p className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                        <Clock size={10} />
                        {d ? format(d, 'M월 d일 (E) HH:mm', { locale: ko }) : '날짜 미정'}
                        {ev.venue && ` · ${ev.venue}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa' }}>
                        남 {ev.currentMale || 0}/{ev.maxMale || 0}
                      </p>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa' }}>
                        여 {ev.currentFemale || 0}/{ev.maxFemale || 0}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 text-center py-10 text-gray-600 text-sm">진행 예정인 기수가 없습니다.</div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
