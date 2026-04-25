'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, Loader2,
  FileText, Users, CreditCard, Filter, Calendar, MapPin,
  X, Phone, Briefcase, Ruler, Smile, Cigarette, Beer, Camera, Info, 
  Ticket, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import UserProfileModal from '../users/UserProfileModal';
import { 
  collection, getDocs, doc, query, where, orderBy, Timestamp, getDoc, onSnapshot 
} from 'firebase/firestore';
import {
  selectApplicant,
  confirmPayment,
  cancelApplicant,
  restoreApplicant,
  holdApplicant,
} from '@/lib/admin/selection';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import SMSPreviewModal from '@/components/admin/SMSPreviewModal';
import { updateDoc } from 'firebase/firestore'; 

const DEPOSIT_STATUS = {
  pending:   { label: '입금 대기', color: '#64748B', bg: '#F1F5F9' },
  confirmed: { label: '입금 확인', color: '#2563EB', bg: '#EFF6FF'  },
};

const APP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  applied:   { label: '검토 중',   color: '#D97706', bg: '#FFFBEB'  },
  selected:  { label: '입금 대기', color: '#7C3AED', bg: '#F5F3FF' },
  held:      { label: '보류',      color: '#EA580C', bg: '#FFF7ED'  },
  confirmed: { label: '참가 확정', color: '#059669', bg: '#ECFDF5'  },
  cancelled: { label: '취소',      color: '#DC2626', bg: '#FEF2F2'  },
};

const panel = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

// Skeletons
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-100 rounded ${className}`} />
);

export default function ApplicationsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [applications, setApplications] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // Filtering & Modal States
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  const [filterUnselectedOnly, setFilterUnselectedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // v8.4.4: 필터링 상태 초기화 (헤더 필터 제거로 인한 전체 보기 복구)
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'appliedAt', direction: 'desc' });
  const [ageFilter, setAgeFilter] = useState<string>('all'); 
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 1. sessions 컬렉션 실시간 동기화
  useEffect(() => {
    // v7.4.1: episodeNumber 기준 내림차순 정렬 (최신 기수가 맨 위로)
    const q = query(collection(db, 'sessions'), orderBy('episodeNumber', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const fetchedEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setEvents(fetchedEvents);
      // v7.4.0: 기본값을 'all'로 설정하여 진입 시 전체 목록 노출 가능
      if (!selectedEventId && fetchedEvents.length > 0) {
        setSelectedEventId('all');
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching sessions:', err);
      toast.error('기수 목록을 불러오지 못했습니다.');
      setIsLoading(false);
    });
    return () => unsub();
  }, [selectedEventId]);

  // 2. 신청 내역 실시간 동기화
  useEffect(() => {
    if (!selectedEventId) return;

    setIsDataLoading(true);
    const q = selectedEventId === 'all'
      ? query(collection(db, 'applications'), orderBy('appliedAt', 'desc'))
      : query(
          collection(db, 'applications'),
          where('sessionId', '==', selectedEventId),
          orderBy('appliedAt', 'desc')
        );

    const unsub = onSnapshot(q, async (snap) => {
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setApplications(apps);
      
      // users 컬렉션에서 누락된 정보 조인
      const uids = Array.from(new Set(apps.map((a: any) => a.userId))) as string[];
      const newUserMap = { ...userMap };
      let updated = false;

      const missingUids = uids.filter(uid => !newUserMap[uid]);
      if (missingUids.length > 0) {
        for (const uid of missingUids) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            newUserMap[uid] = uSnap.data();
            updated = true;
          }
        }
      }
      
      if (updated) setUserMap(newUserMap);
      setIsDataLoading(false);
    }, (err) => {
      console.error('Error fetching applications:', err);
      setIsDataLoading(false);
    });

    return () => unsub();
  }, [selectedEventId]);

  // status 변경 로직
  const updateAppStatus = async (app: any, status: string, customMessage?: string) => {
    try {
      const { id: appId, sessionId, gender, status: prevStatus } = app;
      const user = userMap[app.userId] || {};
      
      if (status === 'selected') {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/applications/select', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            applicationId: appId,
            customMessage: customMessage
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '처리 중 오류가 발생했습니다.');
        
        if (data.warning) {
          toast(data.warning, { icon: '⚠️', duration: 4000 });
        } else {
          toast.success('선발 및 안내 문자 발송 완료');
        }
      } else if (status === 'applied') {
        const appRef = doc(db, 'applications', appId);
        await updateDoc(appRef, {
          status: 'applied',
          updatedAt: Timestamp.now()
        });
        toast.success('검토 중 상태로 변경되었습니다.');
      } else if (status === 'held') {
        await holdApplicant(appId);
        toast.success('보류 처리 완료');
      } else if (status === 'confirmed') {
        if (prevStatus === 'cancelled') {
          await restoreApplicant(appId, sessionId, gender);
        } else {
          await confirmPayment(appId, sessionId, gender);
        }
        toast.success('참가 확정 완료');
      } else if (status === 'cancelled') {
        await cancelApplicant(appId, sessionId, gender, prevStatus === 'confirmed');
        toast.success('취소 처리 완료');
      }
      
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || '상태 업데이트에 실패했습니다.');
    }
  };

  const handleOpenPreview = (app: any) => {
    const session = events.find(e => e.id === app.sessionId);
    if (!session) return toast.error('세션 정보를 찾을 수 없습니다.');
    const user = userMap[app.userId] || {};
    
    // 기본 메시지 템플릿 생성 (API 로직과 맞춤)
    const eventTime = session.eventDate.toDate();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(eventTime);
    const getPart = (t: string) => parts.find(p => p.type === t)?.value;
    const fDate = `${getPart('month')}/${getPart('day')}`;
    const fDay = `(${getPart('weekday')})`;
    const fTime = `${getPart('hour')}:${getPart('minute')}`;

    const defaultMsg = `안녕하세요 ! 키링크에 지원해주셔서 감사합니다☺️
