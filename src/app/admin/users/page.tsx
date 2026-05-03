'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, CheckCircle, XCircle,
  Download, ShieldCheck, ChevronLeft, ChevronRight, Loader2,
  Filter, ArrowUpDown, ArrowUp, ArrowDown, Ticket,
  UserPlus, Award, AlertCircle, Edit3, Trash2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import {
  collection, onSnapshot, doc, updateDoc, query, orderBy, Timestamp, serverTimestamp, getDocs, where
} from 'firebase/firestore';
import { format } from 'date-fns';
import UserProfileModal from './UserProfileModal';
import SMSPreviewModal from '@/components/admin/SMSPreviewModal';

type Status = 'all' | 'pending' | 'verified' | 'rejected';

const STATUS_CFG = {
  verified: { label: '인증 완료', color: '#10B981', bg: '#ECFDF5' },
  pending: { label: '승인 대기', color: '#F59E0B', bg: '#FFFBEB' },
  rejected: { label: '인증 반려', color: '#EF4444', bg: '#FEF2F2' },
};

const ROLES = ['일반회원', '신뢰회원', 'VIP회원', '블랙리스트', 'admin'];

const TABS: { key: Status; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'verified', label: '인증 완료' },
  { key: 'rejected', label: '반려' },
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal states
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<any>(null);
  const [providerMap, setProviderMap] = useState<Record<string, string>>({});

  // v8.8.6: 직업 검토 상태 추가
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [tempJobValue, setTempJobValue] = useState<string>('');

  // 회원 삭제
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // SMS 발송 모달 (v8.12.9)
  const [smsTargetUser, setSmsTargetUser] = useState<any | null>(null);

  // 쿠폰 발송 모달
  const [couponTarget, setCouponTarget] = useState<any | null>(null);
  const [couponTitle, setCouponTitle] = useState('웰컴 가입 축하 쿠폰');
  const [customCouponTitle, setCustomCouponTitle] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [validityPeriod, setValidityPeriod] = useState<number | 'unlimited'>(1);
  const [isSendingCoupon, setIsSendingCoupon] = useState(false);

  const handleSendCoupon = async () => {
    const finalCouponTitle = couponTitle === '직접 입력' ? customCouponTitle : couponTitle;
    if (!couponTarget || !finalCouponTitle || !discountValue) {
      return toast.error('쿠폰 정보를 모두 입력해 주세요.');
    }
    setIsSendingCoupon(true);
    try {
      const { addDoc, collection: coll } = await import('firebase/firestore');
      const userRef = doc(db, 'users', couponTarget.id);
      const newCoupon = {
        title: finalCouponTitle,
        type: discountType,
        value: Number(discountValue),
        validityMonths: validityPeriod,
        isUsed: false,
        createdAt: Timestamp.now(),
      };
      
      await addDoc(coll(userRef, 'coupons'), newCoupon);
      
      toast.success(`${couponTarget.name} 회원에게 쿠폰이 발송되었습니다.`);
      setCouponTarget(null);
      setCouponTitle('웰컴 가입 축하 쿠폰');
      setCustomCouponTitle('');
      setDiscountValue('');
    } catch (e) {
      toast.error('쿠폰 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingCoupon(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: deleteTarget.id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${deleteTarget.name} 회원이 삭제되었습니다.`);
      setDeleteTarget(null);
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // v8.15.9: private_applications 에서 사진 병합 (없는 유저만)
      const usersNeedingPhotos = fetchedUsers.filter((u: any) => {
        const hasPhoto = u.photos?.[0] || u.profilePhotos?.[0] || u.facePhotos?.[0] || u.bodyPhotos?.[0] || u.photoUrl || u.photoURL;
        return !hasPhoto;
      });

      if (usersNeedingPhotos.length > 0) {
        const appSnap = await getDocs(collection(db, 'private_applications'));
        const photoMap: Record<string, string[]> = {};
        appSnap.docs.forEach(d => {
          const data = d.data();
          if (data.userId && Array.isArray(data.photos) && data.photos.length > 0) {
            photoMap[data.userId] = data.photos.filter(Boolean);
          }
        });

        const merged = fetchedUsers.map((u: any) => {
          const hasPhoto = u.photos?.[0] || u.profilePhotos?.[0] || u.facePhotos?.[0] || u.bodyPhotos?.[0] || u.photoUrl || u.photoURL;
          if (!hasPhoto && photoMap[u.id]) {
            return { ...u, photos: photoMap[u.id] };
          }
          return u;
        });
        setUsers(merged);
      } else {
        setUsers(fetchedUsers);
      }

      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      toast.error('회원 데이터를 불러오는 중 오류가 발생했습니다.');
      setIsLoading(false);
    });

    // 가입 방식 조회
    fetch('/api/admin/members')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const map: Record<string, string> = {};
          data.users.forEach((u: any) => { if (u.authProvider) map[u.id] = u.authProvider; });
          setProviderMap(map);
        }
      })
      .catch(() => { });

    return () => unsubscribe();
  }, []);

  const counts = useMemo(() => ({
    all: users.length,
    pending: users.filter(u => (u.status || 'pending') === 'pending').length,
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

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize);

  // 페이지 이동 시 상단으로 스크롤
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 필터나 검색어 변경 시 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, genderFilter, sortConfig]);

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

  const approve = async (u: any) => {
    try {
      if (!u.isJobReviewed) {
        return toast.error('먼저 직업 정보를 확인/수정하고 승인(Job Reviewed)해 주세요.');
      }
      const userRef = doc(db, 'users', u.id);
      await updateDoc(userRef, {
        status: 'verified',
        updatedAt: Timestamp.now()
      });
      toast.success(`${u.name} 승인 완료`);
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleJobUpdate = async (userId: string, value: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        admin_job: value,
        job: value, // for backwards compatibility
        isJobReviewed: true,
        updatedAt: Timestamp.now()
      });
      setEditingJobId(null);
      toast.success('직업 정보가 수정 및 승인되었습니다.');
    } catch (e) {
      toast.error('직업 정보 업데이트에 실패했습니다.');
    }
  };

  const toggleJobReviewed = async (userId: string, checked: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isJobReviewed: checked,
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      toast.error('승인 상태 변경에 실패했습니다.');
    }
  };

  const reject = async (id: string, name: string) => {
    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, {
        status: 'rejected',
        isVerified: false,
        updatedAt: Timestamp.now()
      });
      toast.error(`${name} 반려 처리`);
    } catch (error) {
      console.error('Rejection error:', error);
      toast.error('반려 처리 중 오류가 발생했습니다.');
    }
  };

  const handleSendProfileRequestSms = async (message: string) => {
    if (!smsTargetUser) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/sms/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targets: [{
            phone: smsTargetUser.phone,
            name: smsTargetUser.name,
            gender: smsTargetUser.gender,
            userId: smsTargetUser.id
          }],
          message
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발송 실패');
      
      // 요청 기록 저장 (v8.13.1)
      await updateDoc(doc(db, 'users', smsTargetUser.id), {
        profileRequestSent: true,
        profileRequestAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success(`${smsTargetUser.name}님께 프로필 작성 요청 문자를 발송했습니다.`);
    } catch (e) {
      console.error(e);
      throw e;
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
      u.birthDate ? `${u.birthDate.includes('-') ? u.birthDate.slice(2, 4) : u.birthDate.slice(0, 2)}년생` : '-',
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
                        <div className="relative w-fit">
                          <div
                            onClick={() => setSelectedUserForProfile(u)}
                            className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center overflow-hidden bg-slate-100 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                          >
                            {(() => {
                              const photo = u.photos?.[0] || u.profilePhotos?.[0] || u.facePhotos?.[0] || u.bodyPhotos?.[0] || u.photoUrl || u.photoURL;
                              return photo ? (
                                <img src={photo} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-slate-400">{u.name?.[0] || 'U'}</span>
                              );
                            })()}
                          </div>
                          {u.isJobReviewed === false && (
                            <div className="absolute -top-1.5 -right-3 z-10 bg-[#FF7E7E] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md border-2 border-white animate-bounce whitespace-nowrap">
                              정보수정
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. 이름 */}
                      <td style={{ padding: '0 20px' }}>
                        <div className="flex flex-col cursor-pointer" onClick={() => setSelectedUserForProfile(u)}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[0.88rem] font-bold text-slate-800 hover:text-[#FF7E7E] transition-colors">{u.name || '미입력'}</span>
                            {(() => {
                              const p = providerMap[u.id];
                              if (!p) return null;
                              const cfg: Record<string, { label: string; bg: string; color: string }> = {
                                'email': { label: '기본회원', bg: '#F1F5F9', color: '#64748B' },
                                'password': { label: '기본회원', bg: '#F1F5F9', color: '#64748B' },
                                'google': { label: 'Google', bg: '#FEF2F2', color: '#EF4444' },
                                'google.com': { label: 'Google', bg: '#FEF2F2', color: '#EF4444' },
                                'kakao': { label: 'Kakao', bg: '#FEF9C3', color: '#CA8A04' },
                                'oidc.kakao': { label: 'Kakao', bg: '#FEF9C3', color: '#CA8A04' },
                              };
                              const c = cfg[p] || { label: p, bg: '#F1F5F9', color: '#64748B' };
                              return (
                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: c.bg, color: c.color }}>
                                  {c.label}
                                </span>
                              );
                            })()}
                          </div>
                          <span className={`text-[10px] font-bold ${u.gender === 'male' ? 'text-blue-500' : 'text-rose-500'}`}>
                            {u.gender === 'male' ? '남성' : '여성'}
                          </span>
                        </div>
                      </td>

                      {/* 3. 직업 (인라인 편집 + 검토 체크박스 이관 v8.8.6) */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 group/job relative">
                            {editingJobId === u.id ? (
                              <input
                                autoFocus
                                value={tempJobValue}
                                onChange={(e) => setTempJobValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleJobUpdate(u.id, tempJobValue);
                                  if (e.key === 'Escape') setEditingJobId(null);
                                }}
                                onBlur={() => setEditingJobId(null)}
                                className="w-full h-8 px-2 rounded border-2 border-blue-400 text-[0.8rem] font-bold outline-none"
                              />
                            ) : (
                              <>
                                <p className={`text-[0.82rem] font-bold tracking-tight flex items-center flex-wrap gap-1 ${u.admin_job || u.job ? 'text-blue-600' : 'text-slate-800'}`}>
                                  <span>{u.admin_job || u.job || u.occupation || <span className="text-slate-300 font-normal">-</span>}</span>
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingJobId(u.id);
                                    setTempJobValue(u.admin_job || u.job || u.occupation || '');
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-100 text-slate-400 opacity-0 group-hover/job:opacity-100 hover:bg-blue-50 hover:text-blue-500 transition-all"
                                >
                                  <Edit3 size={12} />
                                </button>
                              </>
                            )}
                          </div>

                          <label className={`flex items-center gap-1.5 w-fit cursor-pointer select-none px-2 py-1 rounded-lg border transition-all ${u.isJobReviewed ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                            <input
                              type="checkbox"
                              checked={!!u.isJobReviewed}
                              onChange={(e) => toggleJobReviewed(u.id, e.target.checked)}
                              className="w-3 h-3 rounded"
                            />
                            <span className="text-[10px] font-black uppercase tracking-tight">직업승인</span>
                          </label>
                        </div>
                      </td>

                      {/* 나이 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.88rem', fontWeight: 800, color: u.birthDate ? '#1E293B' : '#94A3B8', textAlign: 'center' }}>
                          {u.birthDate ? `${u.birthDate.includes('-') ? u.birthDate.slice(2, 4) : u.birthDate.slice(0, 2)}년생` : <span style={{ color: '#94A3B8' }}>-</span>}
                        </p>
                      </td>

                      {/* 상태 / 권한 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                        <div className="flex flex-col gap-2">
                          <span
                            onClick={() => currentStatus === 'pending' && setSmsTargetUser(u)}
                            className={`inline-flex items-center gap-1.5 ${currentStatus === 'pending' ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all' : ''}`}
                            style={{ width: 'fit-content', fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: sc.color, background: sc.bg }}
                            title={currentStatus === 'pending' ? '프로필 작성 요청 문자 보내기' : ''}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                            {sc.label}
                          </span>

                          {/* 요청 완료 표시 (v8.13.1) */}
                          {currentStatus === 'pending' && u.profileRequestSent && (
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#FF7E7E', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                              <CheckCircle size={10} /> 요청완료
                            </span>
                          )}

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
                        <div className="flex items-center justify-end gap-1.5">
                          {u.status !== 'rejected' && (
                            <button
                              onClick={() => reject(u.id, u.name)}
                              className="flex items-center gap-1.5 rounded-lg transition-all hover:bg-rose-500 hover:text-white"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: 700, background: '#FEF2F2', color: '#EF4444', border: '1px solid #FEE2E2' }}
                            >
                              <XCircle size={12} /> 반려
                            </button>
                          )}
                          <button
                            onClick={() => setCouponTarget(u)}
                            className="flex items-center justify-center rounded-lg hover:bg-sky-50 transition-all text-slate-400 hover:text-sky-500"
                            style={{ width: 32, height: 32 }}
                            title="쿠폰 발송"
                          >
                            <Ticket size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="flex items-center justify-center rounded-lg hover:bg-rose-50 transition-all text-slate-300 hover:text-rose-500"
                            style={{ width: 32, height: 32 }}
                            title="회원 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>

                      {/* 가입일 */}
                      <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div className="flex flex-col items-center">
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B' }}>
                            {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'yyyy-MM-dd') : <span style={{ color: '#94A3B8' }}>-</span>}
                          </span>
                          {u.createdAt?.seconds && (
                            <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 500, marginTop: '1px' }}>
                              {format(new Date(u.createdAt.seconds * 1000), 'HH:mm')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (v8.14.0) */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-6 bg-slate-50/50 gap-4" style={{ borderTop: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
            전체 <strong style={{ color: '#0F172A' }}>{filtered.length}</strong>명 중 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)}명 표시
          </p>
          
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-[#FF7E7E] disabled:opacity-30 disabled:hover:text-slate-400 transition-all shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // 현재 페이지 주변 5개 번호 표시 로직
                let pageNum = currentPage;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-9 h-9 rounded-lg text-[0.75rem] font-bold transition-all shadow-sm ${currentPage === pageNum ? 'bg-[#FF7E7E] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#FF7E7E] hover:text-[#FF7E7E]'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-[#FF7E7E] disabled:opacity-30 disabled:hover:text-slate-400 transition-all shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <UserProfileModal
        user={selectedUserForProfile}
        isOpen={!!selectedUserForProfile}
        onClose={() => setSelectedUserForProfile(null)}
      />

      {/* SMS 발송 모달 (프로필 작성 요청용) */}
      {smsTargetUser && (
        <SMSPreviewModal
          isOpen={!!smsTargetUser}
          onClose={() => setSmsTargetUser(null)}
          onConfirm={handleSendProfileRequestSms}
          applicant={smsTargetUser}
          session={null}
          recipientLabel={`${smsTargetUser.name}님 (프로필 작성 요청)`}
          confirmLabel="요청 문자 발송"
          autoSelectTemplateName="프로필 작성"
          defaultMessage={`[키링크] 안녕하세요, {{이름}}님! 키링크를 방문해주셔서 감사합니다.\n\n원활한 매칭을 위해 프로필 작성이 조금 더 필요합니다.\n지금 바로 접속하셔서 매력적인 프로필을 완성하고 진짜 인연을 만나보세요!\n\n- 링크: https://www.keylink.kr/mypage?mode=edit`}
        />
      )}

      {/* 회원 삭제 확인 모달 */}
      {deleteTarget && (
        <div
          onClick={() => !isDeleting && setDeleteTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '32px 28px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} color="#EF4444" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: '900', color: '#111' }}>회원 삭제</h2>
                  <p style={{ fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>이 작업은 되돌릴 수 없습니다.</p>
                </div>
              </div>
              <button onClick={() => !isDeleting && setDeleteTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.88rem', color: '#334155', fontWeight: '600' }}>
                <strong style={{ color: '#EF4444' }}>{deleteTarget.name}</strong> ({deleteTarget.username || deleteTarget.id}) 회원을 삭제하시겠습니까?
              </p>
              <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '8px', lineHeight: 1.6 }}>
                • Firestore 회원 문서 삭제<br />
                • Firebase Auth 계정 삭제<br />
                • 신청 내역 삭제<br />
                • 프로필 이미지 삭제
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: '#EF4444', color: '#fff', fontWeight: '800', fontSize: '0.88rem', cursor: isDeleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {isDeleting ? <><Loader2 size={15} className="animate-spin" /> 삭제 중...</> : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쿠폰 발송 모달 */}
      {couponTarget && (
        <div
          onClick={() => !isSendingCoupon && setCouponTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '420px', padding: '32px' }}
            className="shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ticket size={20} color="#3b82f6" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F172A' }}>쿠폰 발송</h2>
              </div>
              <button onClick={() => !isSendingCoupon && setCouponTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {/* 대상 회원 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">대상 회원</label>
                <div className="bg-slate-50 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 border border-slate-100">
                  {couponTarget.name} <span className="text-slate-400 font-normal">({couponTarget.email || '이메일 없음'})</span>
                </div>
              </div>

              {/* 쿠폰 메시지 */}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-bold text-slate-500">쿠폰 메시지(제목)</label>
                <select
                  value={couponTitle}
                  onChange={e => setCouponTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-colors text-sm font-semibold text-slate-700 bg-white cursor-pointer shadow-sm"
                >
                  <option value="웰컴 가입 축하 쿠폰">웰컴 가입 축하 쿠폰</option>
                  <option value="지인 추천 감사 쿠폰">지인 추천 감사 쿠폰</option>
                  <option value="생일 축하 특별 쿠폰">생일 축하 특별 쿠폰</option>
                  <option value="파티 할인 쿠폰">파티 할인 쿠폰</option>
                  <option value="다음 만남 응원 쿠폰">다음 만남 응원 쿠폰</option>
                  <option value="VIP 전용 시크릿 쿠폰">VIP 전용 시크릿 쿠폰</option>
                  <option value="직접 입력">직접 입력...</option>
                </select>

                {couponTitle === '직접 입력' && (
                  <input
                    type="text"
                    placeholder="쿠폰 이름을 직접 적어주세요"
                    value={customCouponTitle}
                    onChange={e => setCustomCouponTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:border-blue-500 outline-none transition-colors text-sm font-medium animate-in slide-in-from-top-1 bg-blue-50/50"
                    autoFocus
                  />
                )}
              </div>

              {/* 할인 방식 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">할인 방식</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setDiscountType('percent')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${discountType === 'percent' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    % 퍼센트 할인
                  </button>
                  <button
                    onClick={() => setDiscountType('amount')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${discountType === 'amount' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    ₩ 금액 할인
                  </button>
                </div>
              </div>

              {/* 할인 금액/비율 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {discountType === 'percent' ? '몇 % 할인 쿠폰을 보낼까요?' : '얼마를 할인할까요?'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    placeholder={discountType === 'percent' ? '10' : '10000'}
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-colors text-sm font-bold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {discountType === 'percent' ? '%' : '원'}
                  </span>
                </div>
              </div>

              {/* 유효 기간 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">유효기간 설정</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 3, 6, 12, 'unlimited'].map((v) => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${validityPeriod === v ? 'border-blue-500' : 'border-slate-300 group-hover:border-blue-400'}`}>
                        {validityPeriod === v && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700 select-none">
                        {v === 'unlimited' ? '∞ 무제한(기한 없음)' : `${v}개월`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '32px' }}>
              <button
                onClick={() => setCouponTarget(null)}
                disabled={isSendingCoupon}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleSendCoupon}
                disabled={isSendingCoupon || (couponTitle === '직접 입력' ? !customCouponTitle : !couponTitle) || !discountValue}
                className="disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {isSendingCoupon ? <><Loader2 size={16} className="animate-spin" /> 발송 중...</> : '발송하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
