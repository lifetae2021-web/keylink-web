'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, CheckCircle, XCircle,
  Download, ShieldCheck, ChevronLeft, ChevronRight, Loader2,
  Filter, ArrowUpDown, ArrowUp, ArrowDown, Ticket,
  UserPlus, Award, AlertCircle, Edit3, Trash2, X, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp, getDocs, where, getDoc, limit
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { format } from 'date-fns';
import { chosungIncludes } from '@/lib/utils';
import UserProfileModal from './UserProfileModal';
import SMSPreviewModal from '@/components/admin/SMSPreviewModal';

type Status = 'all' | 'pending' | 'verified' | 'rejected' | 'dummy' | 'waitpool' | 'guest';

const STATUS_CFG = {
  verified: { label: '인증완료', color: '#10B981', bg: '#ECFDF5' },
  pending: { label: '승인대기', color: '#F59E0B', bg: '#FFFBEB' },
  rejected: { label: '인증반려', color: '#EF4444', bg: '#FEF2F2' },
};

const ALL_ROLES = ['일반회원', '신뢰회원', 'VIP회원', '제안', '블랙', 'admin'];
const ADMIN_ROLES = ['일반회원', '신뢰회원', 'VIP회원', '제안', '블랙']; // admin 항목 없음

const TABS: { key: Status; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인대기' },
  { key: 'verified', label: '인증완료' },
  { key: 'rejected', label: '반려' },
  { key: 'waitpool', label: '⚡ 우선 대기' },
  { key: 'guest', label: '비회원' },
  { key: 'dummy', label: '더미계정' },
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

  // 최고관리자 여부
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsAuthChecked(true);
        return;
      }
      try {
        // v12.1.0: 토큰 강제 갱신 → Firestore 리스너 실행 전 최신 인증 토큰 보장
        await user.getIdToken(true);
        const snap = await getDoc(doc(db, 'users', user.uid));
        const role = snap.exists() ? snap.data().role : null;
        setIsAdmin(role === 'admin' || role === 'super_admin');
        setIsSuperAdmin(snap.exists() && role === 'super_admin');
      } finally {
        setIsAuthChecked(true);
      }
    });
    return () => unsub();
  }, []);

  // SMS 발송 모달 (v8.12.9)
  const [smsTargetUser, setSmsTargetUser] = useState<any | null>(null);
  const [generalSmsTargetUser, setGeneralSmsTargetUser] = useState<any | null>(null);

  // 기수 수동 등록 모달
  const [sessionRegistrationTarget, setSessionRegistrationTarget] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isFetchingSessions, setIsFetchingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<'applied' | 'selected' | 'confirmed'>('selected');
  const [isRegistering, setIsRegistering] = useState(false);
  const [inheritedOption, setInheritedOption] = useState<any | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('basic');

  useEffect(() => {
    if (!sessionRegistrationTarget) return;
    const fetchSessions = async () => {
      setIsFetchingSessions(true);
      try {
        const q = query(collection(db, 'sessions'), orderBy('eventDate', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSessions(list);
        if (list.length > 0) {
          setSelectedSessionId(list[0].id);
        }

        // Fetch latest application to inherit options
        const appQ = query(collection(db, 'applications'), where('userId', '==', sessionRegistrationTarget.id), orderBy('createdAt', 'desc'), limit(1));
        const appSnap = await getDocs(appQ);
        if (!appSnap.empty) {
          const latestApp = appSnap.docs[0].data();
          const option = sessionRegistrationTarget.gender === 'male' ? (latestApp.maleOption || 'basic') : (latestApp.femaleOption || 'basic');
          setInheritedOption(latestApp);
          setSelectedOption(option);
        } else {
          setInheritedOption(null);
          setSelectedOption('basic');
        }
      } catch (e) {
        toast.error('기수 목록을 불러오지 못했습니다.');
      } finally {
        setIsFetchingSessions(false);
      }
    };
    fetchSessions();
  }, [sessionRegistrationTarget]);

  const handleManualRegister = async (bypassOverlap?: boolean) => {
    if (!sessionRegistrationTarget || !selectedSessionId || !registrationStatus) {
      return toast.error('모든 정보를 채워주세요.');
    }
    setIsRegistering(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/applications/create-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: sessionRegistrationTarget.id,
          sessionId: selectedSessionId,
          status: registrationStatus,
          bypassOverlapCheck: bypassOverlap,
          selectedOption: selectedOption,
          inheritedAmountPaid: inheritedOption?.amountPaid || inheritedOption?.price || null
        })
      });
      const data = await res.json();
      if (res.status === 200 && data.overlapWarning) {
        const proceed = window.confirm(`⚠️ 중복 만남 경고\n\n${data.message}\n\n그래도 기수 참여 등록을 진행하시겠습니까?`);
        if (proceed) {
          setIsRegistering(false);
          await handleManualRegister(true);
        } else {
          setIsRegistering(false);
        }
        return;
      }
      if (!res.ok) throw new Error(data.error || '참여 등록에 실패했습니다.');
      toast.success('기수 참여 등록이 성공적으로 처리되었습니다.');
      setSessionRegistrationTarget(null);
      setInheritedOption(null);
      setSelectedOption('basic');
    } catch (e: any) {
      toast.error(e.message || '오류가 발생했습니다.');
    } finally {
      setIsRegistering(false);
    }
  };

  // 쿠폰 발송 모달
  const [couponTarget, setCouponTarget] = useState<any | null>(null);
  const [couponTitle, setCouponTitle] = useState('웰컴 가입 축하 쿠폰');
  const [customCouponTitle, setCustomCouponTitle] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [validityPeriod, setValidityPeriod] = useState<number | 'unlimited'>(1);
  const [isSendingCoupon, setIsSendingCoupon] = useState(false);
  const [couponMap, setCouponMap] = useState<Record<string, any[]>>({});
  const [selectedCouponUser, setSelectedCouponUser] = useState<any | null>(null);

  const isCouponSubmitDisabled = isSendingCoupon || (couponTitle === '직접 입력' ? !customCouponTitle : !couponTitle) || !discountValue;

  const handleSendCoupon = async () => {
    const finalCouponTitle = couponTitle === '직접 입력' ? customCouponTitle : couponTitle;
    if (!couponTarget || !finalCouponTitle || !discountValue) {
      return toast.error('쿠폰 정보를 모두 입력해 주세요.');
    }
    setIsSendingCoupon(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/coupons/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: couponTarget.id,
          couponData: {
            title: finalCouponTitle,
            type: discountType,
            value: Number(discountValue),
            validityMonths: validityPeriod,
            isUsed: false,
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '쿠폰 발송에 실패했습니다.');

      const newCoupon = {
        id: data.id,
        title: finalCouponTitle,
        type: discountType,
        value: Number(discountValue),
        validityMonths: validityPeriod,
        isUsed: false,
        createdAt: Timestamp.now(),
      };
      
      toast.success(`${couponTarget.name} 회원에게 쿠폰이 발송되었습니다.`);
      setCouponMap(prev => ({
        ...prev,
        [couponTarget.id]: [...(prev[couponTarget.id] || []), newCoupon]
      }));
      setCouponTarget(null);
      setCouponTitle('웰컴 가입 축하 쿠폰');
      setCustomCouponTitle('');
      setDiscountValue('');
    } catch (e: any) {
      toast.error(e.message || '쿠폰 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (userId: string, couponId: string) => {
    if (!window.confirm('정말로 이 쿠폰을 삭제하시겠습니까? 발급 내역에서 완전히 제거됩니다.')) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'coupons', couponId));
      setCouponMap(prev => ({
        ...prev,
        [userId]: (prev[userId] || []).filter(c => c.id !== couponId)
      }));
      toast.success('쿠폰이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('쿠폰 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    if (!isSuperAdmin) {
      toast.error('회원 삭제는 최고관리자만 가능합니다.');
      return;
    }
    setIsDeleting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ uid: deleteTarget.id }),
      });
      if (res.status === 403) {
        const data = await res.json();
        toast.error(data.error || '권한이 없습니다.');
        return;
      }
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
    if (!isAdmin) return;
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
        const publicAppSnap = await getDocs(collection(db, 'applications'));
        const photoMap: Record<string, string[]> = {};

        const processDocs = (docs: any[]) => {
          docs.forEach(d => {
            const data = d.data();
            if (data.userId && Array.isArray(data.photos) && data.photos.length > 0) {
              photoMap[data.userId] = data.photos.filter(Boolean);
            }
          });
        };

        processDocs(publicAppSnap.docs);
        processDocs(appSnap.docs);

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
  }, [isAdmin]);

  const counts = useMemo(() => {
    const isDummy = (u: any) => u.isDummy === true || u.id?.startsWith('dummy') || u.id?.startsWith('user_m_') || u.id?.startsWith('user_f_');
    const isGuest = (u: any) => u.isRegistered === false;
    const isRegular = (u: any) => !isDummy(u) && !isGuest(u);
    return {
      all: users.filter(u => isRegular(u)).length,
      pending: users.filter(u => isRegular(u) && ((u.status || 'pending') === 'pending' || u.isJobReviewed === false)).length,
      verified: users.filter(u => isRegular(u) && (u.status || 'pending') === 'verified' && u.isJobReviewed !== false).length,
      rejected: users.filter(u => isRegular(u) && u.status === 'rejected').length,
      dummy: users.filter(u => isDummy(u)).length,
      guest: users.filter(u => isGuest(u)).length,
      waitpool: users.filter(u => isRegular(u) && Array.isArray(u.cancelledSessionHistory) && u.cancelledSessionHistory.length > 0).length,
    };
  }, [users]);

  const genderCounts = useMemo(() => {
    const isDummy = (u: any) => u.isDummy === true || u.id?.startsWith('dummy') || u.id?.startsWith('user_m_') || u.id?.startsWith('user_f_');
    const isGuest = (u: any) => u.isRegistered === false;
    const isRegular = (u: any) => !isDummy(u) && !isGuest(u);
    
    const baseUsers = users.filter(u => {
      if (filter === 'dummy') return isDummy(u);
      if (filter === 'guest') return isGuest(u);
      if (filter === 'waitpool') return isRegular(u) && Array.isArray(u.cancelledSessionHistory) && u.cancelledSessionHistory.length > 0;
      if (filter === 'all') return isRegular(u);
      if (filter === 'pending') return isRegular(u) && ((u.status || 'pending') === 'pending' || u.isJobReviewed === false);
      if (filter === 'verified') return isRegular(u) && (u.status || 'pending') === 'verified' && u.isJobReviewed !== false;
      return isRegular(u) && (u.status || 'pending') === filter;
    });
    return {
      all: baseUsers.length,
      male: baseUsers.filter(u => u.gender === 'male').length,
      female: baseUsers.filter(u => u.gender === 'female').length,
    };
  }, [users, filter]);

  const filtered = useMemo(() => {
    const isDummy = (u: any) => u.isDummy === true || u.id?.startsWith('dummy') || u.id?.startsWith('user_m_') || u.id?.startsWith('user_f_');
    const isGuest = (u: any) => u.isRegistered === false;
    const isRegular = (u: any) => !isDummy(u) && !isGuest(u);

    return users.filter(u => {
      const q = search.trim();
      const qLower = q.toLowerCase();
      const matchSearch =
        !q ||
        chosungIncludes(u.name, q) ||
        (u.job || '').toLowerCase().includes(qLower) ||
        (u.phone || '').toLowerCase().includes(qLower) ||
        (u.email || '').toLowerCase().includes(qLower);
      
      let matchFilter = false;
      if (filter === 'dummy') {
        matchFilter = isDummy(u);
      } else if (filter === 'guest') {
        matchFilter = isGuest(u);
      } else if (filter === 'waitpool') {
        matchFilter = isRegular(u) && Array.isArray(u.cancelledSessionHistory) && u.cancelledSessionHistory.length > 0;
      } else if (filter === 'all') {
        matchFilter = isRegular(u);
      } else if (filter === 'pending') {
        matchFilter = isRegular(u) && ((u.status || 'pending') === 'pending' || u.isJobReviewed === false);
      } else if (filter === 'verified') {
        matchFilter = isRegular(u) && (u.status || 'pending') === 'verified' && u.isJobReviewed !== false;
      } else {
        matchFilter = isRegular(u) && (u.status || 'pending') === filter;
      }

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

  // v9.0: Fetch coupons for currently visible items
  useEffect(() => {
    const fetchCouponsForPage = async () => {
      const newCouponMap = { ...couponMap };
      let updated = false;

      await Promise.all(
        pagedItems.map(async (u) => {
          if (!newCouponMap[u.id]) {
            try {
              const snap = await getDocs(collection(db, 'users', u.id, 'coupons'));
              newCouponMap[u.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              updated = true;
            } catch (e) {
              console.error(`Error fetching coupons for ${u.id}:`, e);
            }
          }
        })
      );

      if (updated) {
        setCouponMap(newCouponMap);
      }
    };

    if (pagedItems.length > 0) {
      fetchCouponsForPage();
    }
  }, [pagedItems]);

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
      toast.success('직업 정보가 수정 및 승인되었습니다.', { id: `job-update-${userId}` });
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

  const handleSendGeneralSms = async (message: string) => {
    if (!generalSmsTargetUser) return;
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
            phone: generalSmsTargetUser.phone,
            name: generalSmsTargetUser.name,
            gender: generalSmsTargetUser.gender,
            userId: generalSmsTargetUser.id
          }],
          message
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발송 실패');

      toast.success(`${generalSmsTargetUser.name}님께 문자를 발송했습니다.`);
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
      u.birthDate ? `${u.birthDate.includes('-') ? u.birthDate.split('-')[0].slice(-2) : (u.birthDate.length === 8 ? u.birthDate.slice(2, 4) : u.birthDate.slice(0, 2))}년생` : '-',
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

  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="animate-spin text-slate-300" size={32} />
      </div>
    );
  }

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
        {TABS.map(t => {
          const isWaitpool = t.key === 'waitpool';
          const isActive = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="flex items-center gap-2 rounded-xl transition-all duration-200"
              style={{
                padding: '8px 18px',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : isWaitpool ? '#B45309' : '#64748B',
                background: isActive
                  ? isWaitpool ? '#F59E0B' : '#FF7E7E'
                  : isWaitpool ? '#FFFBEB' : '#fff',
                border: `1px solid ${isActive ? (isWaitpool ? '#F59E0B' : '#FF7E7E') : isWaitpool ? '#FCD34D' : '#E2E8F0'}`,
                boxShadow: isActive ? (isWaitpool ? '0 4px 12px rgba(245,158,11,0.25)' : '0 4px 12px rgba(255,126,126,0.2)') : 'none',
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: '0.65rem', fontWeight: 800,
                  padding: '1px 6px', borderRadius: 10,
                  background: isActive ? 'rgba(0,0,0,0.1)' : isWaitpool ? '#FEF3C7' : '#F1F5F9',
                  color: isActive ? '#fff' : isWaitpool ? '#B45309' : '#64748B',
                }}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}

        <div className="w-[1px] h-6 bg-slate-200 mx-2" />

        {/* Gender Filter Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {['all', 'male', 'female'].map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g as any)}
              className={`px-4 py-1.5 text-[0.75rem] font-bold rounded-lg transition-all flex items-center gap-1.5 ${genderFilter === g ? 'bg-white text-[#FF7E7E] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span>{g === 'all' ? '전체' : g === 'male' ? '남성' : '여성'}</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: 6,
                  background: genderFilter === g ? 'rgba(255,126,126,0.1)' : '#E2E8F0',
                  color: genderFilter === g ? '#FF7E7E' : '#64748B',
                }}
              >
                {genderCounts[g as 'all' | 'male' | 'female']}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full sm:w-auto mt-4 sm:mt-0 group">
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} className="group-focus-within:text-[#FF7E7E] transition-colors" />
          <input
            type="text"
            placeholder="이름, 직업, 연락처 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '9px 34px 9px 38px',
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
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full p-1"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {/* Desktop Table / Mobile Card View Wrapper */}
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
          <div className="min-h-[400px] flex items-center justify-center">
            <p style={{ color: '#64748B', fontSize: '0.88rem' }}>회원 데이터가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* ── Desktop Table (Visible on sm+) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '80px' }} />
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
                        {/* 1. 프로필 */}
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
                             {/* 취소 이력 배지 */}
                             {Array.isArray(u.cancelledSessionHistory) && u.cancelledSessionHistory.length > 0 && (
                               <div className="flex flex-wrap gap-1 mt-0.5">
                                 {u.cancelledSessionHistory.map((h: any, idx: number) => {
                                   const legacyDates: Record<string, string> = {
                                     '부산 로테이션 소개팅 130기': '06.19',
                                     '부산 130기': '06.19',
                                     '창원 로테이션 소개팅 1기': '06.20',
                                     '창원 1기': '06.20',
                                   };
                                   const displayDate = h.sessionDate || legacyDates[h.sessionTitle] || h.sessionTitle?.replace('로테이션 소개팅 ', '') || '기수 취소';
                                   return (
                                     <span
                                       key={idx}
                                       title={`${h.sessionTitle} 지원 후 취소 (상태: ${h.applicationStatus === 'confirmed' ? '확정' : '신청'})`}
                                       style={{ fontSize: '8px', fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: h.applicationStatus === 'confirmed' ? '#FEF3C7' : '#F1F5F9', color: h.applicationStatus === 'confirmed' ? '#B45309' : '#64748B', border: `1px solid ${h.applicationStatus === 'confirmed' ? '#FCD34D' : '#CBD5E1'}` }}
                                     >
                                       ⚡ {displayDate} {h.applicationStatus === 'confirmed' ? '(확정)' : '(신청)'}
                                     </span>
                                   );
                                 })}
                               </div>
                             )}
                          </div>
                        </td>

                        {/* 3. 직업 */}
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
                                  <p className={`text-[0.82rem] font-bold tracking-tight flex items-center gap-1 ${u.admin_job || u.job ? 'text-blue-600' : 'text-slate-800'}`}>
                                    <span className="whitespace-nowrap">{u.admin_job || u.job || u.occupation || <span className="text-slate-300 font-normal">-</span>}</span>
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
                            {u.birthDate ? `${u.birthDate.includes('-') ? u.birthDate.split('-')[0].slice(-2) : (u.birthDate.length === 8 ? u.birthDate.slice(2, 4) : u.birthDate.slice(0, 2))}년생` : <span style={{ color: '#94A3B8' }}>-</span>}
                          </p>
                        </td>

                        {/* 상태 / 권한 */}
                        <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                          <div className="flex flex-col gap-2">
                            <span
                              onClick={() => currentStatus === 'pending' && setSmsTargetUser(u)}
                              className={`inline-flex items-center gap-1.5 ${currentStatus === 'pending' ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all' : ''}`}
                              style={{ width: 'fit-content', fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: sc.color, background: sc.bg, whiteSpace: 'nowrap' }}
                              title={currentStatus === 'pending' ? '프로필 작성 요청 문자 보내기' : ''}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                              {sc.label}
                            </span>

                            {currentStatus === 'pending' && u.profileRequestSent && (
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#FF7E7E', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                                <CheckCircle size={10} /> 요청완료
                              </span>
                            )}

                            {u.role === 'super_admin' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, #FCD34D, #F59E0B)', color: '#78350F', border: '1px solid #FCD34D' }}>
                                👑 최고관리자
                              </span>
                            ) : !isSuperAdmin && u.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full" style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                                관리자
                              </span>
                            ) : (() => {
                              const roleStyles: Record<string, { bg: string; color: string; border: string }> = {
                                '일반회원':  { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
                                '신뢰회원':  { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
                                'VIP회원':   { bg: '#FDF4FF', color: '#9333EA', border: '#E9D5FF' },
                                '제안':      { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
                                '블랙':      { bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' },
                                '블랙리스트':{ bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' },
                                'admin':     { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
                              };
                              const userRole = u.role === '블랙리스트' ? '블랙' : (u.role || '일반회원');
                              const rs = roleStyles[userRole] || roleStyles['일반회원'];
                              return (
                                <select
                                  value={userRole}
                                  onChange={(e) => updateRole(u.id, e.target.value)}
                                  style={{
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                    display: 'inline-block',
                                    width: 'fit-content',
                                    maxWidth: 80,
                                    background: `${rs.bg} url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='${encodeURIComponent(rs.color)}'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 3px center / 7px 7px`,
                                    border: `1px solid ${rs.border}`,
                                    borderRadius: 20,
                                    color: rs.color,
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    padding: '1.5px 13px 1.5px 5px',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    lineHeight: 1.2,
                                    letterSpacing: '-0.03em',
                                    zoom: 0.85,
                                  }}
                                >
                                  {(isSuperAdmin ? ALL_ROLES : ADMIN_ROLES).map(r => <option key={r} value={r} className="bg-white text-slate-700">{r}</option>)}
                                </select>
                              );
                            })()}
                          </div>
                        </td>

                        {/* 활동 지표 */}
                        <td style={{ padding: '0 20px', verticalAlign: 'middle' }}>
                          <div className="flex flex-col gap-1.5 items-center justify-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 shadow-sm">
                                <span className="text-sky-600 text-[10px] font-black">T</span>
                                <span className="text-sky-700 text-[11px] font-black">{u.participationCount || 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm">
                                <span className="text-emerald-600 text-[10px] font-black">M</span>
                                <span className="text-emerald-700 text-[11px] font-black">{u.matchCount || 0}</span>
                              </div>
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm ${u.noShowCount > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                <span className={`${u.noShowCount > 0 ? 'text-rose-600' : 'text-slate-300'} text-[10px] font-black`}>N</span>
                                <span className={`${u.noShowCount > 0 ? 'text-rose-700' : 'text-slate-300'} text-[11px] font-black`}>{u.noShowCount || 0}</span>
                              </div>
                            </div>
                            {(() => {
                              const userCoupons = couponMap[u.id] || [];
                              const activeCoupons = userCoupons.filter(c => {
                                if (c.isUsed) return false;
                                if (c.validityMonths === 'unlimited') return true;
                                if (c.expireAt) {
                                  const expiryDate = c.expireAt?.toDate ? c.expireAt.toDate() : new Date(c.expireAt);
                                  return new Date() < expiryDate;
                                }
                                const createdDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
                                const expiryDate = new Date(createdDate);
                                expiryDate.setMonth(expiryDate.getMonth() + (c.validityMonths || 3));
                                return new Date() < expiryDate;
                              });
                              if (activeCoupons.length > 0) {
                                return (
                                  <div onClick={() => setSelectedCouponUser(u)} className="flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 bg-blue-50 w-fit cursor-pointer hover:bg-blue-100 transition-colors" title="사용 가능한 보유 쿠폰 수">
                                    <Ticket size={10} className="text-blue-500" />
                                    <span className="text-[10px] font-black text-blue-600">{activeCoupons.length}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
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
                              onClick={() => setGeneralSmsTargetUser(u)}
                              className="flex items-center justify-center rounded-lg hover:bg-amber-50 transition-all text-slate-400 hover:text-amber-600"
                              style={{ width: 32, height: 32 }}
                              title="문자 발송"
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              onClick={() => setCouponTarget(u)}
                              className="flex items-center justify-center rounded-lg hover:bg-sky-50 transition-all text-slate-400 hover:text-sky-500"
                              style={{ width: 32, height: 32 }}
                              title="쿠폰 발송"
                            >
                              <Ticket size={14} />
                            </button>
                            <button
                              onClick={() => setSessionRegistrationTarget(u)}
                              className="flex items-center justify-center rounded-lg hover:bg-emerald-50 transition-all text-slate-400 hover:text-emerald-500"
                              style={{ width: 32, height: 32 }}
                              title="기수 참여 등록"
                            >
                              <UserPlus size={14} />
                            </button>
                            {isSuperAdmin && u.role !== 'admin' && u.role !== 'super_admin' ? (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="flex items-center justify-center rounded-lg hover:bg-rose-50 transition-all text-slate-300 hover:text-rose-500"
                              style={{ width: 32, height: 32 }}
                              title="회원 삭제 (최고관리자 전용)"
                            >
                              <Trash2 size={14} />
                            </button>
                            ) : null}
                          </div>
                        </td>

                        {/* 가입일 */}
                        <td style={{ padding: '0 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div className="flex flex-col items-center">
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>
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

            {/* ── Mobile Card View (Visible on <sm) ── */}
            <div className="sm:hidden flex flex-col divide-y divide-slate-100">
              {pagedItems.map(u => {
                const currentStatus = (u.status || 'pending') as keyof typeof STATUS_CFG;
                const sc = STATUS_CFG[currentStatus];
                const photo = u.photos?.[0] || u.profilePhotos?.[0] || u.facePhotos?.[0] || u.bodyPhotos?.[0] || u.photoUrl || u.photoURL;

                return (
                  <div key={u.id} className="p-5 flex flex-col gap-4 bg-white active:bg-slate-50 transition-colors">
                    {/* Top Row: Profile & Basic Info */}
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <div
                          onClick={() => setSelectedUserForProfile(u)}
                          className="w-14 h-14 rounded-2xl border-2 border-white shadow-md flex items-center justify-center overflow-hidden bg-slate-100 cursor-pointer"
                        >
                          {photo ? (
                            <img src={photo} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-slate-400">{u.name?.[0] || 'U'}</span>
                          )}
                        </div>
                        {u.isJobReviewed === false && (
                          <div className="absolute -top-1.5 -right-2 bg-[#FF7E7E] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-md border-2 border-white animate-bounce">
                            정보수정
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[1rem] font-extrabold text-slate-900">{u.name || '미입력'}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${u.gender === 'male' ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
                              {u.gender === 'male' ? '남성' : '여성'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[0.75rem] font-bold text-slate-500">
                            {(() => {
                              if (!u.birthDate) return '-';
                              const digits = u.birthDate.replace(/\D/g, '');
                              if (digits.length === 8) return `${digits.slice(2, 4)}년생`;
                              if (digits.length === 6) return `${digits.slice(0, 2)}년생`;
                              if (digits.length === 4) return `${digits.slice(2, 4)}년생`;
                              return '-';
                            })()}
                          </span>
                          <div className="flex items-center gap-2">
                            {editingJobId === u.id ? (
                              <div className="flex items-center gap-1 w-full min-w-0">
                                <input
                                  autoFocus
                                  value={tempJobValue}
                                  onChange={(e) => setTempJobValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleJobUpdate(u.id, tempJobValue);
                                    if (e.key === 'Escape') setEditingJobId(null);
                                  }}
                                  className="flex-1 min-w-0 h-6 px-1.5 rounded border border-blue-400 text-[10px] font-bold outline-none focus:border-blue-500"
                                />
                                <button 
                                  onClick={() => handleJobUpdate(u.id, tempJobValue)}
                                  className="p-1 rounded bg-blue-600 text-white shrink-0"
                                >
                                  <CheckCircle size={10} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span 
                                  onClick={() => {
                                    setEditingJobId(u.id);
                                    setTempJobValue(u.admin_job || u.job || u.occupation || '');
                                  }}
                                  className={`text-[0.75rem] font-bold truncate cursor-pointer ${u.admin_job || u.job ? 'text-blue-600' : 'text-slate-400'}`}
                                >
                                  {u.admin_job || u.job || u.occupation || '-'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingJobId(u.id);
                                    setTempJobValue(u.admin_job || u.job || u.occupation || '');
                                  }}
                                  className="text-blue-400 hover:text-blue-600 transition-colors"
                                >
                                  <Edit3 size={10} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Role in Top Right */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-auto">
                        <span
                          onClick={() => currentStatus === 'pending' && setSmsTargetUser(u)}
                          className="inline-flex items-center gap-1"
                          style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: 12, color: sc.color, background: sc.bg }}
                        >
                          {sc.label}
                          {currentStatus === 'pending' && u.profileRequestSent && <CheckCircle size={10} />}
                        </span>
                        {u.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #FCD34D, #F59E0B)', color: '#78350F', border: '1px solid #FCD34D' }}>
                            👑 최고관리자
                          </span>
                        ) : !isSuperAdmin && u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                            관리자
                          </span>
                        ) : (() => {
                          const roleStyles: Record<string, { bg: string; color: string; border: string }> = {
                            '일반회원':  { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
                            '신뢰회원':  { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
                            'VIP회원':   { bg: '#FDF4FF', color: '#9333EA', border: '#E9D5FF' },
                            '제안':      { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
                            '블랙':      { bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' },
                            '블랙리스트':{ bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' },
                            'admin':     { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
                          };
                          const userRole = u.role === '블랙리스트' ? '블랙' : (u.role || '일반회원');
                          const rs = roleStyles[userRole] || roleStyles['일반회원'];
                          return (
                            <select
                              value={userRole}
                              onChange={(e) => updateRole(u.id, e.target.value)}
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                display: 'inline-block',
                                width: 'fit-content',
                                maxWidth: 80,
                                background: `${rs.bg} url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='${encodeURIComponent(rs.color)}'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 3px center / 7px 7px`,
                                border: `1px solid ${rs.border}`,
                                borderRadius: 20,
                                color: rs.color,
                                fontSize: '9px',
                                fontWeight: 800,
                                padding: '1.5px 13px 1.5px 5px',
                                cursor: 'pointer',
                                outline: 'none',
                                lineHeight: 1.2,
                                letterSpacing: '-0.03em',
                                zoom: 0.85,
                              }}
                            >
                              {(isSuperAdmin ? ALL_ROLES : ADMIN_ROLES).map(r => <option key={r} value={r} className="bg-white text-slate-700">{r}</option>)}
                            </select>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Middle Row: Metrics & Job Review */}
                    <div className="flex items-center justify-between bg-slate-50/80 rounded-xl p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sky-600 text-[9px] font-black">T</span>
                          <span className="text-slate-700 text-[0.8rem] font-extrabold">{u.participationCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-600 text-[9px] font-black">M</span>
                          <span className="text-slate-700 text-[0.8rem] font-extrabold">{u.matchCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`${u.noShowCount > 0 ? 'text-rose-600' : 'text-slate-300'} text-[9px] font-black`}>N</span>
                          <span className={`${u.noShowCount > 0 ? 'text-rose-700' : 'text-slate-400'} text-[0.8rem] font-extrabold`}>{u.noShowCount || 0}</span>
                        </div>
                        {(() => {
                          const userCoupons = couponMap[u.id] || [];
                          const activeCoupons = userCoupons.filter(c => {
                            if (c.isUsed) return false;
                            if (c.validityMonths === 'unlimited') return true;
                            if (c.expireAt) {
                              const expiryDate = c.expireAt?.toDate ? c.expireAt.toDate() : new Date(c.expireAt);
                              return new Date() < expiryDate;
                            }
                            const createdDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
                            const expiryDate = new Date(createdDate);
                            expiryDate.setMonth(expiryDate.getMonth() + (c.validityMonths || 3));
                            return new Date() < expiryDate;
                          });
                          if (activeCoupons.length > 0) {
                            return (
                              <div onClick={() => setSelectedCouponUser(u)} className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 p-1 -ml-1 rounded transition-colors" title="사용 가능한 보유 쿠폰 수">
                                <Ticket size={12} className="text-blue-500" />
                                <span className="text-blue-600 text-[0.8rem] font-extrabold">{activeCoupons.length}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${u.isJobReviewed ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400 shadow-sm'}`}>
                        <input
                          type="checkbox"
                          checked={!!u.isJobReviewed}
                          onChange={(e) => toggleJobReviewed(u.id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded"
                        />
                        <span className="text-[0.7rem] font-black">직업승인</span>
                      </label>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setGeneralSmsTargetUser(u)}
                        className="flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 transition-all hover:bg-amber-100"
                        style={{ width: 38, height: 38 }}
                        title="문자 발송"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button
                        onClick={() => setCouponTarget(u)}
                        className="flex items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 transition-all hover:bg-sky-100"
                        style={{ width: 38, height: 38 }}
                      >
                        <Ticket size={16} />
                      </button>
                      <button
                        onClick={() => setSessionRegistrationTarget(u)}
                        className="flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 transition-all hover:bg-emerald-100"
                        style={{ width: 38, height: 38 }}
                        title="기수 참여 등록"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={() => reject(u.id, u.name)}
                        className="flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 transition-all hover:bg-rose-100"
                        style={{ width: 38, height: 38 }}
                      >
                        <XCircle size={16} />
                      </button>
                      {isSuperAdmin && u.role !== 'admin' && u.role !== 'super_admin' ? (
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-100 transition-all hover:bg-slate-200"
                        style={{ width: 38, height: 38 }}
                        title="회원 삭제 (최고관리자 전용)"
                      >
                        <Trash2 size={16} />
                      </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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

      {/* 일반 SMS 발송 모달 */}
      {generalSmsTargetUser && (
        <SMSPreviewModal
          isOpen={!!generalSmsTargetUser}
          onClose={() => setGeneralSmsTargetUser(null)}
          onConfirm={handleSendGeneralSms}
          applicant={generalSmsTargetUser}
          session={null}
          recipientLabel={`${generalSmsTargetUser.name}님`}
          confirmLabel="문자 발송"
          defaultMessage={`[키링크] 안녕하세요, {{이름}}님!`}
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
                    <label
                      key={v}
                      onClick={() => setValidityPeriod(v as any)}
                      className="flex items-center gap-1.5 cursor-pointer group"
                    >
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
                disabled={isCouponSubmitDisabled}
                className="transition-all shadow-lg hover:enabled:bg-blue-600 shadow-blue-500/20"
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isCouponSubmitDisabled ? '#E2E8F0' : '#3b82f6',
                  color: isCouponSubmitDisabled ? '#94A3B8' : '#fff',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: isCouponSubmitDisabled ? 'not-allowed' : 'pointer'
                }}
              >
                {isSendingCoupon ? <><Loader2 size={16} className="animate-spin" /> 발송 중...</> : '발송하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기수 참여 등록 모달 */}
      {sessionRegistrationTarget && (
        <div
          onClick={() => !isRegistering && setSessionRegistrationTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '440px', padding: '32px' }}
            className="shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-tight">기수 참여 등록</h2>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">회원을 특정 기수에 직접 등록합니다.</p>
                </div>
              </div>
              <button onClick={() => !isRegistering && setSessionRegistrationTarget(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* 대상 회원 정보 */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">대상 회원</label>
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                    {(() => {
                      const photo = sessionRegistrationTarget.photos?.[0] || sessionRegistrationTarget.profilePhotos?.[0] || sessionRegistrationTarget.facePhotos?.[0] || sessionRegistrationTarget.bodyPhotos?.[0] || sessionRegistrationTarget.photoUrl;
                      return photo ? (
                        <img src={photo} className="w-full h-full object-cover" />
                      ) : (
                        sessionRegistrationTarget.name?.[0] || 'U'
                      );
                    })()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold text-slate-800">{sessionRegistrationTarget.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">{sessionRegistrationTarget.phone || '연락처 없음'}</span>
                  </div>
                </div>
              </div>

              {/* 기수 선택 */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">기수 선택</label>
                {isFetchingSessions ? (
                  <div className="flex items-center justify-center py-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <Loader2 className="animate-spin text-slate-300" size={20} />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-3 px-4 text-sm font-bold text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                    등록 가능한 기수가 없습니다.
                  </div>
                ) : (
                  <select
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-400 outline-none transition-colors text-sm font-semibold text-slate-700 bg-white cursor-pointer shadow-sm"
                  >
                    {sessions.map(s => {
                      const dateStr = s.eventDate ? format(s.eventDate.toDate ? s.eventDate.toDate() : new Date(s.eventDate), 'MM/dd') : '';
                      const regionLabel = s.region === 'busan' ? '부산' : '창원';
                      const epLabel = s.episodeNumber ? `${s.episodeNumber}기` : '';
                      return (
                        <option key={s.id} value={s.id}>
                          [{regionLabel} {epLabel}] {s.title || `${dateStr} 소개팅`} ({dateStr})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* 참가 옵션 선택 (v12.5.0: 승계 기능 포함) */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  참가 옵션
                  {inheritedOption && <span className="ml-2 text-[10px] text-blue-500 font-bold tracking-normal">(이전 결제 내역 감지됨)</span>}
                </label>
                <select
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className={`w-full px-4 py-3 rounded-2xl border outline-none transition-colors text-sm font-semibold cursor-pointer shadow-sm ${
                    inheritedOption && selectedOption !== 'basic'
                      ? 'border-blue-400 bg-blue-50/30 text-blue-700'
                      : 'border-slate-200 focus:border-emerald-400 bg-white text-slate-700'
                  }`}
                >
                  <option value="basic">기본 (일반 참가)</option>
                  {sessionRegistrationTarget.gender === 'male' && (
                    <option value="safe">안심보험 (선택됨)</option>
                  )}
                  {sessionRegistrationTarget.gender === 'female' && (
                    <option value="group">지인동반 (선택됨)</option>
                  )}
                </select>
                {inheritedOption && selectedOption !== 'basic' && (
                  <p className="text-[11px] font-bold text-blue-500 mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                    이전 기수 결제액(₩{Number(inheritedOption.amountPaid || inheritedOption.price || 0).toLocaleString()})이 승계됩니다.
                  </p>
                )}
              </div>

              {/* 등록 상태 선택 */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-3">등록 상태 설정</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'applied', label: '검토 중', desc: '일반 신청' },
                    { key: 'selected', label: '선발 대기', desc: '입금 안내' },
                    { key: 'confirmed', label: '참가 확정', desc: '슬롯 배정' }
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setRegistrationStatus(item.key as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all text-center ${
                        registrationStatus === item.key
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
                          : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <span className="text-xs font-extrabold">{item.label}</span>
                      <span className="text-[9px] font-bold opacity-60 mt-1">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '32px' }}>
              <button
                onClick={() => setSessionRegistrationTarget(null)}
                disabled={isRegistering}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={() => handleManualRegister()}
                disabled={isRegistering || sessions.length === 0 || !selectedSessionId}
                className="disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#10B981', color: '#fff', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {isRegistering ? <><Loader2 size={16} className="animate-spin" /> 등록 중...</> : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 보유 쿠폰 현황 모달 */}
      {selectedCouponUser && (
        <div
          onClick={() => setSelectedCouponUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '420px', padding: '32px' }}
            className="shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                  <Ticket size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-tight">보유 쿠폰 내역</h2>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{selectedCouponUser.name} 회원</p>
                </div>
              </div>
              <button onClick={() => setSelectedCouponUser(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto kl-scrollbar pr-2 space-y-3">
              {(() => {
                const coupons = [...(couponMap[selectedCouponUser.id] || [])];
                if (coupons.length === 0) {
                  return (
                    <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <Ticket size={32} className="text-slate-200 mb-3" />
                      <p className="text-sm font-bold text-slate-400">보유한 쿠폰이 없습니다.</p>
                    </div>
                  );
                }

                coupons.sort((a, b) => {
                  const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
                  const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
                  return bTime - aTime;
                });

                return coupons.map(coupon => {
                  const createdDate = coupon.createdAt?.toDate ? coupon.createdAt.toDate() : new Date(coupon.createdAt);
                  let expiryDate = new Date(createdDate);
                  if (coupon.expireAt || coupon.expiresAt) {
                    const exp = coupon.expireAt || coupon.expiresAt;
                    expiryDate = exp.toDate ? exp.toDate() : new Date(exp);
                  } else if (coupon.validityMonths !== 'unlimited') {
                    expiryDate.setMonth(expiryDate.getMonth() + Number(coupon.validityMonths));
                  }
                  
                  const isExpired = coupon.validityMonths !== 'unlimited' && new Date() > expiryDate;
                  const isUsable = !coupon.isUsed && !isExpired;

                  return (
                    <div 
                      key={coupon.id} 
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        coupon.isUsed ? 'bg-slate-50 border-slate-200 opacity-60' :
                        isExpired ? 'bg-rose-50 border-rose-100 opacity-60' :
                        'bg-white border-blue-100 shadow-sm'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              coupon.isUsed ? 'bg-slate-200 text-slate-500' :
                              isExpired ? 'bg-rose-200 text-rose-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {coupon.isUsed ? '사용 완료' : isExpired ? '기한 만료' : '사용 가능'}
                            </span>
                            <span className="text-[0.85rem] font-bold text-slate-800">{coupon.title}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteCoupon(selectedCouponUser.id, coupon.id)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                            title="쿠폰 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex items-center flex-nowrap gap-3 text-[11px] font-bold mt-2 whitespace-nowrap overflow-x-auto kl-scrollbar pb-1">
                          <span className="text-blue-600 shrink-0">
                            {coupon.type === 'percent' ? `${coupon.value || coupon.amount}% 할인` : `₩${(coupon.value || coupon.amount || 0).toLocaleString()} 할인`}
                          </span>
                          <span className="text-slate-300 shrink-0">|</span>
                          <span className="text-slate-500 shrink-0">
                            {format(createdDate, 'yyyy.MM.dd')} 발급
                          </span>
                          <span className="text-slate-300 shrink-0">|</span>
                          <span className={`${isExpired ? 'text-rose-500' : 'text-slate-500'} shrink-0`}>
                            {coupon.validityMonths === 'unlimited' ? '무제한' : `${format(expiryDate, 'yyyy.MM.dd')} 까지`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
