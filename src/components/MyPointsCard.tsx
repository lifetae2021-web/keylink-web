'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { MIN_REDEEM_POINTS } from '@/lib/pointsConfig';

const PLUS_TYPES = ['earn', 'add', 'refund'];
const COLLAPSED_COUNT = 3;
const PAGE_SIZE = 20;

function formatDate(ts: any): string {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const moreButtonStyle: React.CSSProperties = {
  marginTop: '4px', padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
  background: '#FFF5F4', color: '#FF6F61', fontWeight: 800, fontSize: '0.82rem',
};

/** 마이페이지 내 포인트 잔액 + 최근 내역 */
export default function MyPointsCard({ uid, balance }: { uid: string; balance: number }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  // 접힌 상태에선 최근 3개만, 펼치면 20개씩 더 불러옴 (+1개 더 읽어서 다음 페이지 유무 판단)
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const fetchCount = expanded ? pageLimit + 1 : COLLAPSED_COUNT + 1;

  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'pointHistory'), orderBy('createdAt', 'desc'), limit(fetchCount));
    return onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, [uid, fetchCount]);

  const visibleLogs = logs.slice(0, fetchCount - 1);
  const hasMore = logs.length >= fetchCount;

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '16px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🪙</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111' }}>내 포인트</h2>
        </div>
        <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#FF6F61' }}>{balance.toLocaleString()}P</span>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: '600', lineHeight: 1.6, marginBottom: visibleLogs.length > 0 ? '14px' : 0 }}>
        매일 방문 시 100P · 사이트에 떨어지는 포인트를 주워보세요!<br />
        {MIN_REDEEM_POINTS.toLocaleString()}P부터 신청 시 사용 가능 · 적립일로부터 1년간 유효
      </p>
      {visibleLogs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visibleLogs.map(log => {
            const isPlus = PLUS_TYPES.includes(log.type);
            return (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>{log.reason || '포인트'}</p>
                  <p style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>{formatDate(log.createdAt)}</p>
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: isPlus ? '#10B981' : '#94A3B8' }}>
                  {isPlus ? '+' : '-'}{(log.amount || 0).toLocaleString()}P
                </span>
              </div>
            );
          })}
          {!expanded && hasMore && (
            <button type="button" onClick={() => setExpanded(true)} style={moreButtonStyle}>전체 내역 보기</button>
          )}
          {expanded && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {hasMore && (
                <button type="button" onClick={() => setPageLimit(n => n + PAGE_SIZE)} style={{ ...moreButtonStyle, flex: 1 }}>더 보기</button>
              )}
              <button type="button" onClick={() => { setExpanded(false); setPageLimit(PAGE_SIZE); }} style={{ ...moreButtonStyle, flex: 1 }}>접기</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
