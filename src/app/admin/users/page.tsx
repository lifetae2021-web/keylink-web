'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, ShieldCheck, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, doc, updateDoc, query, orderBy, Timestamp 
} from 'firebase/firestore';
import { format } from 'date-fns';

type Status = 'all' | 'pending' | 'verified' | 'rejected';

const STATUS_CFG = {
  verified: { label: '인증 완료', color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  pending:  { label: '승인 대기', color: '#facc15', bg: 'rgba(250,204,21,0.1)'  },
  rejected: { label: '인증 반려', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

const TABS: { key: Status; label: string }[] = [
  { key: 'all',      label: '전체'    },
  { key: 'pending',  label: '승인 대기' },
  { key: 'verified', label: '인증 완료' },
  { key: 'rejected', label: '반려'    },
];

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 };

// Table Skeleton
const TableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <tr key={i} className="animate-pulse">
        <td style={{ padding: '14px 20px' }}><div className="h-10 w-40 bg-white/5 rounded"></div></td>
        <td style={{ padding: '14px 20px' }}><div className="h-8 w-24 bg-white/5 rounded"></div></td>
        <td style={{ padding: '14px 20px' }}><div className="h-6 w-20 bg-white/5 rounded-full"></div></td>
        <td style={{ padding: '14px 20px' }}><div className="h-6 w-24 bg-white/5 rounded"></div></td>
        <td style={{ padding: '14px 20px' }} className="text-right"><div className="h-8 w-16 bg-white/5 rounded ml-auto"></div></td>
      </tr>
    ))}
  </>
);

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Status>('all');

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('회원 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const counts = {
    all:      users.length,
    pending:  users.filter(u => (u.status || 'pending') === 'pending').length,
    verified: users.filter(u => u.status === 'verified').length,
    rejected: users.filter(u => u.status === 'rejected').length,
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = 
      (u.name || '').toLowerCase().includes(q) || 
      (u.job || '').toLowerCase().includes(q) || 
      (u.email || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (u.status || 'pending') === filter;
    return matchSearch && matchFilter;
  });

  const approve = async (id: string, name: string) => {
    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { 
        status: 'verified',
        updatedAt: Timestamp.now()
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'verified' } : u));
      toast.success(`${name} 승인 완료`);
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const reject = async (id: string, name: string) => {
    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { 
        status: 'rejected',
        updatedAt: Timestamp.now()
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'rejected' } : u));
      toast.error(`${name} 반려 처리`);
    } catch (error) {
      console.error('Rejection error:', error);
      toast.error('반려 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>회원 관리</h2>
          <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>전체 가입자 현황 및 회원 정보를 관리합니다. <span className="text-[10px] opacity-30">v3.5.0</span></p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg transition-colors hover:text-white"
          style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
        >
          <Download size={14} /> CSV 다운로드
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex items-center gap-2 rounded-lg transition-all duration-150"
            style={{
              padding: '7px 16px',
              fontSize: '0.82rem',
              fontWeight: filter === t.key ? 600 : 400,
              color: filter === t.key ? '#FF6F61' : '#555',
              background: filter === t.key ? 'rgba(255,111,97,0.08)' : 'transparent',
              border: `1px solid ${filter === t.key ? 'rgba(255,111,97,0.25)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            {t.label}
            <span
              style={{
                fontSize: '0.65rem', fontWeight: 700,
                padding: '1px 6px', borderRadius: 10,
                background: filter === t.key ? '#FF6F61' : 'rgba(255,255,255,0.06)',
                color: filter === t.key ? '#fff' : '#555',
              }}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}

        {/* Search */}
        <div className="relative ml-auto w-full sm:w-auto mt-4 sm:mt-0">
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
          <input
            type="text"
            placeholder="이름, 직업, 이메일 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '7px 14px 7px 34px',
              fontSize: '0.82rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: '#ccc',
              outline: 'none',
              width: '100%',
            }}
            className="sm:w-[220px]"
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...panel, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <TableSkeleton />
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p style={{ color: '#555', fontSize: '0.88rem' }}>회원 데이터가 없습니다.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['회원정보', '직업 / 나이', '상태', '가입일', '관리'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 20px',
                        textAlign: i === 4 ? 'right' : 'left',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#444',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const currentStatus = (u.status || 'pending') as keyof typeof STATUS_CFG;
                  const sc = STATUS_CFG[currentStatus];
                  return (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'default' }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* 회원정보 */}
                      <td style={{ padding: '14px 20px' }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="relative flex items-center justify-center rounded-xl font-bold"
                            style={{
                              width: 36, height: 36, fontSize: '0.85rem',
                              background: u.gender === 'male' ? 'rgba(96,165,250,0.1)' : 'rgba(244,114,182,0.1)',
                              color:      u.gender === 'male' ? '#60a5fa'              : '#f472b6',
                            }}
                          >
                            {u.name ? u.name[0] : 'U'}
                            {u.status === 'verified' && (
                              <span
                                className="absolute flex items-center justify-center rounded-full"
                                style={{ width: 14, height: 14, bottom: -2, right: -2, background: '#09090b' }}
                              >
                                <ShieldCheck size={10} style={{ color: '#4ade80' }} />
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{u.name || '미입력'}</span>
                              <span
                                style={{
                                  fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                                  background: u.gender === 'male' ? 'rgba(96,165,250,0.1)' : 'rgba(244,114,182,0.1)',
                                  color:      u.gender === 'male' ? '#60a5fa'              : '#f472b6',
                                }}
                              >
                                {u.gender === 'male' ? 'M' : 'F'}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#555', marginTop: 1 }}>{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* 직업/나이 */}
                      <td style={{ padding: '14px 20px' }}>
                        <p style={{ fontSize: '0.85rem', color: '#bbb' }}>{u.job || '-'}</p>
                        <p style={{ fontSize: '0.75rem', color: '#555', marginTop: 1 }}>{u.birthDate ? `${new Date().getFullYear() - parseInt(u.birthDate.split('-')[0]) + 1}세` : '-'}</p>
                      </td>

                      {/* 상태 */}
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: sc.color, background: sc.bg }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                          {sc.label}
                        </span>
                      </td>

                      {/* 가입일 */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#555' }}>
                          {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'yyyy-MM-dd') : '-'}
                        </span>
                      </td>

                      {/* 관리 */}
                      <td style={{ padding: '14px 20px' }}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(u.status || 'pending') === 'pending' && (
                            <>
                              <button
                                onClick={() => approve(u.id, u.name)}
                                className="flex items-center gap-1 rounded-lg transition-colors"
                                style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.15)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.14)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,222,128,0.08)')}
                              >
                                <CheckCircle size={12} /> 승인
                              </button>
                              <button
                                onClick={() => reject(u.id, u.name)}
                                className="flex items-center gap-1 rounded-lg transition-colors"
                                style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                              >
                                <XCircle size={12} /> 반려
                              </button>
                            </>
                          )}
                          <button
                            className="flex items-center justify-center rounded-lg transition-colors"
                            style={{ width: 30, height: 30, color: '#444', background: 'transparent' }}
                            onMouseEnter={e => { (e.currentTarget.style.color = '#ccc'); (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); }}
                            onMouseLeave={e => { (e.currentTarget.style.color = '#444'); (e.currentTarget.style.background = 'transparent'); }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (Mock) */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.75rem', color: '#555' }}>
            총 <strong style={{ color: '#ccc' }}>{filtered.length}</strong>명
          </p>
          <div className="flex items-center gap-1">
            <button className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, color: '#444' }}>
              <ChevronLeft size={15} />
            </button>
            <button className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: '#FF6F61', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
              1
            </button>
            <button className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, color: '#444' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
