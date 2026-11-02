'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

const PLUS_TYPES = ['earn', 'add', 'refund'];
const COLLAPSED_COUNT = 5;

// 회원 포인트 적립/사용 내역 (users/{uid}/pointHistory) - 잔액은 프로필 이름 옆에 표시
export default function AdminPointsSection({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // 접힌 상태에선 1개 더 읽어서 "전체 보기" 버튼 노출 여부 판단
    const base = collection(db, 'users', userId, 'pointHistory');
    const q = expanded ? query(base, orderBy('createdAt', 'desc')) : query(base, orderBy('createdAt', 'desc'), limit(COLLAPSED_COUNT + 1));
    return onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('pointHistory load failed', err));
  }, [userId, expanded]);

  const visibleLogs = expanded ? logs : logs.slice(0, COLLAPSED_COUNT);
  const hasMore = !expanded && logs.length > COLLAPSED_COUNT;

  const formatDate = (ts: any) => {
    const d = ts?.toDate?.();
    if (!d) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div id="admin-points-section" className="pt-6 pb-2 scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 bg-orange-400 rounded-full" />
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Points</span>
      </div>

      {visibleLogs.length === 0 ? (
        <p className="text-xs text-slate-300 italic text-center py-3">포인트 내역이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {visibleLogs.map(log => {
            const isPlus = PLUS_TYPES.includes(log.type);
            return (
              <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{log.reason || '포인트'}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(log.createdAt)}</p>
                </div>
                <span className={`shrink-0 text-sm font-black ${isPlus ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {isPlus ? '+' : '-'}{(log.amount || 0).toLocaleString()}P
                </span>
              </div>
            );
          })}
          {(hasMore || expanded) && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full py-2 rounded-2xl bg-orange-50 text-orange-500 text-xs font-black hover:bg-orange-100 transition-colors"
            >
              {expanded ? '접기' : '전체 내역 보기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
