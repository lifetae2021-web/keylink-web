'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { ChevronLeft, ChevronRight, Clock, Loader2, MousePointerClick, User, Calendar as CalendarIcon } from 'lucide-react';
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

  const renderCalendar = () => {
    return (
      <div style={panel} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <CalendarIcon size={20} className="text-[#8b5cf6]" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111' }}>
              방문자 통계 달력
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
            
            return (
              <div 
                key={dateKey}
                onClick={() => setSelectedDate(day)}
                className={`
                  min-h-[90px] border-b border-r border-gray-100 p-2 cursor-pointer transition-all
                  ${!isCurrentMonth ? 'bg-gray-50/50' : 'hover:bg-gray-50'}
                  ${isSelected ? 'ring-2 ring-inset ring-[#FF6F61] bg-[#FF6F61]/5' : ''}
                `}
              >
                <div className="flex justify-between items-start">
                  <span className={`
                    text-sm font-semibold flex items-center justify-center w-6 h-6 rounded-full
                    ${!isCurrentMonth ? 'text-gray-400' : (i%7===0 ? 'text-red-500' : i%7===6 ? 'text-blue-500' : 'text-gray-700')}
                    ${today ? 'bg-[#FF6F61] text-white' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                  {dayData?.uv > 0 && (
                    <span className="text-xs font-bold text-[#8b5cf6] bg-[#8b5cf6]/10 px-2 py-0.5 rounded-full">
                      UV {dayData.uv}
                    </span>
                  )}
                </div>
                
                {dayData?.uv > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {/* Show up to 3 avatars/names */}
                    {dayData.visitors.slice(0, 3).map((v: any, idx: number) => (
                      <div key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[60px]" title={v.name}>
                        {v.name}
                      </div>
                    ))}
                    {dayData.visitors.length > 3 && (
                      <div className="text-[10px] text-gray-400 px-1">+{dayData.visitors.length - 3}</div>
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
    
    return (
      <div style={panel} className="overflow-hidden flex flex-col h-full max-h-[600px]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
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
        </div>
        
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          {!dayData || dayData.visitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p>이 날짜에는 방문 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayData.visitors.map((v: any, idx: number) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6F61]/20 to-[#FF6F61]/10 flex items-center justify-center">
                        <span className="text-[#FF6F61] font-bold text-xs">
                          {v.name.slice(0, 1)}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">
                          {v.name}
                          {v.userId ? '' : <span className="text-xs text-gray-400 ml-1">(비회원)</span>}
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
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0F172A' }}>통계 달력</h2>
          <p className="text-sm text-gray-500 mt-1">월별 방문자(UV) 추이와 날짜별 상세 방문 기록을 확인하세요.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#FF6F61] mb-4" size={40} />
          <p className="text-gray-500 font-medium">데이터를 불러오는 중입니다...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderCalendar()}
            
            {/* Top Pages (Monthly) */}
            <div style={panel} className="mt-6 p-6">
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
          </div>
          <div className="lg:col-span-1">
            {renderVisitorList()}
          </div>
        </div>
      )}
    </div>
  );
}
