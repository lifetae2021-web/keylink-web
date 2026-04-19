'use client';

import { useState } from 'react';
import { 
  Users, Calendar, Heart, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Activity,
  CalendarCheck, UserPlus
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// Mock Data for Dashboard
const statsData = [
  { label: '누적 가입자', value: '1,847', change: '+12%', isUp: true, icon: Users, color: '#FF6F61' },
  { label: '이번 주 신청', value: '154', change: '+8%', isUp: true, icon: UserPlus, color: '#6A98C8' },
  { label: '매칭 성공 커플', value: '624', change: '-2%', isUp: false, icon: Heart, color: '#C878A0' },
  { label: '기당 평균 매출', value: '₩3.8M', change: '+5%', isUp: true, icon: TrendingUp, color: '#6EAE7C' },
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

export default function AdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">대시보드</h1>
        <p className="text-gray-400">오늘은 {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })}입니다. 실시간 운영 현황을 확인하세요.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsData.map((stat, idx) => (
          <div key={idx} className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 group-hover:bg-gray-800 transition-colors">
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${stat.isUp ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.change}
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend Chart */}
        <div className="lg:col-span-2 bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-[#FF6F61]" /> 주간 신청 및 매칭 추이
            </h2>
            <select className="bg-[#0F1115] border border-gray-800 text-xs text-gray-400 rounded-lg px-3 py-1.5 focus:outline-none">
              <option>최근 7일</option>
              <option>최근 30일</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData}>
                <defs>
                  <linearGradient id="colorApplicants" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6F61" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF6F61" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
                <XAxis dataKey="day" stroke="#606770" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#606770" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1D23', border: '1px solid #2D3139', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="applicants" stroke="#FF6F61" fillOpacity={1} fill="url(#colorApplicants)" strokeWidth={3} name="신청자 수" />
                <Area type="monotone" dataKey="matches" stroke="#E6E6FA" fillOpacity={0} strokeWidth={2} name="매칭 성사" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Ratio Pie Chart */}
        <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
            <Users size={18} className="text-[#6A98C8]" /> 성별 가입 비율
          </h2>
          <div className="h-[250px] w-full items-center justify-center flex flex-col relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderRatioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {genderRatioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-white">1,847</span>
              <span className="text-xs text-gray-500">Total Users</span>
            </div>
            
            <div className="flex gap-6 mt-4">
              {genderRatioData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-gray-400">{item.name} ({item.value}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <CalendarCheck size={18} className="text-yellow-500" /> 진행 대기 중인 행사
          </h2>
          <div className="space-y-4">
            {[102, 103, 104].map((num) => (
              <div key={num} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                <div>
                  <p className="font-bold text-white">부산 {num}기</p>
                  <p className="text-xs text-gray-500 mt-1">4월 26일 (토) 14:00 · 서면 인근</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">모집률 85%</p>
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FF6F61] to-[#E6E6FA] w-[85%] rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#FF6F61]/10 to-[#E6E6FA]/10 border border-[#FF6F61]/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-xl shadow-[#FF6F61]/20">
            <ShieldCheck size={32} className="text-[#FF6F61]" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">보안 점검 필요 하신가요?</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-[280px]">현재 신원인증 대기 중인 신청자가 12명 있습니다. 빠른 검토가 필요합니다.</p>
          <button className="bg-white text-[#0F1115] font-bold px-6 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
            신원인증 관리 이동
          </button>
        </div>
      </div>
    </div>
  );
}

function ShieldCheck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
