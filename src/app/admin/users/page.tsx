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
import UserProfileModal from './UserProfileModal';

type Status = 'all' | 'pending' | 'verified' | 'rejected';

const STATUS_CFG = {
  verified: { label: '인증 완료', color: '#10B981', bg: '#ECFDF5'  },
  pending:  { label: '승인 대기', color: '#F59E0B', bg: '#FFFBEB'  },
  rejected: { label: '인증 반려', color: '#EF4444', bg: '#FEF2F2'  },
};

const ROLES = ['일반회원', '신뢰회원', 'VIP회원', '블랙리스트', 'admin'];

const TABS: { key: Status; label: string }[] = [
  { key: 'all',      label: '전체'    },
  { key: 'pending',  label: '승인 대기' },
  { key: 'verified', label: '인증 완료' },
  { key: 'rejected', label: '반려'    },
];

const panel = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

// Table Skeleton
const TableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <tr key={i} className="animate-pulse h-[60px] border-b border-slate-50">
        <td style={{ padding: '0 20px' }}><div className="h-8 w-40 bg-slate-100 rounded"></div></td>
        <td style={{ padding: '0 20px' }}><div className="h-6 w-24 bg-slate-100 rounded"></div></td>
        <td style={{ padding: '0 20px' }}><div className="h-6 w-20 bg-slate-100 rounded-full"></div></td>
        <td style={{ padding: '0 20px' }}><div className="h-6 w-24 bg-slate-100 rounded"></div></td>
        <td style={{ padding: '0 20px' }} className="text-right"><div className="h-6 w-16 bg-slate-100 rounded ml-auto"></div></td>
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
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<any>(null);

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
      u.birthDate ? `${u.birthDate.includes('-') ? u.birthDate.slice(2,4) : u.birthDate.slice(0,2)}년생` : '-',
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>회원 관리</h2>
          <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>실시간 데이터 동기화 활성화됨 <span className="text-[10px] font-bold text-[#FF7E7E] ml-2">v8.1.3 Integrated Auth</span></p>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 rounded-lg transition-all hover:bg-slate-100"
          style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, background: '#fff', border: '1px solid #E2E8F0', color: '#64748B' }}
        >
          <Download size={14} /> CSV 추출하기
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex items-center gap-2 rounded-xl transition-all duration-200"
            style={{
              padding: '8px 18px',
              fontSize: '0.82rem',
              fontWeight: filter === t.key ? 700 : 500,
              color: filter === t.key ? '#fff' : '#64748B',
              background: filter === t.key ? '#FF7E7E' : '#fff',
              border: `1px solid ${filter === t.key ? '#FF7E7E' : '#E2E8F0'}`,
              boxShadow: filter === t.key ? '0 4px 12px rgba(255,126,126,0.2)' : 'none',
            }}
          >
            {t.label}
            <span
              style={{
                fontSize: '0.65rem', fontWeight: 800,
                padding: '1px 6px', borderRadius: 10,
                background: filter === t.key ? 'rgba(0,0,0,0.1)' : '#F1F5F9',
                color: filter === t.key ? '#fff' : '#64748B',
              }}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}

        <div className="w-[1px] h-6 bg-slate-200 mx-2" />

        {/* Gender Filter Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {['all', 'male', 'female'].map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g as any)}
              className={`px-4 py-1.5 text-[0.75rem] font-bold rounded-lg transition-all ${genderFilter === g ? 'bg-white text-[#FF7E7E] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {g === 'all' ? '전체' : g === 'male' ? '남성' : '여성'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full sm:w-auto mt-4 sm:mt-0">
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="회원 이름, 직업 등으로 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '9px 14px 9px 38px',
              fontSize: '0.82rem',
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              color: '#1E293B',
              outline: 'none',
              width: '100%',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}
            className="sm:w-[260px] focus:border-[#FF7E7E]/50 transition-all"
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
                <col style={{ width: '80px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '100px' }} />
              </colgroup>
              <thead>
                <tr>
                  {['프로필', '이름', '직업', '나이', '상태 / 권한', '활동 지표', '관리', '가입일'].map((h, i) => {
                    const isSortable = h === '나이' || h === '가입일';
                    const sortKey = (h === '나이') ? 'age' : (h === '가입일' ? 'createdAt' : null);
                    const isActive = sortKey && sortConfig.key === sortKey;

                    return (
                      <th
                        key={h}
                        onClick={() => isSortable && toggleSort(sortKey as any)}
                        style={{
                          padding: '12px 20px',
                          textAlign: (i === 6) ? 'right' : (i === 3 || i === 7 || i === 5 ? 'center' : 'left'),
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isActive ? '#FF7E7E' : '#64748B',
                          borderBottom: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          whiteSpace: 'nowrap',
                          cursor: isSortable ? 'pointer' : 'default',
                        }}
                        className={isSortable ? 'hover:bg-slate-100 transition-colors' : ''}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: i === 6 ? 'flex-end' : (i === 3 || i === 7 || i === 5 ? 'center' : 'flex-start') }}>
                          {h}
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
                      style={{ borderBottom: '1px solid #E2E8F0', cursor: 'default', height: 60 }}
                      className="hover:bg-slate-50 transition-colors group h-[60px]"
                    >
                      {/* 1. 프로필 (v7.8.2) */}
                      <td style={{ padding: '0 20px' }}>
                        <div
                          onClick={() => setSelectedUserForProfile(u)}
                          className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center overflow-hidden bg-slate-100 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                        >
                          {(u.photoUrl || u.photoURL || u.photos?.[0]) ? (
                            <img src={u.photoUrl || u.photoURL || u.photos?.[0]} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">{u.name?.[0] || 'U'}</span>
                          )}
                        </div>
                      </td>

                      {/* 2. 이름 */}
                      <td style={{ padding: '0 20px' }}>
                        <div className="flex flex-col cursor-pointer" onClick={() => setSelectedUserForProfile(u)}>
                          <span className="text-[0.88rem] font-bold text-slate-800 hover:text-[#FF7E7E] transition-colors">{u.name || '미입력'}</span>
                          <span className={`text-[10px] font-bold ${u.gender === 'male' ? 'text-blue-500' : 'text-rose-500'}`}>
                            {u.gender === 'male' ? '남성' : '여성'}
                          </span>
                        </div>
                      </td>

                      {/* 직업 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 500, color: (u.job || u.occupation) ? '#334155' : '#94A3B8' }}>
                          {u.job || u.occupation || <span style={{ color: '#94A3B8' }}>-</span>}
                        </p>
                      </td>

                      {/* 나이 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.88rem', fontWeight: 800, color: u.birthDate ? '#1E293B' : '#94A3B8', textAlign: 'center' }}>
                          {u.birthDate ? `${u.birthDate.includes('-') ? u.birthDate.slice(2,4) : u.birthDate.slice(0,2)}년생` : <span style={{ color: '#94A3B8' }}>-</span>}
                        </p>
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
                            className="bg-slate-50 border border-slate-200 rounded-lg text-[10px] px-2 py-1 text-slate-700 outline-none focus:border-[#FF7E7E]/50 cursor-pointer shadow-sm"
                          >
                            {ROLES.map(r => <option key={r} value={r} className="bg-white">{r}</option>)}
                          </select>
                        </div>
                      </td>

                      {/* 활동 지표 (Badges) */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <div className="flex items-center justify-center gap-2">
                          {/* T: Total */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 shadow-sm">
                            <span className="text-sky-600 text-[10px] font-black">T</span>
                            <span className="text-sky-700 text-[11px] font-black">{u.participationCount || 0}</span>
                          </div>
                          {/* M: Match */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm">
                            <span className="text-emerald-600 text-[10px] font-black">M</span>
                            <span className="text-emerald-700 text-[11px] font-black">{u.matchCount || 0}</span>
                          </div>
                          {/* N: No-show */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm ${u.noShowCount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                            <span className={`${u.noShowCount > 0 ? 'text-rose-600' : 'text-slate-300'} text-[10px] font-black`}>N</span>
                            <span className={`${u.noShowCount > 0 ? 'text-rose-700' : 'text-slate-300'} text-[11px] font-black`}>{u.noShowCount || 0}</span>
                          </div>
                        </div>
                      </td>

                      {/* 관리 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedUserForAsset(u)}
                            className="flex items-center gap-1.5 rounded-lg transition-all hover:shadow-md"
                            style={{ padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, background: '#fff', color: '#FF7E7E', border: '1px solid #FF7E7E' }}
                          >
                            <Coins size={12} /> 자산 관리
                          </button>
                          
                          {(u.status || 'pending') === 'pending' && (
                            <>

                              <button
                                onClick={() => reject(u.id, u.name)}
                                className="flex items-center gap-1.5 rounded-lg transition-all hover:shadow-sm"
                                style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 700, background: '#FEF2F2', color: '#EF4444', border: '1px solid #FEE2E2' }}
                              >
                                <XCircle size={12} /> 반려
                              </button>
                            </>
                          )}
                          <button
                            className="flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all text-slate-300 hover:text-slate-600"
                            style={{ width: 32, height: 32 }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>

                      {/* 가입일 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B' }}>
                          {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'yyyy-MM-dd') : <span style={{ color: '#94A3B8' }}>-</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Loading More / Windows Mechanism */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50" style={{ borderTop: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748B' }}>
            프리미엄 대시보드: 현재 <strong style={{ color: '#0F172A' }}>{pagedItems.length}</strong>명 표시 중 (전체 {filtered.length}명)
          </p>
          <div className="flex items-center gap-1">
             {filtered.length > pageSize && (
               <button 
                 onClick={() => setPageSize(prev => prev + 20)}
                 className="px-6 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-[#FF7E7E] transition-all shadow-sm"
               >
                 데이터 더 불러오기
               </button>
             )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <UserProfileModal 
        user={selectedUserForProfile} 
        isOpen={!!selectedUserForProfile} 
        onClose={() => setSelectedUserForProfile(null)} 
      />
    </div>
  );
}
