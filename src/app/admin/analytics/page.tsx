'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { ChevronLeft, ChevronRight, Clock, Loader2, MousePointerClick, User } from 'lucide-react';
import Link from 'next/link';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday
} from 'date-fns';
import { ko } from 'date-fns/locale';

const panel = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

// 대한민국 법정공휴일 (대체공휴일 포함). 음력 기반 명절 날짜는 매년 바뀌므로 연도별로 수기 관리.
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체공휴일(삼일절)',
  '2025-05-05': '어린이날·부처님오신날',
  '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일(추석)',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',
  // 2026
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-06': '현충일',
  '2026-07-17': '제헌절',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일(개천절)',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',
  // 2027
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일(설날)',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-09': '한글날',
  '2027-12-25': '크리스마스',
};

const PATH_MAP: Record<string, string> = {
  '/': '🏠 메인 페이지',
  '/apply/fast': '⚡️ 간편 신청',
  '/mypage': '👤 마이페이지',
  '/login': '🔑 로그인',
  '/status': '📋 진행 현황',
  '/events': '📅 행사 안내',
  '/matching-results': '💘 매칭 결과',
  '/notices': '📢 공지사항',
  '/admin': '⚙️ 관리자 메인',
};

function formatPathName(path: string) {
  if (PATH_MAP[path]) return PATH_MAP[path];
  if (path.startsWith('/admin')) return '⚙️ 관리자 (' + path.replace('/admin', '') + ')';
  if (path.length > 20) return path.slice(0, 20) + '...';
  return path;
}

const clientCalendarCache: Record<string, { data: Record<string, any>; topPages: any[] }> = {};

