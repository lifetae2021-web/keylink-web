'use client';

import {
  Users, Calendar, Heart, TrendingUp,
  ArrowUpRight, ArrowDownRight, Clock,
  CalendarCheck, UserPlus, ChevronRight, Zap
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';

const STATS = [
  { label: '누적 가입자',    value: '1,847', change: '+12%', up: true,  icon: Users,    color: '#FF6F61' },
  { label: '이번 주 신청',   value: '154',   change: '+8%',  up: true,  icon: UserPlus, color: '#60a5fa' },
  { label: '매칭 성공 커플', value: '624',   change: '-2%',  up: false, icon: Heart,    color: '#f472b6' },
  { label: '이번 달 매출',   value: '₩3.8M', change: '+5%',  up: true,  icon: TrendingUp, color: '#4ade80' },
];

const WEEKLY = [
  { day: '월', applicants: 12, matches: 4 },
  { day: '화', applicants: 18, matches: 6 },
  { day: '수', applicants: 25, matches: 8 },
  { day: '목', applicants: 20, matches: 5 },
  { day: '금', applicants: 32, matches: 12 },
  { day: '토', applicants: 45, matches: 18 },
  { day: '일', applicants: 38, matches: 15 },
];

const GENDER = [
  { name: '남성', value: 52, color: '#60a5fa' },
  { name: '여성', value: 48, color: '#FF6F61' },
];

const UPCOMING = [
  { episode: 120, date: '4월 26일 (토) 14:00', venue: '서면 인근', rate: 87 },
  { episode: 121, date: '5월 3일 (토) 14:00',  venue: '서면 인근', rate: 31 },
  { episode: 122, date: '5월 10일 (토) 14:00', venue: '해운대 인근', rate: 0 },
];

const RECENT_MEMBERS = [
  { name: '박준형', email: 'junh@naver.com',  job: '네이버 개발자',  status: 'pending',  joined: '2024-04-15' },
  { name: '이서윤', email: 'syun@daum.net',   job: '초등학교 교사', status: 'pending',  joined: '2024-04-16' },
  { name: '김지민', email: 'jimin@gmail.com', job: '삼성전자 연구원', status: 'verified', joined: '2024-04-10' },
  { name: '최현우', email: 'hwoo@kakao.com',  job: '카카오 디자이너', status: 'verified', joined: '2024-04-12' },
  { name: '정다혜', email: 'dahye@gmail.com', job: '전문직(약사)',   status: 'rejected', joined: '2024-04-08' },
];

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
          <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>운영 중</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s, i) => (
          <div key={i} style={{ ...panel, padding: '20px 24px' }} className="hover:border-white/10 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}14` }}>
                <s.icon size={17} style={{ color: s.color }} />
              </div>
              <span className="flex items-center gap-0.5" style={{ fontSize: '0.75rem', fontWeight: 700, color: s.up ? '#4ade80' : '#ef4444' }}>
                {s.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {s.change}
              </span>
            </div>
            <p style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</p>
            <p style={{ fontSize: '0.78rem', color: '#555', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly trend */}
        <div style={{ ...panel, padding: '24px' }} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>주간 신청 및 매칭 추이</h3>
            <span style={{ fontSize: '0.75rem', color: '#444' }}>최근 7일</span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEKLY} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={GENDER} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                  {GENDER.map((g, i) => <Cell key={i} fill={g.color} strokeWidth={0} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>1,847</span>
              <span style={{ fontSize: '0.7rem', color: '#555', marginTop: 2 }}>전체 회원</span>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {GENDER.map(g => (
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
            <Link href="/admin/events" className="flex items-center gap-1 transition-colors" style={{ fontSize: '0.78rem', color: '#555' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {UPCOMING.map(ev => (
              <div key={ev.episode} className="flex items-center gap-4 rounded-xl transition-colors" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: 'rgba(255,111,97,0.08)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FF6F61' }}>{ev.episode}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>부산 {ev.episode}기</p>
                  <p className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                    <Clock size={10} /> {ev.date} · {ev.venue}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>{ev.rate}%</p>
                  <div style={{ width: 72, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${ev.rate}%`, height: '100%', borderRadius: 4,
                      background: ev.rate >= 70 ? '#4ade80' : ev.rate >= 40 ? '#FF6F61' : '#60a5fa'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions + pending alert */}
        <div className="space-y-4">
          <div style={{ ...panel, padding: '24px' }}>
            <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              <Zap size={15} style={{ color: '#FF6F61' }} /> 빠른 메뉴
            </h3>
            <div className="space-y-1.5">
              {[
                { label: '신청자 승인', desc: '대기 중 2명', href: '/admin/users', color: '#60a5fa' },
                { label: '행사 등록',   desc: '새 기수 만들기', href: '/admin/events', color: '#4ade80' },
                { label: '매칭 실행',   desc: '120기 준비 완료', href: '/admin/events', color: '#FF6F61' },
              ].map(a => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex items-center gap-3 rounded-lg transition-colors"
                  style={{ padding: '11px 14px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#facc15' }}>승인 대기</span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#aaa' }}>
              신원인증 대기 신청자 <strong style={{ color: '#fff' }}>2명</strong>
            </p>
            <Link href="/admin/users" style={{ fontSize: '0.75rem', color: '#facc15', marginTop: 8, display: 'inline-block' }}>
              지금 처리하기 →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent members table */}
      <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>최근 가입자</h3>
          <Link href="/admin/users" className="flex items-center gap-1" style={{ fontSize: '0.78rem', color: '#555' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            전체 보기 <ChevronRight size={12} />
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['이름', '이메일', '직업', '상태', '가입일'].map(h => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_MEMBERS.map((m, i) => {
                const s = STATUS[m.status as keyof typeof STATUS];
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600 }}>{m.name}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666' }}>{m.email}</td>
                    <td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#888' }}>{m.job}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: s.color, background: s.bg }}>
                        {s.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555' }}>{m.joined}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
