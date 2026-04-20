'use client';

import {
  Users, Calendar, Heart, TrendingUp,
  ArrowUpRight, ArrowDownRight, Activity,
  CalendarCheck, UserPlus, ShieldCheck,
  Clock, ChevronRight, Zap
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';

const statsData = [
  { label: '누적 가입자', value: '1,847', change: '+12%', isUp: true, icon: Users, color: '#FF6F61', bg: 'rgba(255,111,97,0.08)' },
  { label: '이번 주 신청', value: '154', change: '+8%', isUp: true, icon: UserPlus, color: '#6A98C8', bg: 'rgba(106,152,200,0.08)' },
  { label: '매칭 성공 커플', value: '624', change: '-2%', isUp: false, icon: Heart, color: '#C878A0', bg: 'rgba(200,120,160,0.08)' },
  { label: '기당 평균 매출', value: '₩3.8M', change: '+5%', isUp: true, icon: TrendingUp, color: '#6EAE7C', bg: 'rgba(110,174,124,0.08)' },
];

const genderRatioData = [
  { name: '남성', value: 52, color: '#6A98C8' },
  { name: '여성', value: 48, color: '#FF6F61' },
];

const weeklyTrendData = [
  { day: '월', applicants: 12, matches: 4 },
  { day: '화', applicants: 18, matches: 6 },
  { day: '수', applicants: 25, matches: 8 },
  { day: '목', applicants: 20, matches: 5 },
  { day: '금', applicants: 32, matches: 12 },
  { day: '토', applicants: 45, matches: 18 },
  { day: '일', applicants: 38, matches: 15 },
];

const upcomingEvents = [
  { episode: 102, date: '4월 26일 (토) 14:00', venue: '서면 인근', rate: 85 },
  { episode: 103, date: '5월 3일 (토) 14:00', venue: '해운대 인근', rate: 62 },
  { episode: 104, date: '5월 10일 (토) 14:00', venue: '남포 인근', rate: 40 },
];

const quickActions = [
  { label: '신청자 관리', desc: '승인 대기 12명', href: '/admin/users', color: '#6A98C8', icon: Users },
  { label: '행사 등록', desc: '새 기수 만들기', href: '/admin/events', color: '#6EAE7C', icon: Calendar },
  { label: '매칭 실행', desc: '102기 준비 완료', href: '/admin/events', color: '#FF6F61', icon: Zap },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })} · 실시간 운영 현황
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-semibold">운영 중</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, idx) => (
          <div
            key={idx}
            className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
              <span className={`flex items-center gap-0.5 text-[11px] font-bold ${stat.isUp ? 'text-green-400' : 'text-red-400'}`}>
                {stat.isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-white tracking-tight">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly Trend */}
        <div className="lg:col-span-2 bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-[#FF6F61]" /> 주간 신청 및 매칭 추이
            </h2>
            <span className="text-xs text-gray-600 font-medium">최근 7일</span>
          </div>
          <div className="h-65">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gApplicants" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6F61" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF6F61" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6A98C8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6A98C8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2329" vertical={false} />
                <XAxis dataKey="day" stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#4B5563" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#13161b', border: '1px solid #2D3139', borderRadius: '10px', fontSize: '12px' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Area type="monotone" dataKey="applicants" stroke="#FF6F61" strokeWidth={2.5} fill="url(#gApplicants)" name="신청자" />
                <Area type="monotone" dataKey="matches" stroke="#6A98C8" strokeWidth={2} fill="url(#gMatches)" name="매칭 성사" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 mt-4 pt-4 border-t border-gray-800/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 rounded-full bg-[#FF6F61]" />
              <span className="text-xs text-gray-500">신청자</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 rounded-full bg-[#6A98C8]" />
              <span className="text-xs text-gray-500">매칭 성사</span>
            </div>
          </div>
        </div>

        {/* Gender Ratio */}
        <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
            <Users size={16} className="text-[#6A98C8]" /> 성별 비율
          </h2>
          <div className="relative h-45">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderRatioData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                  {genderRatioData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold text-white">1,847</span>
              <span className="text-[10px] text-gray-500 mt-0.5">전체 회원</span>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {genderRatioData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-400">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                  <span className="text-sm font-bold text-white w-8 text-right">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming Events */}
        <div className="lg:col-span-2 bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarCheck size={16} className="text-yellow-400" /> 진행 예정 행사
            </h2>
            <Link href="/admin/events" className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
              전체 보기 <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((ev) => (
              <div key={ev.episode} className="flex items-center gap-4 p-4 bg-gray-900/40 rounded-xl border border-gray-800/60 hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#FF6F61]/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-extrabold text-[#FF6F61]">{ev.episode}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">부산 {ev.episode}기</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <Clock size={11} /> {ev.date} · {ev.venue}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-white mb-1.5">{ev.rate}%</p>
                  <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ev.rate}%`,
                        background: ev.rate >= 80 ? '#6EAE7C' : ev.rate >= 50 ? '#FF6F61' : '#6A98C8'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#FF6F61]" /> 빠른 메뉴
          </h2>
          <div className="space-y-2">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/30 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${action.color}15` }}>
                  <action.icon size={16} style={{ color: action.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>

          <div className="mt-4 p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <p className="text-xs font-bold text-yellow-400">승인 대기</p>
            </div>
            <p className="text-sm text-gray-300">신원인증 대기 중인 신청자 <span className="font-bold text-white">12명</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