export default function AnalyticsCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [visitorGenderFilter, setVisitorGenderFilter] = useState<'all' | 'male' | 'female' | 'guest'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [calendarData, setCalendarData] = useState<Record<string, any>>({});
  
  // For top pages (overall month) - calculating on the fly from calendar data
  const [topPages, setTopPages] = useState<any[]>([]);

  useEffect(() => {
    async function fetchCalendar() {
      const monthStr = format(currentMonth, 'yyyy-MM');
      const cacheKey = `kl_calendar_${monthStr}`;
      let hasCached = false;

      // 1. 인메모리 또는 sessionStorage 캐시 즉시 적용 (제로 버퍼링 로딩)
      if (clientCalendarCache[monthStr]) {
        setCalendarData(clientCalendarCache[monthStr].data);
        setTopPages(clientCalendarCache[monthStr].topPages);
        setIsLoading(false);
        hasCached = true;
      } else {
        try {
          const stored = sessionStorage.getItem(cacheKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            clientCalendarCache[monthStr] = parsed;
            setCalendarData(parsed.data);
            setTopPages(parsed.topPages);
            setIsLoading(false);
            hasCached = true;
          } else {
            setIsLoading(true);
          }
        } catch {
          setIsLoading(true);
        }
      }

      // 2. 백그라운드 최신 데이터 동기화 (SWR)
      try {
        const res = await fetch(`/api/admin/analytics/calendar?month=${monthStr}`);
        const json = await res.json();
        
        if (json.success) {
          setCalendarData(json.data);
          
          // Calculate top pages for the month
          const pageCounts: Record<string, number> = {};
          Object.values(json.data).forEach((dayObj: any) => {
            dayObj.visitors.forEach((v: any) => {
              v.paths.forEach((p: string) => {
                pageCounts[p] = (pageCounts[p] || 0) + 1;
              });
            });
          });
          
          const sortedPages = Object.entries(pageCounts)
            .map(([path, count]) => ({ path, count, pathName: formatPathName(path) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
            
          setTopPages(sortedPages);

          const cachePayload = { data: json.data, topPages: sortedPages };
          clientCalendarCache[monthStr] = cachePayload;
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(cachePayload));
          } catch {}
        }
      } catch (error) {
        console.error('Failed to fetch calendar data', error);
      } finally {
        if (!hasCached) setIsLoading(false);
      }
    }
    fetchCalendar();
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Calendar Grid generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // 이번 달 요약 통계 (총 방문자 / 일 평균 / 최고 방문일)
  const monthSummary = useMemo(() => {
    let totalUV = 0;
    let daysWithData = 0;
    let peakDate: string | null = null;
    let peakUV = 0;

    eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const uv = calendarData[dateKey]?.uv || 0;
      if (uv > 0) {
        totalUV += uv;
        daysWithData += 1;
        if (uv > peakUV) {
          peakUV = uv;
          peakDate = dateKey;
        }
      }
    });

    return {
      totalUV,
      avgUV: daysWithData > 0 ? Math.round(totalUV / daysWithData) : 0,
      peakDate,
      peakUV,
    };
  }, [calendarData, monthStart, monthEnd]);

  const renderCalendar = () => {
    return (
      <div style={panel} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111' }}>
              통계 달력
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-gray-800 w-24 text-center">
              {format(currentMonth, 'yyyy년 M월')}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="px-6 py-2 flex items-center gap-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[11px] text-gray-400">남성</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span className="text-[11px] text-gray-400">여성</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="text-[11px] text-gray-400">비회원</span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`py-2 text-center text-xs font-semibold ${i===0 ? 'text-red-500' : i===6 ? 'text-blue-500' : 'text-gray-500'}`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 bg-white">
          {days.map((day, i) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = calendarData[dateKey];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const today = isToday(day);
            const holidayName = KOREAN_HOLIDAYS[dateKey];
            const isRedDay = i % 7 === 0 || !!holidayName; // 일요일 또는 공휴일

            const visitors: any[] = dayData?.visitors || [];
            const maleCount = visitors.filter(v => v.gender === 'male').length;
            const femaleCount = visitors.filter(v => v.gender === 'female').length;
            const guestCount = visitors.filter(v => !v.userId).length;

            return (
              <div
                key={dateKey}
                onClick={() => setSelectedDate(day)}
                title={holidayName}
                className={`
                  min-h-[92px] border-b border-r border-gray-100 p-2 cursor-pointer transition-colors
                  ${!isCurrentMonth ? 'bg-gray-50/50' : 'hover:bg-gray-50'}
                  ${isSelected ? 'ring-2 ring-inset ring-[#FF6F61] bg-[#FF6F61]/[0.04]' : ''}
                `}
              >
                <div className="flex justify-between items-start">
                  <span className={`
                    text-sm font-semibold flex items-center justify-center w-6 h-6 rounded-full transition-colors
                    ${!isCurrentMonth ? 'text-gray-300' : (isRedDay ? 'text-red-500' : i%7===6 ? 'text-blue-500' : 'text-gray-700')}
                    ${today ? 'bg-[#FF6F61] text-white' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                  {dayData?.uv > 0 && (
                    <span className="text-[11px] font-bold text-[#8b5cf6] bg-[#8b5cf6]/10 px-1.5 py-0.5 rounded-full">
                      {dayData.uv}
                    </span>
                  )}
                </div>
                {holidayName && isCurrentMonth && (
                  <div className="text-[9px] font-semibold text-red-400 truncate mt-0.5">{holidayName}</div>
                )}

                {dayData?.uv > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {maleCount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-gray-500">{maleCount}</span>
                      </div>
                    )}
                    {femaleCount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-gray-500">{femaleCount}</span>
                      </div>
                    )}
                    {guestCount > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                        <span className="text-[10px] font-semibold text-gray-400">{guestCount}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderVisitorList = () => {
    if (!selectedDate) return null;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];

    const allVisitors: any[] = dayData?.visitors || [];
    const counts = {
      all: allVisitors.length,
      male: allVisitors.filter(v => v.gender === 'male').length,
      female: allVisitors.filter(v => v.gender === 'female').length,
      guest: allVisitors.filter(v => !v.userId).length,
    };
    const filteredVisitors = allVisitors.filter(v => {
      if (visitorGenderFilter === 'male') return v.gender === 'male';
      if (visitorGenderFilter === 'female') return v.gender === 'female';
      if (visitorGenderFilter === 'guest') return !v.userId;
      return true;
    });

    return (
      <div style={panel} className="overflow-hidden flex flex-col h-full max-h-[600px]">
        <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 mb-3">
            <User size={18} className="text-[#FF6F61]" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>
              {format(selectedDate, 'M월 d일')} 방문자
            </h3>
            {dayData?.uv > 0 && (
              <span className="bg-[#FF6F61] text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                총 {dayData.uv}명
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {([
              ['all', '전체'],
              ['male', '남성'],
              ['female', '여성'],
              ['guest', '비회원'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setVisitorGenderFilter(key)}
                className="rounded-full transition-colors"
                style={{
                  padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700,
                  border: `1px solid ${visitorGenderFilter === key ? '#FF6F61' : '#e2e8f0'}`,
                  background: visitorGenderFilter === key ? 'rgba(255,111,97,0.08)' : '#fff',
                  color: visitorGenderFilter === key ? '#FF6F61' : '#64748b',
                }}
              >
                {label} {counts[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {!dayData || filteredVisitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p>{!dayData || dayData.visitors.length === 0 ? '이 날짜에는 방문 기록이 없습니다.' : '해당 조건의 방문자가 없습니다.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVisitors.map((v: any, idx: number) => {
                const avatarColor = v.gender === 'male' ? '#3b82f6' : v.gender === 'female' ? '#f43f5e' : '#94a3b8';
                return (
                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${avatarColor}18` }}>
                        <span className="font-bold text-xs" style={{ color: avatarColor }}>
                          {v.name.slice(0, 1)}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                          {v.name}
                          {!v.userId && <span className="text-xs text-gray-400">(비회원)</span>}
                          {v.gender === 'male' && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">남성</span>}
                          {v.gender === 'female' && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">여성</span>}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          마지막 활동: {format(new Date(v.lastSeenAt), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      활동 {v.hitCount}회
                    </div>
                  </div>
                  <div className="mt-2 pl-10">
                    <div className="flex flex-wrap gap-1.5">
                      {v.paths.map((p: string, pIdx: number) => (
                        <span key={pIdx} className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                          {formatPathName(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-20">
      <div className="flex items-center">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ChevronLeft size={20} />
        </Link>
      </div>

      {!isLoading && (
        <div style={panel} className="p-5 flex items-center divide-x divide-gray-100">
          {[
            { color: '#8b5cf6', label: `${format(currentMonth, 'M월')} 총 방문자`, value: `${monthSummary.totalUV.toLocaleString()}명`, grow: 1 },
            { color: '#FF6F61', label: '일 평균', value: `${monthSummary.avgUV.toLocaleString()}명`, grow: 1 },
            { color: '#f59e0b', label: '최고 방문일', value: monthSummary.peakDate ? `${format(new Date(monthSummary.peakDate), 'M/d')} · ${monthSummary.peakUV}명` : '-', grow: 1.6 },
          ].map((card, i) => (
            <div key={i} style={{ flexGrow: card.grow, flexBasis: 0 }} className="px-5 first:pl-0 last:pr-0 min-w-0">
              <p className="text-xs font-semibold text-gray-400 whitespace-nowrap">{card.label}</p>
              <p className="text-lg font-black mt-0.5 whitespace-nowrap" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#FF6F61] mb-4" size={40} />
          <p className="text-gray-500 font-medium">데이터를 불러오는 중입니다...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderCalendar()}
          </div>
          <div className="lg:col-span-1">
            {renderVisitorList()}
          </div>
        </div>
      )}

      {!isLoading && (
        /* Top Pages (Monthly) */
        <div style={panel} className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MousePointerClick size={18} className="text-[#8b5cf6]" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>이달의 인기 페이지</h3>
          </div>
          <div style={{ height: 200 }}>
            {topPages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPages} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="pathName" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 11, fill: '#666' }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {topPages.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#8b5cf6' : '#c4b5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터가 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
