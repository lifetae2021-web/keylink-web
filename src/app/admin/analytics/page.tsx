'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { ChevronLeft, Clock, MapPin, Loader2, MousePointerClick, User } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const panel = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function AnalyticsDetailsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/analytics/details');
        const json = await res.json();
        
        // userId가 있는 방문자의 경우 이름(name)을 가져오기 위한 로직
        const uids = new Set<string>();
        json.recentVisitors?.forEach((v: any) => {
          if (v.userId) uids.add(v.userId);
        });

        const newMap: Record<string, string> = {};
        for (const uid of Array.from(uids)) {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            newMap[uid] = userSnap.data().name || '이름 없음';
          }
        }
        setUserMap(newMap);
        setData(json);
      } catch (error) {
        console.error('Failed to fetch analytics details', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-[#FF6F61] mb-4" size={40} />
        <p className="text-gray-500 font-medium">상세 데이터를 분석하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-400">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0F172A' }}>통계 상세 분석</h2>
          <p className="text-sm text-gray-500 mt-1">최근 24시간 동안의 방문자 활동 및 페이지 조회수 기록입니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Pages Chart */}
        <div style={{ ...panel, padding: '24px' }}>
          <div className="flex items-center gap-2 mb-6">
            <MousePointerClick size={18} className="text-[#8b5cf6]" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>인기 페이지 (Top 10)</h3>
          </div>
          <div style={{ height: 350 }}>
            {data?.topPages?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topPages} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="path" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 11, fill: '#666' }} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {data.topPages.map((entry: any, index: number) => (
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

        {/* Recent Visitors Table */}
        <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User size={18} className="text-[#FF6F61]" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111' }}>실시간 방문자 추적</h3>
            </div>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">
              총 {data?.recentVisitors?.length || 0}명 (최근 50명 노출)
            </span>
          </div>
          
          <div className="max-h-[350px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">방문자 정보</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">최근 방문 페이지</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">마지막 활동</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.recentVisitors?.length > 0 ? (
                  data.recentVisitors.map((v: any, i: number) => {
                    const isMember = !!v.userId;
                    const name = isMember ? userMap[v.userId] || '로딩 중...' : '비회원 (익명)';
                    
                    return (
                      <tr key={v.visitorId + i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isMember ? 'text-blue-600' : 'text-gray-700'}`}>
                              {name}
                            </span>
                            <span className="text-[0.65rem] text-gray-400 font-mono mt-0.5" title="방문자 고유 ID">
                              {v.visitorId.slice(0, 10)}...
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1">
                            {v.paths.map((p: string, idx: number) => (
                              <span key={idx} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded inline-block max-w-[200px] truncate">
                                {p}
                              </span>
                            ))}
                            {v.hitCount > 5 && (
                              <span className="text-[0.65rem] text-gray-400">외 {v.hitCount - 5}건 조회</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {format(new Date(v.lastSeenAt), 'MM-dd HH:mm', { locale: ko })}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-gray-400 text-sm">
                      방문 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