${user.name || '참가자'}님은 ${fDate} ${fDay} ${fTime} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 ${ (app.price || session.price || 60000).toLocaleString('ko-KR') }원 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요😭
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요🥰`;

    setPreviewData({ app, session, defaultMsg });
    setPreviewModalOpen(true);
  };

  // v8.4.5: 더미 계정 직업 보정 로직 (검색 범위 확장 & batch 처리성 Promise.all)
  const handleFixDummyJobs = async () => {
    const dummyJobs = ['회사원', '대기업', '공기업', '공무원', '초등교사', '승무원', '교육직', '기술직', '군무원', '전문직', 'IT개발자'];
    let count = 0;
    try {
      // 1. 유저 데이터 전체 스캔
      const usersSnap = await getDocs(collection(db, 'users'));
      const newUserMap = { ...userMap };
      const userUpdatePromises: Promise<void>[] = [];
      const updatedUserIds = new Set<string>();

      usersSnap.forEach(docSnap => {
        const user = docSnap.data();
        const name = user.name || '';
        const job = user.job || '';
        const email = user.email || '';

        // v8.4.5: 광범위한 더미 식별 로직 (이름에 더미 포함 OR 직업이 비어있음 OR 이메일에 test/dummy 포함)
        const isDummyName = name.includes('더미');
        const isJobEmpty = !job || job === '-' || job.trim() === '';
        const isTestEmail = email.includes('test') || email.includes('dummy');

        if (isDummyName || isJobEmpty || isTestEmail) {
          const randomJob = dummyJobs[Math.floor(Math.random() * dummyJobs.length)];
          const userRef = doc(db, 'users', docSnap.id);
          
          userUpdatePromises.push(updateDoc(userRef, { 
            job: randomJob,
            updatedAt: Timestamp.now()
          }));
          
          updatedUserIds.add(docSnap.id);
          count++;
          
          // 로컬 상태 바로 업데이트 준비
          newUserMap[docSnap.id] = { ...user, job: randomJob };
        }
      });

      if (count === 0) {
        toast('보정할 더미 계정이 없습니다.');
        return;
      }

      await Promise.all(userUpdatePromises);

      // 3. UI 상태 동기화 (onSnapshot이 있지만 즉각적인 반응성 확보)
      setUserMap(newUserMap);
      toast.success(`총 ${count}명의 더미 데이터 직업 보정이 완료되었습니다.`);
    } catch (e) {
      console.error(e);
      toast.error('더미 데이터 보정 중 오류가 발생했습니다.');
    }
  };

  const activeEvent = events.find(e => e.id === selectedEventId);
  
  // v8.1.7: 실시간 선발 현황 계산 (selected + confirmed)
  const selectionStats = useMemo(() => {
    if (selectedEventId === 'all') return { male: 0, female: 0 };
    const male = applications.filter(a => a.gender === 'male' && (a.status === 'selected' || a.status === 'confirmed')).length;
    const female = applications.filter(a => a.gender === 'female' && (a.status === 'selected' || a.status === 'confirmed')).length;
    return { male, female };
  }, [applications, selectedEventId]);

  const isMaleFull = selectionStats.male >= (activeEvent?.maxMale || 8);
  const isFemaleFull = selectionStats.female >= (activeEvent?.maxFemale || 8);

  // v8.1.7: 정원을 초과한 확정자 색출 (오래된 순으로 선발했다고 가정할 때, 가장 최근에 신청/확정된 사람을 초과 인원으로 간주)
  const overQuotaAppIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedEventId === 'all' || !activeEvent) return ids;

    // 적용 순(또는 변경 순) 정렬: 가장 먼저 신청한 사람이 정원 내, 늦게 신청한 사람이 초과
    const getSortedSelected = (gender: string) => 
      applications
        .filter(a => a.gender === gender && (a.status === 'selected' || a.status === 'confirmed'))
        // 신청일 기준 오름차순 (먼저 신청한 사람 1순위)
        .sort((a, b) => {
          const aTime = a.appliedAt?.toMillis?.() || a.appliedAt || 0;
          const bTime = b.appliedAt?.toMillis?.() || b.appliedAt || 0;
          return aTime - bTime;
        });

    const males = getSortedSelected('male');
    const females = getSortedSelected('female');

    males.slice(activeEvent.maxMale || 8).forEach(a => ids.add(a.id));
    females.slice(activeEvent.maxFemale || 8).forEach(a => ids.add(a.id));

    return ids;
  }, [applications, activeEvent, selectedEventId]);

  const filtered = useMemo(() => {
    let result = applications.filter(app => {
      const user = userMap[app.userId] || {};
      const matchesSearch = 
        (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.workplace || user.job || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.residence || user.location || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGender = filterGender === 'all' || app.gender === filterGender;
      const matchesUnselected = !filterUnselectedOnly || app.status === 'applied';
      
      // v8.4.1: 나이 대별 필터링
      let matchesAge = true;
      if (ageFilter !== 'all') {
        const birthYear = user.birthDate ? parseInt(user.birthDate.includes('-') ? user.birthDate.slice(0,4) : (user.birthDate.length === 6 ? '19'+user.birthDate.slice(0,2) : user.birthDate.slice(0,4))) : 0;
        if (ageFilter === '90s') matchesAge = birthYear >= 1990 && birthYear <= 1999;
        else if (ageFilter === '80s') matchesAge = birthYear >= 1980 && birthYear <= 1989;
        else if (ageFilter === '00s') matchesAge = birthYear >= 2000 && birthYear <= 2009;
      }

      // v8.4.1: 상태 필터링
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

      return matchesSearch && matchesGender && matchesUnselected && matchesAge && matchesStatus;
    });

    // v8.4.1: 정렬 로직
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortConfig.field === 'no') return 0; // Handled by index in display
      if (sortConfig.field === 'age') {
        const userA = userMap[a.userId] || {};
        const userB = userMap[b.userId] || {};
        aVal = userA.birthDate || '0';
        bVal = userB.birthDate || '0';
      } else if (sortConfig.field === 'appliedAt') {
        aVal = a.appliedAt?.toMillis?.() || a.appliedAt || 0;
        bVal = b.appliedAt?.toMillis?.() || b.appliedAt || 0;
      } else {
        aVal = a[sortConfig.field] || '';
        bVal = b[sortConfig.field] || '';
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [applications, userMap, searchQuery, filterGender, filterUnselectedOnly, ageFilter, statusFilter, sortConfig]);

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0F172A' }}>신청 관리</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 2 }}>참가 신청자들의 상세 정보를 심사하고 선발 여부를 결정합니다. <span className="text-[10px] font-bold text-[#3B82F6] ml-2">v8.8.6</span></p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:flex-none group">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-white border-2 border-[#FFD2CE]/60 rounded-2xl pr-10 text-xs font-black text-slate-800 outline-none focus:border-[#FF7E7E]/60 transition-all cursor-pointer shadow-sm appearance-none"
              style={{ minWidth: '180px', width: 'auto', height: '48px', paddingLeft: '16px' }}
            >
              <option value="all">전체 기수 보기</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.region === 'busan' ? '부산' : ev.region === 'changwon' ? '창원' : (ev.region ?? '부산')} {ev.episodeNumber}기 [{(ev.status === 'open' || ev.status === 'recruiting') ? '모집중' : '마감'}]
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#FF7E7E]/60 group-hover:text-[#FF7E7E] transition-colors">
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
          <button 
            onClick={handleFixDummyJobs}
            className="flex items-center gap-2 rounded-2xl transition-all hover:bg-orange-50" style={{ height: '48px', padding: '0 15px', fontSize: '0.75rem', background: '#fff', border: '1px solid #fed7aa', color: '#ea580c', fontWeight: 800 }}>
            <Briefcase size={14} /> 더미 직업 보정
          </button>
          <button className="flex items-center gap-2 rounded-2xl transition-all hover:bg-slate-100" style={{ height: '48px', padding: '0 20px', fontSize: '0.85rem', background: '#fff', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 800 }}>
            <Download size={14} className="text-[#64748B]" /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Summary Info Header */}
      {activeEvent && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '전체 신청',   value: applications.length,                                                         icon: Users,       color: '#FF6F61' },
            { label: '입금 대기',   value: applications.filter((a: any) => a.status === 'selected').length,              icon: CreditCard,  color: '#a78bfa' },
            { label: '참가 확정',   value: applications.filter((a: any) => a.status === 'confirmed').length,             icon: CheckCircle, color: '#4ade80' },
            { 
              label: '정원 현황',  
              value: (
                <span className={selectionStats.male + selectionStats.female > (activeEvent.maxMale || 0) + (activeEvent.maxFemale || 0) ? 'text-rose-500 animate-pulse font-black inline-block' : ''}>
                  {selectionStats.male + selectionStats.female} / {(activeEvent.maxMale||0)+(activeEvent.maxFemale||0)}
                </span>
              ), 
              icon: Calendar, 
              color: '#facc15' 
            },
            { 
              label: '선발 현황 (Reserved)', 
              value: (
                <div className="flex items-center gap-1 text-[0.95rem]">
                  남 
                  <span className={selectionStats.male > (activeEvent.maxMale || 0) ? 'text-rose-500 animate-pulse font-black inline-block' : ''}>
                    {selectionStats.male}/{activeEvent.maxMale}
                  </span>
                  <span className="mx-1">·</span> 
                  여 
                  <span className={selectionStats.female > (activeEvent.maxFemale || 0) ? 'text-rose-500 animate-pulse font-black inline-block' : ''}>
                    {selectionStats.female}/{activeEvent.maxFemale}
                  </span>
                </div>
              ), 
              icon: ShieldCheck, 
              color: '#3B82F6' 
            },
          ].map((item, i) => (
            <div key={i} style={{ ...panel, padding: '16px 20px' }} className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>{item.label}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                <item.icon size={18} style={{ color: item.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ ...panel, padding: '12px 20px' }} className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            {[
              { id: 'all', label: '전체' },
              { id: 'male', label: '남성' },
              { id: 'female', label: '여성' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setFilterGender(t.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterGender === t.id ? 'bg-white text-[#FF7E7E] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setFilterUnselectedOnly(!filterUnselectedOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${filterUnselectedOnly ? 'bg-[#FF7E7E] text-white border-[#FF7E7E] shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-[#FF7E7E]/30'}`}
          >
            미선발만 보기
          </button>
        </div>

        <div className="relative w-full md:w-[320px] group flex items-center">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Search size={16} className="text-slate-400 group-focus-within:text-[#FF7E7E] transition-colors" />
          </div>
          <input
            type="text"
            placeholder="이름, 직업, 거주지로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pr-4 text-sm font-bold text-slate-800 outline-none focus:border-[#FF7E7E]/30 focus:bg-slate-50/30 transition-all shadow-inner"
            style={{ height: '48px', paddingLeft: '44px' }}
          />
        </div>
      </div>

      {/* v8.1.7: 초과 인원 경고 배너 */}
      {activeEvent && (selectionStats.male > (activeEvent.maxMale || 8) || selectionStats.female > (activeEvent.maxFemale || 8)) && (
        <div className="p-5 rounded-2xl bg-rose-600 border-2 border-rose-400 flex items-center gap-4 animate-bounce shadow-lg">
          <XCircle className="text-white shrink-0" size={28} />
          <div className="flex-1">
            <p className="text-white font-black text-lg">⚠️ 현재 선발 인원이 정원을 초과했습니다!</p>
            <p className="text-rose-100 text-sm mt-1 font-bold">
              참여자 상태를 조정하여 정원을 맞추거나, 행사 관리에서 정원을 늘려주세요.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Table (Light Premium Theme - Clean White) */}
      <div className="mx-auto w-full" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="overflow-auto max-h-[75vh]">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead className="sticky top-0 z-20 shadow-sm" style={{ background: '#F8FAFC' }}>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                {/* NO */}
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: sortConfig.field === 'appliedAt' ? '#FF6F61' : '#64748B', textTransform: 'uppercase' }}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div onClick={() => setSortConfig({ field: 'appliedAt', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="cursor-pointer flex items-center justify-center gap-1">
                      NO <span style={{ color: sortConfig.field === 'appliedAt' ? '#FF6F61' : '#CBD5E1' }}>{sortConfig.field === 'appliedAt' && sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    </div>
                  </div>
                </th>
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>프로필</th>
                <th style={{ padding: '18px 10px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>이름</th>
                <th style={{ padding: '18px 10px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>직업</th>
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: selectedEventId !== 'all' ? '#3B82F6' : '#64748B' }}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div onClick={() => setSortConfig({ field: 'sessionId', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="cursor-pointer flex items-center justify-center gap-1">
                      신청 기수 <span style={{ color: sortConfig.field === 'sessionId' ? '#FF6F61' : '#CBD5E1' }}>{sortConfig.field === 'sessionId' && sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    </div>
                  </div>
                </th>
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: ageFilter !== 'all' ? '#FF6F61' : '#64748B' }}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div onClick={() => setSortConfig({ field: 'age', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="cursor-pointer flex items-center justify-center gap-1">
                      나이 <span style={{ color: sortConfig.field === 'age' ? '#FF6F61' : '#CBD5E1' }}>{sortConfig.field === 'age' && sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    </div>
                  </div>
                </th>
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>거주지</th>
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>연락처</th>
                <th style={{ padding: '18px 10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: statusFilter !== 'all' ? '#FF6F61' : '#64748B' }}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div onClick={() => setSortConfig({ field: 'status', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="cursor-pointer flex items-center justify-center gap-1">
                      상태 <span style={{ color: sortConfig.field === 'status' ? '#FF6F61' : '#CBD5E1' }}>{sortConfig.field === 'status' && sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    </div>
                  </div>
                </th>
                <th style={{ padding: '18px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>선발 관리</th>
              </tr>
            </thead>
            <tbody>
              {isDataLoading ? (
                [1,2,3,4,5,6,7,8].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', height: '88px' }}>
                    <td colSpan={10} style={{ padding: '0 20px' }}><Skeleton className="h-10 w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '100px 20px', textAlign: 'center', color: '#555' }}>
                    <div className="flex flex-col items-center gap-4">
                      <FileText size={48} className="opacity-10 text-slate-400" />
                      <p style={{ fontSize: '0.9rem', color: '#64748B' }}>검색 결과와 일치하는 신청 내역이 없습니다.</p>
                      {(filterGender !== 'all' || filterUnselectedOnly || searchQuery) && (
                        <button onClick={() => { setFilterGender('all'); setFilterUnselectedOnly(false); setSearchQuery(''); }} className="text-[#FF6F61] text-xs font-bold underline">필터 초기화</button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((app, index) => {
                  const user = userMap[app.userId] || {};
                  const dStatus = DEPOSIT_STATUS[app.depositStatus as keyof typeof DEPOSIT_STATUS] || DEPOSIT_STATUS.pending;
                  const aStatus = APP_STATUS[app.status] || APP_STATUS['applied'];
                  const event = events.find(e => e.id === app.sessionId);
                  const regionName = !event ? '-' : event.region === 'busan' ? '부산' : event.region === 'changwon' ? '창원' : event.region;
                  const eventDateLabel = event?.eventDate ? format(event.eventDate.toDate(), 'MM.dd (E)', { locale: ko }) : '';

                  const isFull = (app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull);
                  const canSelect = app.status === 'applied' || app.status === 'held';
                  const isOverQuota = overQuotaAppIds.has(app.id); // v8.1.7

                  return (
                    <tr 
                      key={app.id} 
                      style={{ 
                        borderBottom: '1px solid #f0f0f0', 
                        height: '88px',
                        // 정원 초과로 선택/확정된 사람은 명확한 빨간색, 더 이상 선택 못하게 막힌 줄은 연한 붉은색
                        background: isOverQuota ? '#FFE4E6' : ((canSelect && isFull) ? '#FFF1F2' : 'transparent')
                      }} 
                      className={`transition-colors group cursor-default ${ (canSelect && isFull) ? 'opacity-85' : 'hover:bg-slate-50' }`}
                    >
                      {/* NO */}
                      <td style={{ padding: '0 16px', textAlign: 'center' }}>
                        <span className="text-slate-400 font-bold text-[0.8rem]">{filtered.length - index}</span>
                      </td>

                      {/* 프로필 */}
                      <td style={{ padding: '0 16px' }}>
                        <div 
                          className="w-12 h-12 rounded-full border-2 border-[#D4AF37] shadow-sm flex items-center justify-center overflow-hidden bg-slate-100 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                          style={{ boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)' }}
                          onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                        >
                          {user.photoUrl || user.photoURL || user.photos?.[0] ? (
                            <img src={user.photoUrl || user.photoURL || user.photos?.[0]} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-[#D4AF37]">{user.name?.[0] || 'U'}</span>
                          )}
                        </div>
                      </td>

                      {/* 이름 */}
                      <td style={{ padding: '0 16px' }}>
                        <div className="flex flex-col">
                          <button 
                            onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                            className="text-[0.95rem] font-black text-slate-800 hover:text-[#FF7E7E] transition-colors text-left whitespace-nowrap"
                          >
                            {user.name || app.name || '미입력'}
                          </button>
                          <span className={`text-[0.65rem] font-bold mt-1 ${user.gender === 'male' ? 'text-blue-500' : 'text-rose-500'} flex items-center gap-1.5`}>
                            {user.gender === 'male' ? '남성' : '여성'}
                            {isFull && canSelect && (
                              <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-md text-[9px] font-black animate-pulse">정원 마감</span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* 직업 (v8.8.6: 회원 정보 마스터 기준 읽기 전용) */}
                      <td style={{ padding: '0 16px' }}>
                        <p className={`text-[0.85rem] font-bold tracking-tight ${user.job ? 'text-slate-800' : 'text-slate-400'}`}>
                          {user.job || user.workplace?.split(',')[0] || <span className="font-normal">-</span>}
                          {user.isJobReviewed && <CheckCircle size={10} className="inline ml-1 text-blue-500 mb-0.5" />}
                        </p>
                      </td>

                      {/* 기수 */}
                      <td style={{ padding: '0 16px', textAlign: 'center' }}>
                        <div className="flex flex-col items-center">
                          <p className="text-[0.85rem] font-black text-slate-800 tracking-tighter whitespace-nowrap">{regionName} {event?.episodeNumber || '??'}기</p>
                          <p className="text-[0.65rem] font-bold text-[#FF7E7E] mt-1">{eventDateLabel}</p>
                        </div>
                      </td>

                      {/* 나이 */}
                      <td style={{ padding: '0 16px' }}>
                        <p className="text-[0.9rem] font-extrabold text-slate-800">{user.birthDate ? `${user.birthDate.includes('-') ? user.birthDate.slice(2,4) : user.birthDate.slice(0,2)}년생` : '??'}</p>
                      </td>

                      {/* 거주지 */}
                      <td style={{ padding: '0 16px' }}>
                        <p className="text-[0.85rem] font-bold text-slate-700 whitespace-nowrap">{app.residence || user.residence || user.location || <span className="text-slate-300 font-normal">-</span>}</p>
                      </td>

                      {/* 연락처 */}
                      <td style={{ padding: '0 16px', textAlign: 'center' }}>
                        <p className="text-[0.85rem] text-slate-600 font-bold tracking-tight whitespace-nowrap">{user.phone || <span className="text-slate-300 font-normal">-</span>}</p>
                      </td>

                      {/* 상태/결제 */}
                      <td style={{ padding: '0 16px' }}>
                        <div className="flex flex-col gap-1.5">
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, width: 'fit-content', background: aStatus.bg, color: aStatus.color, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>{aStatus.label}</span>
                          {app.paymentConfirmed ? (
                            <span className="text-[10px] text-blue-500 font-black flex items-center gap-1"><CheckCircle size={10}/> 입금완료</span>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> 입금대기</span>
                          )}
                        </div>
                      </td>

                      {/* 선발 관리 */}
                       <td style={{ padding: '0 16px' }}>
                        <div className="flex items-center justify-end gap-1.5 transition-all">
                          {(app.status === 'applied' || app.status === 'held') && (
                            <>
                              {app.status === 'held' && (
                                <button 
                                  onClick={() => updateAppStatus(app, 'applied')} 
                                  className="px-2.5 py-1.5 rounded-lg text-[0.7rem] font-black bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-all shadow-sm flex items-center gap-1 group/held"
                                  title="검토 중으로 되돌리기"
                                >
                                  보류 중 <X size={12} className="opacity-0 group-hover/held:opacity-100 transition-opacity" />
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  if (!user.isJobReviewed) return toast.error('먼저 회원 관리에서 직업 정보를 확인하고 승인(Job Reviewed)해 주세요.');
                                  if ((app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull)) {
                                    return toast.error(`해당 성별의 모집 정원이 이미 충족되었습니다. (최대 ${app.gender === 'male' ? activeEvent?.maxMale : activeEvent?.maxFemale}명)`);
                                  }
                                  if (window.confirm('문자 발송 없이 입금 완료 처리하시겠습니까?')) {
                                    updateAppStatus(app, 'confirmed');
                                  }
                                }} 
                                disabled={!user.isJobReviewed || (app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull)}
                                className={`px-3 py-1.5 rounded-xl text-[0.75rem] font-bold border transition-all shadow-sm ${
                                  !user.isJobReviewed || (app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull)
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed grayscale'
                                    : 'bg-[#FFD700]/10 text-[#B8860B] border-[#FFD700]/30 hover:bg-[#FFD700] hover:text-white'
                                }`}
                                title={!user.isJobReviewed ? "먼저 직업 정보를 확인/수정하고 승인해 주세요" : ""}
                              >
                                선발확정
                              </button>
                              <button 
                                onClick={() => {
                                  if (!user.isJobReviewed) return toast.error('먼저 회원 관리에서 직업 정보를 확인하고 승인(Job Reviewed)해 주세요.');
                                  if ((app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull)) {
                                    return toast.error(`해당 성별의 모집 정원이 이미 충족되었습니다. (최대 ${app.gender === 'male' ? activeEvent?.maxMale : activeEvent?.maxFemale}명)`);
                                  }
                                  handleOpenPreview(app);
                                }} 
                                disabled={!user.isJobReviewed || (app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull)}
                                className={`px-3 py-1.5 rounded-xl text-[0.75rem] font-bold border transition-all shadow-sm ${
                                  !user.isJobReviewed || (app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull)
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed grayscale'
                                    : 'bg-[#FF7E7E]/10 text-[#FF7E7E] border-[#FF7E7E]/20 hover:bg-[#FF7E7E] hover:text-white'
                                }`}
                                title={!user.isJobReviewed ? "먼저 직업 정보를 확인/수정하고 승인해 주세요" : ""}
                              >
                                선발
                              </button>
                              
                              {app.status === 'applied' && (
                                <button onClick={() => updateAppStatus(app, 'held')} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-all shadow-sm">보류</button>
                              )}
                            </>
                          )}
                          
                          {app.status === 'selected' && (
                            <button onClick={() => updateAppStatus(app, 'confirmed')} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-[#FFD700]/10 text-[#B8860B] border border-[#FFD700]/30 hover:bg-[#FFD700] hover:text-white transition-all shadow-sm">입금확정</button>
                          )}
                          
                          {app.status === 'cancelled' ? (
                            <button
                              onClick={() => updateAppStatus(app, 'confirmed')}
                              className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            >
                              복구
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (window.confirm('정말 취소하시겠습니까? (확정된 참가자의 경우 정원 카운트도 줄어듭니다)')) {
                                  updateAppStatus(app, 'cancelled');
                                }
                              }}
                              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-rose-50 text-rose-400 opacity-0 group-hover:opacity-100 border border-rose-100 hover:bg-rose-500 hover:text-white shadow-sm"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      <UserProfileModal user={selectedUser} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedUser(null); }} />
      <SMSPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onConfirm={async (msg) => {
          if (previewData) await updateAppStatus(previewData.app, 'selected', msg);
        }}
        applicant={previewData?.app}
        session={previewData?.session}
        defaultMessage={previewData?.defaultMsg || ''}
      />
    </div>
  );
}
