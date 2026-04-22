'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, ShieldCheck, ChevronLeft, ChevronRight, Loader2,
  Filter, ArrowUpDown, ArrowUp, ArrowDown, Ticket,
  UserPlus, Award, AlertCircle, Coins
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, Timestamp 
} from 'firebase/firestore';
import { format } from 'date-fns';
import AssetModal from './AssetModal';

type Status = 'all' | 'pending' | 'verified' | 'rejected';

const STATUS_CFG = {
  verified: { label: '인증 완료', color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  pending:  { label: '승인 대기', color: '#facc15', bg: 'rgba(250,204,21,0.1)'  },
  rejected: { label: '인증 반려', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

const ROLES = ['일반회원', '신뢰회원', 'VIP회원', '블랙리스트', 'admin'];

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
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <tr key={i} className="animate-pulse h-[72px] border-b border-white/5">
        <td style={{ padding: '0 20px' }}><div className="h-8 w-40 bg-white/5 rounded"></div></td>
        <td style={{ padding: '0 20px' }}><div className="h-6 w-24 bg-white/5 rounded"></div></td>
        <td style={{ padding: '0 20px' }}><div className="h-6 w-20 bg-white/5 rounded-full"></div></td>
        <td style={{ padding: '0 20px' }}><div className="h-6 w-24 bg-white/5 rounded"></div></td>
        <td style={{ padding: '0 20px' }} className="text-right"><div className="h-6 w-16 bg-white/5 rounded ml-auto"></div></td>
      </tr>
    ))}
  </>
);

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Status>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: 'age' | 'createdAt', direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });
  
  // Custom Pagination for performance
  const [pageSize, setPageSize] = useState(20);
  
  // Modal states
  const [selectedUserForAsset, setSelectedUserForAsset] = useState<any>(null);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(fetchedUsers);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      toast.error('회원 데이터를 불러오는 중 오류가 발생했습니다.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const counts = useMemo(() => ({
    all:      users.length,
    pending:  users.filter(u => (u.status || 'pending') === 'pending').length,
    verified: users.filter(u => u.status === 'verified').length,
    rejected: users.filter(u => u.status === 'rejected').length,
  }), [users]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchSearch = 
        (u.name || '').toLowerCase().includes(q) || 
        (u.job || '').toLowerCase().includes(q) || 
        (u.email || '').toLowerCase().includes(q);
      const matchFilter = filter === 'all' || (u.status || 'pending') === filter;
      const matchGender = genderFilter === 'all' || u.gender === genderFilter;
      return matchSearch && matchFilter && matchGender;
    }).sort((a, b) => {
      if (!sortConfig.direction || !sortConfig.key) return 0;

      let valA: any, valB: any;

      if (sortConfig.key === 'age') {
        const getAge = (birth?: string) => birth ? new Date().getFullYear() - parseInt(birth.split('-')[0]) + 1 : 0;
        valA = getAge(a.birthDate);
        valB = getAge(b.birthDate);
      } else {
        valA = a[sortConfig.key]?.seconds || 0;
        valB = b[sortConfig.key]?.seconds || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, search, filter, genderFilter, sortConfig]);

  const pagedItems = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize]);

  const toggleSort = (key: 'age' | 'createdAt') => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: 'createdAt', direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      toast.success('권한이 업데이트되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('권한 변경에 실패했습니다.');
    }
  };

  const approve = async (id: string, name: string) => {
    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { 
        status: 'verified',
        updatedAt: Timestamp.now()
      });
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
      toast.error(`${name} 반려 처리`);
    } catch (error) {
      console.error('Rejection error:', error);
      toast.error('반려 처리 중 오류가 발생했습니다.');
    }
  };

  // CSV Export Logic
  const downloadCSV = useCallback(() => {
    if (filtered.length === 0) return toast.error('추출할 데이터가 없습니다.');

    const headers = ['이름', '이메일', '성별', '직업', '나이', '상태', '권한', '포인트', '참여횟수', '매칭성공', '노쇼회수', '가입일'];
    const rows = filtered.map(u => [
      u.name || '-',
      u.email || '-',
      u.gender === 'male' ? '남성' : '여성',
      u.job || '-',
      u.birthDate ? `${new Date().getFullYear() - parseInt(u.birthDate.split('-')[0]) + 1}세` : '-',
      STATUS_CFG[(u.status || 'pending') as keyof typeof STATUS_CFG].label,
      u.role || '일반회원',
      u.points || 0,
      u.participationCount || 0,
      u.matchCount || 0,
      u.noShowCount || 0,
      u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'yyyy-MM-dd') : '-'
    ]);

    const csvContent = [
      '\uFEFF' + headers.join(','), // BOM for excel utf-8
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `keylink_users_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filtered]);

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>회원 관리</h2>
          <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>실시간 데이터 동기화 활성화됨 <span className="text-[10px] opacity-30 text-[#FF6F61] ml-2">Live</span></p>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 rounded-lg transition-all hover:bg-white/10 hover:text-white"
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

        <div className="w-[1px] h-6 bg-white/10 mx-2" />

        {/* Gender Filter Tabs */}
        <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
          {['all', 'male', 'female'].map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g as any)}
              className={`px-3 py-1 text-[0.75rem] font-semibold rounded-md transition-all ${genderFilter === g ? 'bg-[#FF6F61] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              {g === 'all' ? '전체' : g === 'male' ? '남성' : '여성'}
            </button>
          ))}
        </div>

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
          <div style={{ overflowX: 'auto' }} className="min-h-[400px] flex items-center justify-center">
            <p style={{ color: '#555', fontSize: '0.88rem' }}>회원 데이터가 없습니다.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['회원정보', '직업 / 나이', '상태 / 권한', '활동 지표', '가입일', '관리'].map((h, i) => {
                    const isSortable = h === '직업 / 나이' || h === '가입일';
                    const sortKey = (h === '직업 / 나이') ? 'age' : (h === '가입일' ? 'createdAt' : null);
                    const isActive = sortKey && sortConfig.key === sortKey;

                    return (
                      <th
                        key={h}
                        onClick={() => isSortable && toggleSort(sortKey as any)}
                        style={{
                          padding: '12px 20px',
                          textAlign: (i === 5) ? 'right' : 'left',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: isActive ? '#FF6F61' : '#444',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          whiteSpace: 'nowrap',
                          cursor: isSortable ? 'pointer' : 'default',
                          userSelect: 'none',
                          overflow: 'hidden',
                        }}
                        className={isSortable ? 'hover:text-white/40 transition-colors' : ''}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: i === 5 ? 'flex-end' : 'flex-start' }}>
                          {h}
                          {isSortable && (
                            <span style={{ opacity: isActive ? 1 : 0.3 }}>
                              {isActive ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                              ) : (
                                <ArrowUpDown size={10} />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(u => {
                  const currentStatus = (u.status || 'pending') as keyof typeof STATUS_CFG;
                  const sc = STATUS_CFG[currentStatus];
                  return (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'default', height: 72 }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* 회원정보 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="relative flex-shrink-0 flex items-center justify-center rounded-xl font-bold"
                            style={{
                              width: 38, height: 38, fontSize: '0.85rem',
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
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <p style={{ fontSize: '0.85rem', color: '#bbb' }}>{u.job || '-'}</p>
                        <p style={{ fontSize: '0.75rem', color: '#555', marginTop: 1 }}>{u.birthDate ? `${new Date().getFullYear() - parseInt(u.birthDate.split('-')[0]) + 1}세` : '-'}</p>
                      </td>

                      {/* 상태 / 권한 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <div className="flex flex-col gap-2">
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ width: 'fit-content', fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: sc.color, background: sc.bg }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                            {sc.label}
                          </span>
                          
                          <select 
                            value={u.role || '일반회원'} 
                            onChange={(e) => updateRole(u.id, e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-md text-[10px] px-2 py-1 text-white outline-none focus:border-[#FF6F61]/50 cursor-pointer"
                          >
                            {ROLES.map(r => <option key={r} value={r} className="bg-[#141417]">{r}</option>)}
                          </select>
                        </div>
                      </td>

                      {/* 활동 지표 (Badges) */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <div className="flex items-center gap-2">
                            <div className="group relative">
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20 cursor-default">
                                    <Coins size={10} /> {u.points?.toLocaleString() || 0}
                                </span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-gray-800 text-white text-sm leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-white/10 shadow-xl min-w-[140px] text-center">
                                    보유 포인트 <br /> <strong>{u.points?.toLocaleString() || 0} P</strong>
                                </div>
                            </div>
                          <div className="group relative">
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 cursor-default">
                              <UserPlus size={10} /> {u.participationCount || 0}
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-gray-800 text-white text-sm leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-white/10 shadow-xl min-w-[140px] text-center">
                              기수 프로그램 참여 <br /> <strong>총 {u.participationCount || 0}회</strong>
                            </div>
                          </div>
                          <div className="group relative">
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 cursor-default">
                              <Award size={10} /> {u.matchCount || 0}
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-gray-800 text-white text-sm leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-white/10 shadow-xl min-w-[140px] text-center">
                              최종 커플 매칭 <br /> <strong>총 {u.matchCount || 0}회 성공</strong>
                            </div>
                          </div>
                          <div className="group relative">
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-default ${u.noShowCount > 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-white/5 text-white/20 border-white/5'}`}>
                              <AlertCircle size={10} /> {u.noShowCount || 0}
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-gray-800 text-white text-sm leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-white/10 shadow-xl min-w-[140px] text-center">
                              노쇼 / 지각 기록 <br /> <strong className={u.noShowCount > 0 ? 'text-rose-400' : ''}>총 {u.noShowCount || 0}회 발생</strong>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 가입일 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: '0.78rem', color: '#555' }}>
                          {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'yyyy-MM-dd') : '-'}
                        </span>
                      </td>

                      {/* 관리 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedUserForAsset(u)}
                            className="flex items-center gap-1.5 rounded-lg transition-all"
                            style={{ padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(255,111,97,0.08)', color: '#FF6F61', border: '1px solid rgba(255,111,97,0.15)' }}
                          >
                            <Coins size={12} /> 자산 관리
                          </button>
                          
                          {(u.status || 'pending') === 'pending' && (
                            <>
                              <button
                                onClick={() => approve(u.id, u.name)}
                                className="flex items-center gap-1.5 rounded-lg transition-all"
                                style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.15)' }}
                              >
                                <CheckCircle size={12} /> 승인
                              </button>
                              <button
                                onClick={() => reject(u.id, u.name)}
                                className="flex items-center gap-1.5 rounded-lg transition-all"
                                style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
                              >
                                <XCircle size={12} /> 반려
                              </button>
                            </>
                          )}
                          <button
                            className="flex items-center justify-center rounded-lg hover:bg-white/5 transition-all text-white/30 hover:text-white"
                            style={{ width: 32, height: 32 }}
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

        {/* Loading More / Windows Mechanism */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.75rem', color: '#555' }}>
            성능 최적화: 현재 <strong style={{ color: '#ccc' }}>{pagedItems.length}</strong>명 표시 중 (전체 {filtered.length}명)
          </p>
          <div className="flex items-center gap-1">
             {filtered.length > pageSize && (
               <button 
                 onClick={() => setPageSize(prev => prev + 20)}
                 className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all"
               >
                 더 보기
               </button>
             )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <AssetModal 
        user={selectedUserForAsset} 
        isOpen={!!selectedUserForAsset} 
        onClose={() => setSelectedUserForAsset(null)} 
      />
    </div>
  );
}
