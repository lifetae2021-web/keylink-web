'use client';

import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, CheckCircle, XCircle, Eye,
  Download, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, Loader2,
  FileText, Users, CreditCard, Filter, Calendar, MapPin,
  X, Phone, Briefcase, Ruler, Smile, Cigarette, Beer, Camera, Info,
  Ticket, Edit3, Trash2, UserPlus, User, MessageSquare, Heart, UserX, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import UserProfileModal from '../users/UserProfileModal';
import {
  collection, getDocs, doc, query, where, orderBy, Timestamp, getDoc, onSnapshot, writeBatch, increment, limit, deleteField
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
import { chosungIncludes } from '@/lib/utils';
import { updateDoc } from 'firebase/firestore';
import AdminApplicationList from '@/components/admin/AdminApplicationList'; // v8.12.7: 1:1 매칭 리스트 컴포넌트 추가

const DEPOSIT_STATUS = {
  pending: { label: '입금대기', color: '#64748B', bg: '#F1F5F9' },
  confirmed: { label: '입금확인', color: '#2563EB', bg: '#EFF6FF' },
};

const APP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  applied: { label: '검토중', color: '#D97706', bg: '#FFFBEB' },
  selected: { label: '입금대기', color: '#7C3AED', bg: '#F5F3FF' },
  held: { label: '보류', color: '#EA580C', bg: '#FFF7ED' },
  confirmed: { label: '참가확정', color: '#059669', bg: '#ECFDF5' },
  cancelled: { label: '취소', color: '#DC2626', bg: '#FEF2F2' },
};

const panel = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };

// Skeletons
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-100 rounded ${className}`} />
);

export default function ApplicationsPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        return;
      }
      try {
        // v12.1.0: 토큰 강제 갱신 → Firestore 리스너 실행 전 최신 인증 토큰 보장
        await user.getIdToken(true);
        const snap = await getDoc(doc(db, 'users', user.uid));
        const role = snap.exists() ? snap.data()?.role : null;
        setIsAdmin(role === 'admin' || role === 'super_admin');
        setIsSuperAdmin(snap.exists() && role === 'super_admin');
      } catch (e) {
        console.error('Error fetching user role:', e);
        setIsAdmin(false);
        setIsSuperAdmin(false);
      }
    });
    return () => unsub();
  }, []);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [applications, setApplications] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Filtering & Modal States
  const [activeTab, setActiveTab] = useState<'group' | '1on1'>('group'); // v8.12.7: 탭 상태 추가
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [generalSmsTarget, setGeneralSmsTarget] = useState<any | null>(null);
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [changeSessionModalOpen, setChangeSessionModalOpen] = useState(false);
  const [changeSessionApp, setChangeSessionApp] = useState<any>(null);
  const [targetSessionId, setTargetSessionId] = useState<string>('');

  // v8.4.4: 필터링 상태 초기화
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'appliedAt', direction: 'desc' });
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dummyFilter, setDummyFilter] = useState<'exclude' | 'only'>('exclude');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

  // 매칭 결과 (matchingSummaries 컬렉션)
  const [matchingSummary, setMatchingSummary] = useState<any>(null);

  // 1. sessions 컬렉션 실시간 동기화 (isAdmin 확인 후에만 실행)
  useEffect(() => {
    if (!isAdmin) return; // 권한 확인 전에는 리스너 미실행
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
  }, [isAdmin, selectedEventId]);

  // 2. 신청 내역 실시간 동기화 (isAdmin 확인 후에만 실행)
  useEffect(() => {
    if (!isAdmin || !selectedEventId) return;

    setIsDataLoading(true);
    const q = selectedEventId === 'all'
      ? query(collection(db, 'applications'), orderBy('appliedAt', 'desc'), limit(1000))
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
        try {
          const snaps = await Promise.all(
            missingUids.map(uid => getDoc(doc(db, 'users', uid)))
          );
          snaps.forEach((uSnap, index) => {
            if (uSnap.exists()) {
              newUserMap[missingUids[index]] = uSnap.data();
              updated = true;
            }
          });
        } catch (e) {
          console.error("Error batch-fetching user profiles:", e);
        }
      }

      if (updated) setUserMap(newUserMap);
      setIsDataLoading(false);
    }, (err) => {
      console.error('Error fetching applications:', err);
      setIsDataLoading(false);
    });

    return () => unsub();
  }, [isAdmin, selectedEventId]);

  // 필터 변경 시 다중 선택 상태 자동 초기화 (안전 장치)
  useEffect(() => {
    setSelectedAppIds([]);
  }, [selectedEventId, filterGender, searchQuery, dummyFilter, statusFilter, ageFilter, activeTab]);

  // 3. SMS 템플릿 로드 (isAdmin 확인 후에만 실행)
  useEffect(() => {
    if (!isAdmin) return;
    getDocs(collection(db, 'smsTemplates')).then(snap => {
      setSmsTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [isAdmin]);

  // 4. 매칭 요약 로드 (기수 선택 시)
  useEffect(() => {
    if (!selectedEventId || selectedEventId === 'all') {
      setMatchingSummary(null);
      return;
    }
    getDoc(doc(db, 'matchingSummaries', selectedEventId)).then(snap => {
      if (snap.exists() && snap.data()?.status === 'approved') {
        setMatchingSummary(snap.data());
      } else {
        setMatchingSummary(null);
      }
    }).catch(() => setMatchingSummary(null));
  }, [selectedEventId]);

  // status 변경 로직
  const updateAppStatus = async (app: any, status: string, customMessage?: string, updatedPrice?: number) => {
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
            customMessage: customMessage,
            price: updatedPrice
          })
        });

        const data = await res.json();
        if (data.isMock) {
          toast('로컬 환경에서는 선발 처리가 제한됩니다.', { icon: '🚧', duration: 4000 });
          return;
        }
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
        if (customMessage !== undefined) {
          // SMS 발송이 포함된 확정 처리 (SMSPreviewModal을 거친 경우)
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/admin/applications/confirm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              applicationId: appId,
              customMessage: customMessage,
              price: updatedPrice
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '처리 중 오류가 발생했습니다.');

          if (data.warning) {
            toast(data.warning, { icon: '⚠️', duration: 4000 });
          } else {
            toast.success('참가 확정 및 안내 문자 발송 완료');
          }
        } else {
          if (prevStatus === 'cancelled') {
            await restoreApplicant(appId, sessionId, gender);
          } else {
            await confirmPayment(appId, sessionId, gender);
          }
          toast.success('참가 확정 완료');
        }
      } else if (status === 'cancelled') {
        await cancelApplicant(appId, sessionId, gender, prevStatus === 'confirmed');
        toast.success('삭제 완료');
      }

    } catch (e: any) {
      console.error(e);
      const msg = e.message || '';
      if (msg.includes('[로컬 환경]')) {
        toast('로컬 환경에서는 실제 처리가 제한됩니다.', { icon: '🚧', duration: 4000 });
      } else {
        toast.error(msg || '상태 업데이트에 실패했습니다.');
      }
    }
  };

  const handleOpenPreview = (app: any, type: 'select' | 'confirm' | 're-request' = 'select') => {
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

    const genderPrice = app.gender === 'male'
      ? (app.maleOption === 'safe' ? 60000 : (session.malePrice || 49000))
      : (app.femaleOption === 'group' ? 24000 : (session.femalePrice || 29000));

    // 쿠폰 할인 로직: couponDiscount 필드 기반 최종 금액과 할인 사유 계산
    const finalPrice = app.price ?? genderPrice;
    const couponDiscount = app.couponDiscount && app.couponDiscount > 0 ? app.couponDiscount : 0;
    const isGroupDiscount = app.gender === 'female' && app.femaleOption === 'group';
    const discountSuffix = couponDiscount > 0
      ? ` (할인쿠폰 적용, ${couponDiscount.toLocaleString('ko-KR')}원 할인)`
      : (isGroupDiscount ? ' (동반할인 적용)' : '');
    const priceWithDiscount = `${finalPrice.toLocaleString('ko-KR')}원${discountSuffix}`;

    // v8.12.3: 저장된 템플릿 자동 적용 (v8.13.2: 타입에 따라 분기)
    const templateName = type === 'confirm' ? '참가 확정 안내' : (type === 're-request' ? '입금 재요청' : '입금 요청 (기본)');
    const targetTemplate = smsTemplates.find(t => t.name === templateName);
    let defaultMsg = '';

    if (targetTemplate) {
      const sessionName = session.episodeNumber
        ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`
        : '';

      const openChatLink = session.openChatLink || '';
      defaultMsg = targetTemplate.content
        .replace(/{{이름}}/g, user.name || app.name || '참가자')
        .replace(/{{날짜}}/g, fDate)
        .replace(/{{요일}}/g, getPart('weekday') || '')
        .replace(/{{시간}}/g, fTime)
        .replace(/{{금액}}원/g, priceWithDiscount)
        .replace(/{{금액}}/g, priceWithDiscount)
        .replace(/{{기수}}/g, sessionName)
        .replace(/{{장소}}/g, session.venue || session.location || '')
        .replace(/{{오픈채팅링크}}/g, openChatLink);

      // v9.1.0: 하드코딩된 구버전 124기 링크가 들어있을 경우에도 신규 링크로 스마트 대체
      if (openChatLink) {
        defaultMsg = defaultMsg.replace(/https:\/\/open\.kakao\.com\/o\/gi30oUui/g, openChatLink);
      }
    } else if (type === 'confirm') {
      const location = session.venue || session.location || '부산진구 중앙대로 763-1 데일리팡 4층 [모노리 파티룸]';
      defaultMsg = `[키링크] 안녕하세요, ${user.name || '참가자'}님! 키링크입니다.
입금이 확인되어 참가가 최종 확정되었습니다.

일시: ${fDate} ${fDay} ${fTime} (약 2시간 소요)
장소: ${location}
준비물: 신분증 및 소개팅에 맞는 복장

당일 현장에서 뵙겠습니다! 감사합니다 :)`;
    } else if (type === 're-request') {
      defaultMsg = `안녕하세요 ${user.name || '참가자'}님, 키링크입니다 :)
${fDate} (${getPart('weekday') || ''}) 소개팅 입금 안내드렸으나 아직 확인이 되지 않아 다시 연락드렸습니다 !

참여 확정을 위해 ${priceWithDiscount} 입금 부탁드리며, 입금이 어려우시거나 늦어지시는 경우 꼭 말씀 부탁드립니다😭
입금순으로 마감되다보니 회신이 없으시면 기회가 다른 분께 넘어갈 수 있습니다 :(

3333359229548 카카오뱅크 태영훈(키링크)
항상 감사합니다 ! 좋은 하루 되세요🥰`;
    } else {
      defaultMsg = `안녕하세요 ! 키링크에 지원해주셔서 감사합니다☺️
${user.name || '참가자'}님은 ${fDate} ${fDay} ${fTime} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 ${priceWithDiscount} 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요😭
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요🥰`;
    }

    const is100PercentDiscount = finalPrice === 0;
    setPreviewData({ 
      app, 
      session, 
      defaultMsg, 
      targetStatus: type === 'confirm' ? 'confirmed' : 'selected',
      autoSelectTemplateName: is100PercentDiscount && type !== 'confirm' ? '선발 (100% 할인/보증금)' : undefined
    });
    setPreviewModalOpen(true);
  };

  const handleChangeSession = async () => {
    if (!changeSessionApp || !targetSessionId) return;
    
    setIsDataLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch('/api/admin/applications/change-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          applicationId: changeSessionApp.id,
          targetSessionId: targetSessionId
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '기수 변경 중 오류가 발생했습니다.');
      
      toast.success('기수 변경이 성공적으로 완료되었습니다.');
      setChangeSessionModalOpen(false);
      setChangeSessionApp(null);
      setTargetSessionId('');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || '기수 변경 중 오류가 발생했습니다.');
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleSendGeneralSms = async (message: string) => {
    if (!generalSmsTarget) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const user = userMap[generalSmsTarget.userId] || {};
      const res = await fetch('/api/admin/sms/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targets: [{
            phone: user.phone || generalSmsTarget.phone,
            name: user.name || generalSmsTarget.name,
            gender: generalSmsTarget.gender || user.gender,
            userId: generalSmsTarget.userId
          }],
          message
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발송 실패');

      toast.success(`${user.name || generalSmsTarget.name}님께 문자를 발송했습니다.`);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };


  const handleSeedDummyAccounts = async () => {
    if (!selectedEventId || selectedEventId === 'all') {
      toast.error('먼저 특정 기수를 선택해주세요 (예: 1007기)');
      return;
    }

    const countStr = window.prompt('추가할 남녀 각각의 더미 인원수를 입력하세요 (예: 8을 입력하면 남8, 여8 추가됨)', '8');
    if (!countStr) return;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0 || count > 50) {
      toast.error('올바른 숫자를 입력해주세요 (1~50)');
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('로그인이 필요합니다.');

      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId: selectedEventId, count })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '처리 중 오류가 발생했습니다.');

      toast.success(`더미 계정 총 ${count * 2}명(남${count}, 여${count}) 추가 완료!`);
    } catch (e: any) {
      console.error(e);
      toast.error(`더미 추가 실패: ${e.message || '알 수 없는 오류'}`);
    }
  };

  const activeEvent = events.find(e => e.id === selectedEventId);

  // \ud589\uc0ac \uc885\ub8cc \uc5ec\ubd80 \ud310\ub2e8 (\ucefb\ud50c\ub9ac\ub3c4 \uc218 \uc788\ub294 \uae30\uc900)
  const isSessionEnded = useMemo(() => {
    if (!activeEvent) return false;
    if (activeEvent.status === 'completed') return true;
    const eventDate = activeEvent.eventDate?.toDate?.() || new Date();
    return new Date() >= new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  }, [activeEvent]);

  // \ud589\uc0ac \ud6c4 \uacb0\uacfc \uc9d1\uacc4 (matchingSummary \uae30\ubc18)
  const postEventStats = useMemo(() => {
    if (!matchingSummary) return null;
    const matchedUserIds = new Set<string>(
      (matchingSummary.matchedPairs || []).flatMap((p: any) => [p.userAId, p.userBId])
    );
    const confirmedApps = applications.filter((a: any) => a.status === 'confirmed');
    const attendedCount = confirmedApps.filter((a: any) => a.attended === true).length;
    const noShowCount = confirmedApps.filter((a: any) => a.attended === false).length;
    return {
      matchedCount: matchedUserIds.size,
      attendedCount,
      noShowCount,
      matchedUserIds,
      unmatchedUserIds: new Set<string>(matchingSummary.unmatchedUserIds || []),
    };
  }, [matchingSummary, applications]);

  // \ub178\uc1fc \ucc98\ub9ac \ud578\ub4e4\ub7ec
  const handleMarkNoShow = async (app: any) => {
    if (!window.confirm(`${userMap[app.userId]?.name || app.name}님을 노쇼 처리하시겠습니까?\n(출석 체크가 false로 설정되고, 회원의 노쇼 횟수가 +1 증가합니다.)`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      // application의 attended를 false로
      await updateDoc(doc(db, 'applications', app.id), { attended: false });
      // users의 noShowCount 증가
      if (app.userId && !app.userId.startsWith('user_m_') && !app.userId.startsWith('user_f_')) {
        await updateDoc(doc(db, 'users', app.userId), { noShowCount: increment(1) });
      }
      toast.success(`${userMap[app.userId]?.name || app.name}님이 노쇼 처리되었습니다.`);
    } catch (e: any) {
      console.error(e);
      toast.error('노쇼 처리에 실패했습니다.');
    }
  };

  const handleUnmarkNoShow = async (app: any) => {
    if (!window.confirm(`${userMap[app.userId]?.name || app.name}님의 노쇼 처리를 취소하시겠습니까?\n(출석 체크가 복원되고, 회원의 노쇼 횟수가 -1 감소합니다.)`)) return;
    try {
      await updateDoc(doc(db, 'applications', app.id), {
        attended: deleteField(),
        attendanceStatus: deleteField(),
      });
      if (app.userId && !app.userId.startsWith('user_m_') && !app.userId.startsWith('user_f_')) {
        const userRef = doc(db, 'users', app.userId);
        const userSnap = await getDoc(userRef);
        const currentCount = userSnap.data()?.noShowCount || 0;
        await updateDoc(userRef, { noShowCount: Math.max(0, currentCount - 1) });
      }
      toast.success(`${userMap[app.userId]?.name || app.name}님의 노쇼 처리가 취소되었습니다.`);
    } catch (e: any) {
      console.error(e);
      toast.error('노쇼 취소에 실패했습니다.');
    }
  };

  // 다중 선택된 신청서 일괄 삭제 처리 핸들러
  const handleBulkDelete = async () => {
    if (selectedAppIds.length === 0) return;
    
    // 더미 계정이 포함되었는지 확인하여 맞춤 메시지 제공
    const dummyCount = selectedAppIds.filter(id => {
      const app = applications.find(a => a.id === id);
      const user = userMap[app?.userId || ''] || {};
      return id?.startsWith('dummy') || app?.userId?.startsWith('user_m_') || app?.userId?.startsWith('user_f_') || user.isDummy === true;
    }).length;

    const actualCount = selectedAppIds.length - dummyCount;
    const confirmMessage = actualCount > 0
      ? `선택한 ${selectedAppIds.length}개의 신청서(실제 회원 ${actualCount}명, 더미 ${dummyCount}개)를 정말 삭제하시겠습니까?\n(참가 취소 및 삭제 처리가 일괄 진행됩니다.)`
      : `선택한 ${selectedAppIds.length}개의 더미 신청서를 정말 일괄 삭제하시겠습니까?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDataLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // 데이터베이스 동시성 및 트랜잭션 락 충돌 방지를 위해 순차적(sequential) 처리
      for (const appId of selectedAppIds) {
        const app = applications.find(a => a.id === appId);
        if (!app) continue;
        try {
          await cancelApplicant(app.id, app.sessionId, app.gender, app.status === 'confirmed');
          successCount++;
        } catch (err) {
          console.error(`Failed to delete application ${appId}:`, err);
          failCount++;
        }
      }

      if (failCount === 0) {
        toast.success(`선택한 ${successCount}개의 신청서가 성공적으로 일괄 삭제되었습니다.`);
      } else {
        toast.success(`${successCount}개 삭제 완료, ${failCount}개 실패`);
      }
      setSelectedAppIds([]);
    } catch (e: any) {
      console.error('Bulk delete error:', e);
      toast.error('일괄 삭제 중 예기치 못한 오류가 발생했습니다.');
    } finally {
      setIsDataLoading(false);
    }
  };

  // v11.1.0: 공통 필터링 (탭, 더미, 종료기수) - 통계와 리스트에 모두 적용
  const baseFiltered = useMemo(() => {
    return applications.filter(app => {
      // 1. 탭 필터링
      if (activeTab === 'group' && app.sessionType === '1on1') return false;
      if (activeTab === '1on1' && app.sessionType !== '1on1') return false;

      const user = userMap[app.userId] || {};
      // 1.5. 닼템 제외 (신청 관리 목록에서는 명시적 닼템만 숨김, 관리자 테스트 용도로 super_admin은 노출)
      const isDarkTemplar = app.isDarkTemplar === true;
      if (isDarkTemplar) return false;

      // 2. 더미 계정 필터링
      const isDummy = app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true;
      if (dummyFilter === 'exclude' && isDummy) return false;
      if (dummyFilter === 'only' && !isDummy) return false;

      // 3. 전체 기수 보기 상태에서 종료된 행사 신청자 숨김
      let matchesSessionEnded = true;
      if (selectedEventId === 'all') {
        const session = events.find(e => e.id === app.sessionId);
        if (session) {
          const now = new Date();
          let eventDate = new Date();
          if (session.eventDate) {
            eventDate = typeof session.eventDate.toDate === 'function' ? session.eventDate.toDate() : new Date(session.eventDate);
          }
          const isEnded = session.status === 'completed' || session.isForceHidden || now >= new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
          if (isEnded) matchesSessionEnded = false;
        } else {
          matchesSessionEnded = false; // 삭제되거나 존재하지 않는 기수도 숨김
        }
      }

      return matchesSessionEnded;
    });
  }, [applications, activeTab, dummyFilter, selectedEventId, events, userMap]);

  // v8.1.7: 실시간 선발 현황 계산 (confirmed only, excluding selected/waiting)
  const selectionStats = useMemo(() => {
    if (selectedEventId === 'all') return { male: 0, female: 0 };
    const male = baseFiltered.filter(a => a.gender === 'male' && a.status === 'confirmed').length;
    const female = baseFiltered.filter(a => a.gender === 'female' && a.status === 'confirmed').length;
    return { male, female };
  }, [baseFiltered, selectedEventId]);

  const isMaleFull = selectionStats.male >= (activeEvent?.maxMale || 8);
  const isFemaleFull = selectionStats.female >= (activeEvent?.maxFemale || 8);

  // v8.1.7: 정원을 초과한 확정자 색출 (오래된 순으로 선발했다고 가정할 때, 가장 최근에 신청/확정된 사람을 초과 인원으로 간주)
  const overQuotaAppIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedEventId === 'all' || !activeEvent) return ids;

    // 적용 순(또는 변경 순) 정렬: 가장 먼저 확정된 사람이 정원 내, 늦게 확정된 사람이 초과
    const getSortedSelected = (gender: string) =>
      baseFiltered
        .filter(a => a.gender === gender && a.status === 'confirmed')
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
  }, [baseFiltered, activeEvent, selectedEventId]);

  // v12.0.0: 전체, 남성, 여성 성별 수 계산 (성별 필터를 제외한 다른 모든 필터 적용 상태 기준)
  const genderCounts = useMemo(() => {
    const counts = { all: 0, male: 0, female: 0 };
    baseFiltered.forEach(app => {
      const user = userMap[app.userId] || {};
      const normalizedQuery = searchQuery.replace(/[^0-9]/g, '');
      const userPhoneDigits = (user.phone || '').replace(/[^0-9]/g, '');

      const q = searchQuery.trim();
      const qLower = q.toLowerCase();
      const matchesSearch =
        !q ||
        chosungIncludes(user.name, q) ||
        (user.workplace || user.job || '').toLowerCase().includes(qLower) ||
        (user.residence || user.location || '').toLowerCase().includes(qLower) ||
        (normalizedQuery !== '' && userPhoneDigits.includes(normalizedQuery));

      // 나이대 필터링
      let matchesAge = true;
      if (ageFilter !== 'all') {
        const birthYear = user.birthDate ? parseInt(user.birthDate.includes('-') ? user.birthDate.slice(0, 4) : (user.birthDate.length === 6 ? '19' + user.birthDate.slice(0, 2) : user.birthDate.slice(0, 4))) : 0;
        if (ageFilter === '90s') matchesAge = birthYear >= 1990 && birthYear <= 1999;
        else if (ageFilter === '80s') matchesAge = birthYear >= 1980 && birthYear <= 1989;
        else if (ageFilter === '00s') matchesAge = birthYear >= 2000 && birthYear <= 2009;
      }

      // 상태 필터링
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

      if (matchesSearch && matchesAge && matchesStatus) {
        counts.all++;
        if (app.gender === 'male') {
          counts.male++;
        } else if (app.gender === 'female') {
          counts.female++;
        }
      }
    });
    return counts;
  }, [baseFiltered, userMap, searchQuery, ageFilter, statusFilter]);

  const filtered = useMemo(() => {
    let result = baseFiltered.filter(app => {
      const user = userMap[app.userId] || {};
      const normalizedQuery = searchQuery.replace(/[^0-9]/g, '');
      const userPhoneDigits = (user.phone || '').replace(/[^0-9]/g, '');

      const q = searchQuery.trim();
      const qLower = q.toLowerCase();
      const matchesSearch =
        !q ||
        chosungIncludes(user.name, q) ||
        (user.workplace || user.job || '').toLowerCase().includes(qLower) ||
        (user.residence || user.location || '').toLowerCase().includes(qLower) ||
        (normalizedQuery !== '' && userPhoneDigits.includes(normalizedQuery));
      const matchesGender = filterGender === 'all' || app.gender === filterGender;

      // v8.4.1: 나이 대별 필터링
      let matchesAge = true;
      if (ageFilter !== 'all') {
        const birthYear = user.birthDate ? parseInt(user.birthDate.includes('-') ? user.birthDate.slice(0, 4) : (user.birthDate.length === 6 ? '19' + user.birthDate.slice(0, 2) : user.birthDate.slice(0, 4))) : 0;
        if (ageFilter === '90s') matchesAge = birthYear >= 1990 && birthYear <= 1999;
        else if (ageFilter === '80s') matchesAge = birthYear >= 1980 && birthYear <= 1989;
        else if (ageFilter === '00s') matchesAge = birthYear >= 2000 && birthYear <= 2009;
      }

      // v8.4.1: 상태 필터링
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

      return matchesSearch && matchesGender && matchesAge && matchesStatus;
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
  }, [baseFiltered, userMap, searchQuery, filterGender, ageFilter, statusFilter, sortConfig]);

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">신청 관리</h1>
        <p className="text-slate-400 text-sm font-bold">참가 신청 및 선발 현황을 관리합니다.</p>
      </div>

      {/* v8.12.7: 그룹 매칭 / 1:1 매칭 탭 UI */}
      <div className="flex gap-2 md:gap-4 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('group')}
          className={`pb-3 px-2 md:px-4 font-black text-[0.95rem] md:text-[1.1rem] transition-colors border-b-2 whitespace-nowrap ${activeTab === 'group' ? 'border-[#FF7E7E] text-[#FF7E7E]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          로테이션 신청 관리
        </button>
        <button
          onClick={() => setActiveTab('1on1')}
          className={`pb-3 px-2 md:px-4 font-black text-[0.95rem] md:text-[1.1rem] transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === '1on1' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          1:1 신청자 관리 <span className="text-[0.6rem] md:text-[0.65rem] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mb-1">NEW</span>
        </button>
      </div>

      {activeTab === 'group' ? (
        <>
          {/* Top Controls Bar (Integrated Header & Filters) */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {/* Left: Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: 'all', label: `전체 (${genderCounts.all})` },
                  { id: 'male', label: `남성 (${genderCounts.male})` },
                  { id: 'female', label: `여성 (${genderCounts.female})` }
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

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: 'exclude', label: '실제회원' },
                  { id: 'only', label: '더미만' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDummyFilter(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dummyFilter === t.id ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStatusFilter(statusFilter === 'selected' ? 'all' : 'selected')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${statusFilter === 'selected' ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-[#7C3AED]/30'}`}
                style={{ height: '40px' }}
              >
                입금대기
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'applied' ? 'all' : 'applied')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${statusFilter === 'applied' ? 'bg-[#FF7E7E] text-white border-[#FF7E7E] shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-[#FF7E7E]/30'}`}
                style={{ height: '40px' }}
              >
                미선발
              </button>
            </div>

            {/* Center: Search */}
            <div className="relative flex-1 max-w-md group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search size={16} className="text-slate-400 group-focus-within:text-[#FF7E7E] transition-colors" />
              </div>
              <input
                type="text"
                placeholder="이름, 직업, 거주지, 연락처로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl pr-10 text-sm font-bold text-slate-800 outline-none focus:border-[#FF7E7E]/30 focus:bg-slate-50/30 transition-all shadow-sm"
                style={{ height: '40px', paddingLeft: '44px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* 기수 선택 커스텀 드롭다운 */}
              <SessionDropdown
                events={events}
                selectedEventId={selectedEventId}
                setSelectedEventId={setSelectedEventId}
              />
              {isSuperAdmin && selectedAppIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-all shadow-sm animate-in fade-in zoom-in-95 duration-200"
                  style={{ height: '36px', padding: '0 10px', fontSize: '0.65rem', fontWeight: 700 }}
                >
                  <Trash2 size={12} />
                  <span>선택 삭제</span>
                  <span className="bg-rose-200 text-rose-800 rounded-full px-1.5 py-0.2 text-[0.6rem] font-black">{selectedAppIds.length}</span>
                </button>
              )}
              <button
                onClick={handleSeedDummyAccounts}
                className="flex items-center gap-1.5 rounded-lg transition-all hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600" 
                style={{ height: '36px', padding: '0 10px', fontSize: '0.65rem', background: '#fff', fontWeight: 700 }}
              >
                <Users size={12} /> <span className="hidden sm:inline">더미</span> 추가
              </button>
              <button className="flex items-center gap-1.5 rounded-lg transition-all hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600" 
                style={{ height: '36px', padding: '0 10px', fontSize: '0.65rem', background: '#fff', fontWeight: 700 }}
              >
                <Download size={12} /> <span className="hidden sm:inline">엑셀</span>
              </button>
            </div>
          </div>

          {/* Summary Info Header */}
          {activeEvent && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '전체 신청', value: baseFiltered.length, icon: Users, color: '#FF6F61' },
                { label: '입금 대기', value: baseFiltered.filter((a: any) => a.status === 'selected').length, icon: CreditCard, color: '#a78bfa' },
                { label: '참가 확정', value: baseFiltered.filter((a: any) => a.status === 'confirmed').length, icon: CheckCircle, color: '#4ade80' },
                {
                  label: '정원 현황',
                  value: (
                    <span className={selectionStats.male + selectionStats.female > (activeEvent.maxMale || 0) + (activeEvent.maxFemale || 0) ? 'text-rose-500 animate-pulse font-black inline-block' : ''}>
                      {selectionStats.male + selectionStats.female} / {(activeEvent.maxMale || 0) + (activeEvent.maxFemale || 0)}
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
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 행사 후 결과 카드 (종료 기수 + 매칭 결과 승인 시) */}
          {activeEvent && isSessionEnded && postEventStats && (
            <div className="grid grid-cols-3 gap-3">
              <div style={{ ...panel, padding: '16px 20px' }} className="flex items-center justify-between bg-gradient-to-br from-pink-50 to-rose-50 border-pink-100">
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>매칭 성공</p>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ec4899', marginTop: 2 }}>{postEventStats.matchedCount}명</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-pink-100">
                  <Heart size={18} className="text-pink-500" fill="#ec4899" />
                </div>
              </div>
              <div style={{ ...panel, padding: '16px 20px' }} className="flex items-center justify-between bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100">
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>참여 완료</p>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>{postEventStats.attendedCount}명</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100">
                  <CheckCircle size={18} className="text-emerald-500" />
                </div>
              </div>
              <div style={{ ...panel, padding: '16px 20px' }} className="flex items-center justify-between bg-gradient-to-br from-rose-50 to-red-50 border-rose-100">
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>노쇼</p>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', marginTop: 2 }}>{postEventStats.noShowCount}명</div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100">
                  <UserX size={18} className="text-rose-500" />
                </div>
              </div>
            </div>
          )}


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
          <div className="hidden md:block mx-auto w-full h-fit" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="overflow-auto h-fit max-h-[calc(100vh-140px)]">
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead className="hidden md:table-header-group sticky top-0 z-20" style={{ background: '#F8FAFC' }}>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    {/* 선택 체크박스 */}
                    <th style={{ padding: '14px 10px', textAlign: 'center', width: '45px' }}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#FF7E7E] focus:ring-[#FF7E7E] cursor-pointer"
                        checked={filtered.length > 0 && selectedAppIds.length === filtered.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAppIds(filtered.map(app => app.id));
                          } else {
                            setSelectedAppIds([]);
                          }
                        }}
                      />
                    </th>
                    {/* 신청 기수 */}
                    <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>
                      신청 기수
                    </th>
                    {/* 신청자 정보 (프로필 + 이름 + 나이) */}
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>
                      신청자 정보
                    </th>
                    <th style={{ padding: '14px 10px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>직업</th>
                    <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>거주지</th>
                    <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>상태</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>선발 관리</th>
                    {isSuperAdmin && <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8' }}>삭제</th>}
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading ? (
                    [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', height: '88px' }}>
                        <td colSpan={8} style={{ padding: '0 20px' }}><Skeleton className="h-10 w-full" /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '100px 20px', textAlign: 'center', color: '#555' }}>
                        <div className="flex flex-col items-center gap-4">
                          <FileText size={48} className="opacity-10 text-slate-400" />
                          <p style={{ fontSize: '0.9rem', color: '#64748B' }}>검색 결과와 일치하는 신청 내역이 없습니다.</p>
                          {(filterGender !== 'all' || statusFilter !== 'all' || searchQuery) && (
                            <button onClick={() => { setFilterGender('all'); setStatusFilter('all'); setSearchQuery(''); }} className="text-[#FF6F61] text-xs font-bold underline">필터 초기화</button>
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
                      const isOverQuota = overQuotaAppIds.has(app.id);
                      const isDummy = app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true;

                      // v8.13.5: 연령대 미일치 여부 계산
                      const targetAgeRange = app.gender === 'male' ? event?.targetMaleAge : event?.targetFemaleAge;
                      const userBirthDate = user.birthDate || app.birthDate || '';
                      
                      let isAgeMismatch = false;
                      if (app.gender === 'male' && targetAgeRange && userBirthDate) {
                        const birthYearMatch = userBirthDate.match(/(\d{2,4})/);
                        const rangeMatch = targetAgeRange.match(/(\d{2})~(\d{2})/);
                        
                        if (birthYearMatch && rangeMatch) {
                          let birthYear = parseInt(birthYearMatch[1]);
                          if (birthYear > 1900) birthYear = birthYear % 100;
                          
                          const startYear = parseInt(rangeMatch[1]);
                          const endYear = parseInt(rangeMatch[2]);
                          
                          const fullBirth = birthYear < 40 ? 2000 + birthYear : 1900 + birthYear;
                          const fullStart = startYear < 40 ? 2000 + startYear : 1900 + startYear;
                          const fullEnd = endYear < 40 ? 2000 + endYear : 1900 + endYear;
                          
                          const minYear = Math.min(fullStart, fullEnd);
                          const maxYear = Math.max(fullStart, fullEnd);
                          
                          if (fullBirth < minYear || fullBirth > maxYear) {
                            isAgeMismatch = true;
                          }
                        }
                      }

                      return (
                        <Fragment key={app.id}>
                          {/* Desktop View: Table Row */}
                          <tr
                            className="hidden md:table-row hover:bg-slate-50 transition-colors"
                            style={{
                              borderBottom: '1px solid #f0f0f0',
                              height: '88px',
                              background: isOverQuota ? '#FFE4E6' : ((canSelect && isFull) ? '#FFF1F2' : 'transparent')
                            }}
                          >
                            {/* 선택 체크박스 */}
                            <td style={{ padding: '0 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-[#FF7E7E] focus:ring-[#FF7E7E] cursor-pointer"
                                checked={selectedAppIds.includes(app.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAppIds(prev => [...prev, app.id]);
                                  } else {
                                    setSelectedAppIds(prev => prev.filter(id => id !== app.id));
                                  }
                                }}
                              />
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'center' }}>
                              <div className="flex flex-col items-center">
                                <p className="text-[0.85rem] font-black text-slate-800 tracking-tighter whitespace-nowrap">{regionName} {event?.episodeNumber || '??'}기</p>
                                <p className="text-[0.65rem] font-bold text-[#FF7E7E] mt-1">{eventDateLabel}</p>
                              </div>
                            </td>

                            <td style={{ padding: '0 20px' }}>
                              <div className="flex items-center gap-4">
                                <div
                                  className="w-14 h-14 rounded-full border-2 border-[#D4AF37] shadow-sm flex items-center justify-center overflow-hidden bg-slate-100 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                  style={{ boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)' }}
                                  onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                                >
                                  {(() => {
                                    if ((user.name || app.name) === '채현준') {
                                      return <img src="/temp_chae.jpg" className="w-full h-full object-cover" />;
                                    }
                                    const thumbUrl = [user.photos, app.photos].flatMap(p => Array.isArray(p) ? p : []).filter(u => u && u !== 'null' && u !== 'undefined').find(Boolean)
                                      || user.photoUrl || user.photoURL || app.photoUrl;
                                    return thumbUrl
                                      ? <img src={thumbUrl} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                                      : <span className="text-xs font-bold text-[#D4AF37]">{(user.name || app.name)?.[0] || 'U'}</span>;
                                  })()}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                                      className={`text-[1rem] font-black transition-colors ${app.attended === false && app.status === 'confirmed' ? 'text-rose-600 hover:text-rose-800' : 'text-slate-800 hover:text-[#FF7E7E]'}`}
                                    >
                                      {user.name || app.name}
                                    </button>
                                    <span className={`text-[0.65rem] font-bold px-1.5 py-0.5 rounded ${(user.gender || app.gender) === 'male' ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
                                      {(user.gender || app.gender) === 'male' ? '남성' : '여성'}
                                    </span>
                                    {isDummy && (
                                      <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 shadow-sm whitespace-nowrap">
                                        더미
                                      </span>
                                    )}
                                    {/* 행사 후 결과 뱃지 */}
                                    {postEventStats?.matchedUserIds.has(app.userId) && (
                                      <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600 border border-pink-200 flex items-center gap-0.5 whitespace-nowrap">
                                        <Heart size={8} fill="#ec4899" /> 매칭성공
                                      </span>
                                    )}
                                    {postEventStats && postEventStats.unmatchedUserIds.has(app.userId) && (
                                      <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                                        미매칭
                                      </span>
                                    )}
                                    {app.attended === true && (
                                      <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center gap-0.5 whitespace-nowrap">
                                        ✅ 참여완료
                                      </span>
                                    )}
                                    {app.attended === false && app.status === 'confirmed' && (
                                      <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200 flex items-center gap-0.5 whitespace-nowrap animate-pulse">
                                        🚫 노쇼
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {(() => { const bd = user.birthDate || app.birthDate; return bd ? <span className="text-[0.85rem] font-bold text-slate-600">{bd.includes('-') ? bd.split('-')[0].slice(-2) : (bd.length === 8 ? bd.slice(2, 4) : bd.slice(0, 2))}년생</span> : <span className="text-[0.85rem] text-slate-400">??</span>; })()}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '0 16px' }}>
                              <div className="flex flex-col">
                                <p className={`text-[0.85rem] font-bold tracking-tight whitespace-nowrap ${(user.admin_job || user.job || app.job) ? 'text-slate-800' : 'text-slate-400'}`}>
                                  {user.admin_job || (user.job && user.job !== '-' ? user.job : null) || user.workplace?.split(',')[0] || app.job || <span className="font-normal">-</span>}
                                </p>
                                <span className="text-[0.72rem] text-slate-400">{user.company || ''}</span>
                              </div>
                            </td>

                            <td style={{ padding: '0 16px', textAlign: 'center' }}>
                              <p className="text-[0.85rem] font-bold text-slate-700 whitespace-nowrap">{app.residence || user.residence || user.location || '-'}</p>
                            </td>

                            <td style={{ padding: '0 16px', textAlign: 'center' }}>
                              <div className="flex flex-col items-center gap-1">
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 900,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  color: aStatus.color,
                                  background: aStatus.bg,
                                  border: `1px solid ${aStatus.color}20`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {aStatus.label}
                                </span>
                                {isAgeMismatch && (app.status === 'applied' || app.status === 'held') && (
                                  <div className="flex items-center gap-1 text-[0.6rem] font-black text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-pulse">
                                    <Info size={10} /> 연령대 부적합
                                  </div>
                                )}
                                {(() => {
                                  const gp = app.gender === 'male'
                                    ? (app.maleOption === 'safe' ? 60000 : (events.find(e => e.id === app.sessionId)?.malePrice || 49000))
                                    : (app.femaleOption === 'group' ? (events.find(e => e.id === app.sessionId)?.femaleGroupPrice || 24000) : (events.find(e => e.id === app.sessionId)?.femalePrice || 29000));
                                  const cd = app.couponDiscount && app.couponDiscount > 0 ? app.couponDiscount : 0;
                                  const fp = app.price ?? gp;
                                  const origPrice = cd > 0 ? fp + cd : null;
                                  return cd > 0 ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[0.6rem] text-slate-400 line-through">{origPrice!.toLocaleString('ko-KR')}원</span>
                                      <span className="text-[0.65rem] font-black text-emerald-600">{fp.toLocaleString('ko-KR')}원</span>
                                      <span className="text-[0.5rem] font-bold text-purple-500 bg-purple-50 px-1 rounded whitespace-nowrap">할인쿠폰 적용</span>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </td>

                            <td style={{ padding: '0 16px' }}>
                              <div className="relative flex items-center justify-center gap-1.5 transition-all">
                                <button
                                  onClick={() => setGeneralSmsTarget(app)}
                                  className="flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-all shrink-0 animate-in fade-in"
                                  style={{ width: 32, height: 32 }}
                                  title="문자 발송"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                {/* 노쇼 처리 버튼 (종료 기수 + confirmed + attended가 false가 아닌 경우만) */}
                                {isSessionEnded && app.status === 'confirmed' && app.attended !== false && (
                                  <button
                                    onClick={() => handleMarkNoShow(app)}
                                    className="flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-100 transition-all shrink-0"
                                    style={{ width: 32, height: 32 }}
                                    title="노쇼 처리"
                                  >
                                    <UserX size={14} />
                                  </button>
                                )}
                                {/* 노쇼 취소 버튼 */}
                                {isSessionEnded && app.status === 'confirmed' && app.attended === false && (
                                  <button
                                    onClick={() => handleUnmarkNoShow(app)}
                                    className="flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-all shrink-0"
                                    style={{ width: 32, height: 32 }}
                                    title="노쇼 취소"
                                  >
                                    <UserCheck size={14} />
                                  </button>
                                )}
                                {(app.status === 'applied' || app.status === 'held' || app.status === 'selected') && (() => {
                                  const handleSelection = async () => {
                                    if (!user.isJobReviewed) return toast.error('먼저 회원 관리에서 직업 정보를 확인하고 승인(Job Reviewed)해 주세요.');
                                    if (isOverQuota) {
                                      if (!confirm(`현재 신청기수(${regionName} ${event?.episodeNumber}기)의 ${app.gender === 'male' ? '남성' : '여성'} 정원이 이미 가득 찼습니다. 그래도 선발하시겠습니까?`)) return;
                                    }
                                    handleOpenPreview(app);
                                  };

                                  return (
                                    <>
                                      <button
                                        onClick={async () => {
                                          if (app.status === 'selected') {
                                            if (isOverQuota && !confirm('정원이 가득 찬 상태입니다. 그래도 입금 확인 처리를 진행하시겠습니까?')) return;
                                            handleOpenPreview(app, 'confirm');
                                          } else {
                                            handleSelection();
                                          }
                                        }}
                                        disabled={!user.isJobReviewed && !app.id.startsWith('dummy')}
                                        className={`px-3 py-2 rounded-xl text-[0.8rem] font-black transition-all whitespace-nowrap ${
                                          isOverQuota ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-[#FF6F61] text-white hover:bg-[#ff5a4a]'
                                        } shadow-md shadow-rose-100 disabled:opacity-50`}
                                      >
                                        {app.status === 'selected' ? '입금확인' : '선발'}
                                      </button>
                                      
                                      {app.status === 'selected' && (
                                        <>
                                          <button
                                          onClick={() => {
                                            if (app.isSmsSent) {
                                              if (!window.confirm('이미 문자를 보낸 유저입니다. 다시 보내시겠습니까?')) return;
                                            }
                                            handleOpenPreview(app, 're-request');
                                          }}
                                          className="px-3 py-2 bg-purple-500 text-white rounded-xl text-[0.8rem] font-black hover:bg-purple-600 shadow-md shadow-purple-100 transition-all whitespace-nowrap"
                                        >
                                          재요청
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm('선발(입금대기) 상태를 취소하고 다시 검토중 상태로 되돌리시겠습니까?')) {
                                              updateAppStatus(app, 'applied');
                                            }
                                          }}
                                          className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[0.8rem] font-black hover:bg-slate-200 transition-all ml-1 whitespace-nowrap"
                                        >
                                          되돌리기
                                        </button>
                                        </>
                                      )}
                                      
                                      {app.status !== 'selected' && (
                                        <>
                                          <button
                                            onClick={async () => {
                                              if (!user.isJobReviewed && !app.id.startsWith('dummy')) return toast.error('먼저 직업 승인을 해주세요.');
                                              if (isOverQuota && !confirm('정원이 가득 찼습니다. 확정하시겠습니까?')) return;
                                              if (window.confirm('문자 발송 없이 바로 선발확정 처리하시겠습니까?')) {
                                                updateAppStatus(app, 'confirmed');
                                              }
                                            }}
                                            className="px-3 py-2 bg-[#FFD700] text-[#7A5F00] rounded-xl text-[0.8rem] font-black hover:bg-[#F0C800] shadow-md shadow-yellow-100 transition-all"
                                          >
                                            확정
                                          </button>
                                          <button
                                            onClick={() => updateAppStatus(app, 'held')}
                                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[0.8rem] font-black hover:bg-slate-200 transition-all"
                                          >
                                            보류
                                          </button>
                                        </>
                                      )}
                                      
                                      <button
                                        onClick={() => { setChangeSessionApp(app); setChangeSessionModalOpen(true); }}
                                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[0.8rem] font-black hover:bg-blue-100 transition-all ml-1"
                                        title="기수 변경"
                                      >
                                        <Calendar size={14} />
                                      </button>
                                    </>
                                  );
                                })()}
                                {app.status === 'confirmed' && (
                                  <>
                                    <button
                                      onClick={() => updateAppStatus(app, 'held')}
                                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[0.85rem] font-black hover:bg-emerald-600 shadow-md shadow-emerald-100 transition-all"
                                    >
                                      확정취소
                                    </button>
                                    <button
                                      onClick={() => { setChangeSessionApp(app); setChangeSessionModalOpen(true); }}
                                      className="px-3 py-2 bg-blue-500 text-white rounded-xl text-[0.85rem] font-black hover:bg-blue-600 shadow-md shadow-blue-100 transition-all ml-1"
                                      title="기수 변경"
                                    >
                                      <Calendar size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>

                            {isSuperAdmin && (
                              <td style={{ padding: '0 10px', textAlign: 'center' }}>
                                <button 
                                  onClick={() => {
                                    if (window.confirm('정말 삭제하시겠습니까?')) {
                                      updateAppStatus(app, 'cancelled');
                                    }
                                  }} 
                                  className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>

                          {/* Mobile View: Card Row */}
                          <tr className="md:hidden">
                            <td colSpan={8} className="p-0 border-b border-slate-100">
                              <div className="p-4 bg-white hover:bg-slate-50 transition-colors flex items-start gap-3">
                                {/* 모바일 선택 체크박스 */}
                                <div className="pt-4 shrink-0">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-[#FF7E7E] focus:ring-[#FF7E7E] cursor-pointer"
                                    checked={selectedAppIds.includes(app.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedAppIds(prev => [...prev, app.id]);
                                      } else {
                                        setSelectedAppIds(prev => prev.filter(id => id !== app.id));
                                      }
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                    <div 
                                      className="w-14 h-14 rounded-full border-2 border-[#D4AF37] overflow-hidden bg-slate-100 shrink-0"
                                      onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                                    >
                                      {(() => {
                                        if ((user.name || app.name) === '채현준') {
                                          return <img src="/temp_chae.jpg" className="w-full h-full object-cover" />;
                                        }
                                        const thumbUrl = [user.photos, app.photos].flatMap(p => Array.isArray(p) ? p : []).filter(u => u && u !== 'null' && u !== 'undefined').find(Boolean)
                                          || user.photoUrl || user.photoURL || app.photoUrl;
                                        return thumbUrl
                                          ? <img src={thumbUrl} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                                          : <span className="text-xs font-bold text-[#D4AF37]">{(user.name || app.name)?.[0] || 'U'}</span>;
                                      })()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`font-black text-[1.1rem] ${app.attended === false && app.status === 'confirmed' ? 'text-rose-600' : 'text-slate-800'}`}>{user.name || app.name}</span>
                                        <span className={`text-[0.65rem] font-bold px-1.5 py-0.5 rounded ${(user.gender || app.gender) === 'male' ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
                                          {(user.gender || app.gender) === 'male' ? '남성' : '여성'}
                                        </span>
                                        {app.isSmsSent && (
                                          <span 
                                            className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-help flex items-center gap-1"
                                            title={`최근 발송: ${app.lastSmsSentAt?.toDate ? format(app.lastSmsSentAt.toDate(), 'MM/dd HH:mm') : '알 수 없음'}`}
                                          >
                                            <CheckCircle size={10} /> 요청완료
                                          </span>
                                        )}
                                        {postEventStats?.matchedUserIds.has(app.userId) && (
                                          <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600 border border-pink-200 flex items-center gap-0.5 whitespace-nowrap">
                                            <Heart size={8} fill="#ec4899" /> 매칭성공
                                          </span>
                                        )}
                                        {postEventStats && postEventStats.unmatchedUserIds.has(app.userId) && (
                                          <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                                            미매칭
                                          </span>
                                        )}
                                        {app.attended === true && (
                                          <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 whitespace-nowrap">
                                            ✅ 참여완료
                                          </span>
                                        )}
                                        {app.attended === false && app.status === 'confirmed' && (
                                          <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200 whitespace-nowrap animate-pulse">
                                            🚫 노쇼
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[0.75rem] text-slate-500 font-bold mt-0.5">
                                        {(() => { const bd = user.birthDate || app.birthDate; return bd ? <span>{bd.includes('-') ? bd.split('-')[0].slice(-2) : (bd.length === 8 ? bd.slice(2, 4) : bd.slice(0, 2))}년생</span> : <span>??</span>; })()}
                                        {' · '}{regionName} {event?.episodeNumber}기
                                      </div>
                                    </div>
                                  </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                      <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        color: aStatus.color,
                                        background: aStatus.bg,
                                      }}>
                                        {aStatus.label}
                                      </span>
                                      {isAgeMismatch && (app.status === 'applied' || app.status === 'held') && (
                                        <div className="flex items-center gap-1 text-[0.55rem] font-black text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-pulse">
                                          <Info size={10} /> 연령부적합
                                        </div>
                                      )}
                                      {isSuperAdmin && (
                                        <button 
                                          onClick={() => {
                                            if (window.confirm('정말 삭제하시겠습니까?')) {
                                              updateAppStatus(app, 'cancelled');
                                            }
                                          }}
                                          className="text-slate-300 hover:text-rose-500 mt-1"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">직업</p>
                                    <p className="text-sm font-bold text-slate-700 leading-tight">{user.admin_job || (user.job && user.job !== '-' ? user.job : null) || user.workplace?.split(',')[0] || app.job || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">거주지</p>
                                    <p className="text-sm font-bold text-slate-700 leading-tight">{app.residence || user.residence || user.location || '-'}</p>
                                  </div>
                                  {app.couponDiscount && app.couponDiscount > 0 ? (
                                    <div className="col-span-2">
                                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">금액 (할인쿠폰 적용)</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 line-through">{(app.price + app.couponDiscount).toLocaleString('ko-KR')}원</span>
                                        <span className="text-sm font-black text-emerald-600">{(app.price).toLocaleString('ko-KR')}원</span>
                                        <span className="text-[0.5rem] font-bold text-purple-500 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">-{app.couponDiscount.toLocaleString('ko-KR')}원</span>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>



                                <div className="flex gap-1.5">
                                   <button
                                     onClick={() => setGeneralSmsTarget(app)}
                                     className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl flex items-center justify-center font-black text-xs active:scale-95 transition-all shrink-0 animate-in fade-in"
                                     title="문자 발송"
                                   >
                                     <MessageSquare size={16} />
                                   </button>
                                   {isSessionEnded && app.status === 'confirmed' && app.attended !== false && (
                                     <button
                                       onClick={() => handleMarkNoShow(app)}
                                       className="w-10 h-10 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0"
                                       title="노쇼 처리"
                                     >
                                       <UserX size={16} />
                                     </button>
                                   )}
                                   {isSessionEnded && app.status === 'confirmed' && app.attended === false && (
                                      <button
                                        onClick={() => handleUnmarkNoShow(app)}
                                        className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0"
                                        title="노쇼 취소"
                                      >
                                        <UserCheck size={16} />
                                      </button>
                                    )}
                                  {(app.status === 'applied' || app.status === 'held' || app.status === 'selected') && (
                                    <>
                                      {/* 입금확인 또는 선발 */}
                                      <button
                                        onClick={async () => {
                                          if (!user.isJobReviewed && !app.id.startsWith('dummy')) return toast.error('먼저 직업 승인을 해주세요.');
                                          
                                          if (app.status === 'selected') {
                                            if (isOverQuota && !confirm('정원이 가득 찬 상태입니다. 그래도 입금 확인 처리를 진행하시겠습니까?')) return;
                                            handleOpenPreview(app, 'confirm');
                                          } else {
                                            if (isOverQuota && !confirm('정원이 가득 찼습니다. 처리하시겠습니까?')) return;
                                            handleOpenPreview(app, 'select');
                                          }
                                        }}
                                        className={`flex-1 py-2.5 ${app.status === 'selected' ? 'bg-emerald-500' : 'bg-[#FF6F61]'} text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all`}
                                      >
                                        {app.status === 'selected' ? '입금확인' : '선발'}
                                      </button>

                                      {app.status === 'selected' && (
                                        <>
                                          <button
                                          onClick={() => {
                                            if (app.isSmsSent) {
                                              if (!window.confirm('이미 문자를 보낸 유저입니다. 다시 보내시겠습니까?')) return;
                                            }
                                            handleOpenPreview(app, 're-request');
                                          }}
                                          className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                                        >
                                          재요청
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm('선발(입금대기) 상태를 취소하고 다시 검토중 상태로 되돌리시겠습니까?')) {
                                              updateAppStatus(app, 'applied');
                                            }
                                          }}
                                          className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                                        >
                                          되돌리기
                                        </button>
                                        </>
                                      )}

                                      {app.status !== 'selected' && (
                                        <>
                                          {/* 선발확정 (문자 없이 바로 확정) */}
                                          <button
                                            onClick={async () => {
                                              if (!user.isJobReviewed && !app.id.startsWith('dummy')) return toast.error('먼저 직업 승인을 해주세요.');
                                              if (isOverQuota && !confirm('정원이 가득 찼습니다. 선발확정하시겠습니까?')) return;
                                              if (window.confirm('문자 발송 없이 바로 선발확정 처리하시겠습니까?')) {
                                                updateAppStatus(app, 'confirmed');
                                              }
                                            }}
                                            className="flex-1 py-2.5 bg-[#FFD700] text-[#7A5F00] rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                                          >
                                            확정
                                          </button>
                                          {/* 보류 */}
                                          <button
                                            onClick={() => updateAppStatus(app, 'held')}
                                            className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs active:scale-95 transition-all"
                                          >
                                            보류
                                          </button>
                                        </>
                                      )}

                                      {/* 기수 변경 */}
                                      <button
                                        onClick={() => { setChangeSessionApp(app); setChangeSessionModalOpen(true); }}
                                        className="flex-[0.5] py-2.5 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs active:scale-95 transition-all"
                                        title="기수 변경"
                                      >
                                        <Calendar size={16} />
                                      </button>
                                    </>
                                  )}
                                  {app.status === 'confirmed' && (
                                    <>
                                      <button
                                        onClick={() => updateAppStatus(app, 'held')}
                                        className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                                      >
                                        선발 취소하기
                                      </button>
                                      <button
                                        onClick={() => { setChangeSessionApp(app); setChangeSessionModalOpen(true); }}
                                        className="flex-[0.5] py-2.5 bg-blue-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md active:scale-95 transition-all"
                                      >
                                        <Calendar size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>

                              </div>
                            </div>
                          </td>
                        </tr>
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View: Card List (Light Premium Theme - Clean White, Compliant with Compact Spacing) */}
          <div className="md:hidden space-y-3 mt-3">
            {isDataLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 bg-slate-100 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 mt-1">
                      <div className="h-4 bg-slate-100 rounded w-1/3" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-14 bg-slate-100 rounded-xl w-full" />
                  <div className="h-9 bg-slate-100 rounded-xl w-full" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm flex flex-col items-center gap-4">
                <FileText size={48} className="opacity-10 text-slate-400" />
                <p className="text-sm font-bold text-slate-600">검색 결과와 일치하는 신청 내역이 없습니다.</p>
                {(filterGender !== 'all' || statusFilter !== 'all' || searchQuery) && (
                  <button onClick={() => { setFilterGender('all'); setStatusFilter('all'); setSearchQuery(''); }} className="text-[#FF6F61] text-xs font-bold underline">필터 초기화</button>
                )}
              </div>
            ) : (
              filtered.map((app) => {
                const user = userMap[app.userId] || {};
                const event = events.find(e => e.id === app.sessionId);
                const regionName = event?.region === 'busan' ? '부산' : (event?.region === 'changwon' ? '창원' : '');
                const aStatus = APP_STATUS[app.status] || { label: app.status, color: '#64748B', bg: '#F1F5F9' };
                const isFull = (app.gender === 'male' && isMaleFull) || (app.gender === 'female' && isFemaleFull);
                const isOverQuota = overQuotaAppIds.has(app.id);
                const isDummy = app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true;

                // 연령대 미일치 여부 계산
                const targetAgeRange = app.gender === 'male' ? event?.targetMaleAge : event?.targetFemaleAge;
                const userBirthDate = user.birthDate || app.birthDate || '';
                let isAgeMismatch = false;
                if (app.gender === 'male' && targetAgeRange && userBirthDate) {
                  const birthYearMatch = userBirthDate.match(/(\d{2,4})/);
                  const rangeMatch = targetAgeRange.match(/(\d{2})~(\d{2})/);
                  if (birthYearMatch && rangeMatch) {
                    let birthYear = parseInt(birthYearMatch[1]);
                    if (birthYear > 1900) birthYear = birthYear % 100;
                    const startYear = parseInt(rangeMatch[1]);
                    const endYear = parseInt(rangeMatch[2]);
                    const fullBirth = birthYear < 40 ? 2000 + birthYear : 1900 + birthYear;
                    const fullStart = startYear < 40 ? 2000 + startYear : 1900 + startYear;
                    const fullEnd = endYear < 40 ? 2000 + endYear : 1900 + endYear;
                    const minYear = Math.min(fullStart, fullEnd);
                    const maxYear = Math.max(fullStart, fullEnd);
                    if (fullBirth < minYear || fullBirth > maxYear) {
                      isAgeMismatch = true;
                    }
                  }
                }

                return (
                  <div 
                    key={app.id} 
                    className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-colors"
                    style={{
                      background: isOverQuota ? '#FFE4E6' : 'transparent'
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-14 h-14 rounded-full border-2 border-[#D4AF37] overflow-hidden bg-slate-100 shrink-0 cursor-pointer"
                          onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                        >
                          {user.photos?.[0] || user.photoUrl || user.photoURL ? (
                            <img src={user.photos?.[0] || user.photoUrl || user.photoURL} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#D4AF37] font-bold">{(user.name || app.name)?.[0]}</div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-black text-[1.1rem] hover:underline cursor-pointer ${app.attended === false && app.status === 'confirmed' ? 'text-rose-600' : 'text-slate-800'}`} onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}>{user.name || app.name}</span>
                            <span className={`text-[0.65rem] font-bold px-1.5 py-0.5 rounded ${(user.gender || app.gender) === 'male' ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
                              {(user.gender || app.gender) === 'male' ? '남성' : '여성'}
                            </span>
                            {isDummy && (
                              <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 shadow-sm whitespace-nowrap">
                                더미
                              </span>
                            )}
                            {app.isSmsSent && (
                              <span 
                                className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-help flex items-center gap-1"
                                title={`최근 발송: ${app.lastSmsSentAt?.toDate ? format(app.lastSmsSentAt.toDate(), 'MM/dd HH:mm') : '알 수 없음'}`}
                              >
                                <CheckCircle size={10} /> 요청완료
                              </span>
                            )}
                            {postEventStats?.matchedUserIds.has(app.userId) && (
                              <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600 border border-pink-200 flex items-center gap-0.5 whitespace-nowrap">
                                <Heart size={8} fill="#ec4899" /> 매칭성공
                              </span>
                            )}
                            {postEventStats && postEventStats.unmatchedUserIds.has(app.userId) && (
                              <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                                미매칭
                              </span>
                            )}
                            {app.attended === true && (
                              <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 whitespace-nowrap">
                                ✅ 참여완료
                              </span>
                            )}
                            {app.attended === false && app.status === 'confirmed' && (
                              <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200 whitespace-nowrap animate-pulse">
                                🚫 노쇼
                              </span>
                            )}
                          </div>
                          <div className="text-[0.75rem] text-slate-500 font-bold mt-0.5">
                            {(() => { const bd = user.birthDate || app.birthDate; return bd ? <span>{bd.includes('-') ? bd.split('-')[0].slice(-2) : (bd.length === 8 ? bd.slice(2, 4) : bd.slice(0, 2))}년생</span> : <span>??</span>; })()}
                            {' · '}{regionName} {event?.episodeNumber}기
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: 4,
                          color: aStatus.color,
                          background: aStatus.bg,
                        }}>
                          {aStatus.label}
                        </span>
                        {isAgeMismatch && (app.status === 'applied' || app.status === 'held') && (
                          <div className="flex items-center gap-1 text-[0.55rem] font-black text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-pulse">
                            <Info size={10} /> 연령부적합
                          </div>
                        )}
                        <button 
                          onClick={() => {
                            if (window.confirm('정말 삭제하시겠습니까?')) {
                              updateAppStatus(app, 'cancelled');
                            }
                          }}
                          className="text-slate-300 hover:text-rose-500 mt-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">직업</p>
                        <p className="text-sm font-bold text-slate-700 leading-tight">{user.admin_job || (user.job && user.job !== '-' ? user.job : null) || user.workplace?.split(',')[0] || app.job || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">거주지</p>
                        <p className="text-sm font-bold text-slate-700 leading-tight">{app.residence || user.residence || user.location || '-'}</p>
                      </div>
                      {app.couponDiscount && app.couponDiscount > 0 ? (
                        <div className="col-span-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">금액 (할인쿠폰 적용)</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 line-through">{(app.price + app.couponDiscount).toLocaleString('ko-KR')}원</span>
                            <span className="text-sm font-black text-emerald-600">{(app.price).toLocaleString('ko-KR')}원</span>
                            <span className="text-[0.5rem] font-bold text-purple-500 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">-{app.couponDiscount.toLocaleString('ko-KR')}원</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-1.5">
                                   <button
                                     onClick={() => setGeneralSmsTarget(app)}
                                     className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl flex items-center justify-center font-black text-xs active:scale-95 transition-all shrink-0 animate-in fade-in"
                                     title="문자 발송"
                                   >
                                     <MessageSquare size={16} />
                                   </button>
                      {(app.status === 'applied' || app.status === 'held' || app.status === 'selected') && (
                        <>
                          <button
                            onClick={async () => {
                              if (!user.isJobReviewed && !app.id.startsWith('dummy')) return toast.error('먼저 직업 승인을 해주세요.');
                              if (app.status === 'selected') {
                                if (isOverQuota && !confirm('정원이 가득 찬 상태입니다. 그래도 입금 확인 처리를 진행하시겠습니까?')) return;
                                handleOpenPreview(app, 'confirm');
                              } else {
                                if (isOverQuota && !confirm('정원이 가득 찼습니다. 처리하시겠습니까?')) return;
                                handleOpenPreview(app, 'select');
                              }
                            }}
                            className={`flex-1 py-2.5 ${app.status === 'selected' ? 'bg-emerald-500' : 'bg-[#FF6F61]'} text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all`}
                          >
                            {app.status === 'selected' ? '입금확인' : '선발'}
                          </button>

                          {app.status === 'selected' && (
                            <>
                              <button
                                onClick={() => {
                                  if (app.isSmsSent) {
                                    if (!window.confirm('이미 문자를 보낸 유저입니다. 다시 보내시겠습니까?')) return;
                                  }
                                  handleOpenPreview(app, 're-request');
                                }}
                                className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                              >
                                재요청
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('선발(입금대기) 상태를 취소하고 다시 검토중 상태로 되돌리시겠습니까?')) {
                                    updateAppStatus(app, 'applied');
                                  }
                                }}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                              >
                                되돌리기
                              </button>
                            </>
                          )}

                          {app.status !== 'selected' && (
                            <>
                              <button
                                onClick={async () => {
                                  if (!user.isJobReviewed && !app.id.startsWith('dummy')) return toast.error('먼저 직업 승인을 해주세요.');
                                  if (isOverQuota && !confirm('정원이 가득 찼습니다. 선발확정하시겠습니까?')) return;
                                  if (window.confirm('문자 발송 없이 바로 선발확정 처리하시겠습니까?')) {
                                    updateAppStatus(app, 'confirmed');
                                  }
                                }}
                                className="flex-1 py-2.5 bg-[#FFD700] text-[#7A5F00] rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                              >
                                확정
                              </button>
                              <button
                                onClick={() => updateAppStatus(app, 'held')}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs active:scale-95 transition-all"
                              >
                                보류
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => { setChangeSessionApp(app); setChangeSessionModalOpen(true); }}
                            className="flex-[0.5] py-2.5 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs active:scale-95 transition-all"
                            title="기수 변경"
                          >
                            <Calendar size={16} />
                          </button>
                        </>
                      )}
                      {app.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() => updateAppStatus(app, 'held')}
                            className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                          >
                            선발 취소하기
                          </button>
                          <button
                            onClick={() => { setChangeSessionApp(app); setChangeSessionModalOpen(true); }}
                            className="flex-[0.5] py-2.5 bg-blue-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md active:scale-95 transition-all"
                          >
                            <Calendar size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* 1:1 매칭 신청 관리 탭 */
        <AdminApplicationList isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />
      )}

      {/* Modal Overlay */}
      <UserProfileModal user={selectedUser} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedUser(null); }} />
      <SMSPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onConfirm={async (msg, updatedPrice) => {
          if (previewData) await updateAppStatus(previewData.app, previewData.targetStatus || 'selected', msg, updatedPrice);
        }}
        applicant={previewData?.app}
        session={previewData?.session}
        defaultMessage={previewData?.defaultMsg || ''}
        autoSelectTemplateName={previewData?.autoSelectTemplateName}
      />
      {generalSmsTarget && (
        <SMSPreviewModal
          isOpen={!!generalSmsTarget}
          onClose={() => setGeneralSmsTarget(null)}
          onConfirm={handleSendGeneralSms}
          applicant={{
            ...generalSmsTarget,
            name: userMap[generalSmsTarget.userId]?.name || generalSmsTarget.name,
            phone: userMap[generalSmsTarget.userId]?.phone || generalSmsTarget.phone,
            gender: generalSmsTarget.gender || userMap[generalSmsTarget.userId]?.gender,
          }}
          session={events.find(e => e.id === generalSmsTarget.sessionId)}
          recipientLabel={`${userMap[generalSmsTarget.userId]?.name || generalSmsTarget.name}님 (${userMap[generalSmsTarget.userId]?.phone || generalSmsTarget.phone || '번호없음'})`}
          confirmLabel="문자 발송"
          defaultMessage={`[키링크] 안녕하세요, ${userMap[generalSmsTarget.userId]?.name || generalSmsTarget.name}님! `}
        />
      )}
      {/* Session Change Modal */}
      {changeSessionModalOpen && changeSessionApp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-lg text-slate-800">기수 이동</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  <span className="text-blue-500">{changeSessionApp.name}</span> 님의 참가 기수를 변경합니다.
                </p>
              </div>
              <button onClick={() => { setChangeSessionModalOpen(false); setChangeSessionApp(null); setTargetSessionId(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5">
              <label className="block text-sm font-bold text-slate-700 mb-3">이동할 기수를 선택하세요</label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {events.filter(e => e.id !== changeSessionApp.sessionId).map(event => {
                  const mCount = event.currentMale || 0;
                  const fCount = event.currentFemale || 0;
                  const mMax = event.maxMale || 8;
                  const fMax = event.maxFemale || 8;
                  const isSelected = targetSessionId === event.id;
                  
                  return (
                    <div 
                      key={event.id}
                      onClick={() => setTargetSessionId(event.id)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-black text-slate-800 text-[0.95rem]">
                          {event.region === 'busan' ? '부산' : event.region === 'changwon' ? '창원' : event.region} {event.episodeNumber}기
                        </div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5">
                          {event.eventDate ? format(event.eventDate.toDate(), 'MM월 dd일 (E) HH:mm', { locale: ko }) : '날짜 미정'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className={`text-[0.65rem] font-black px-2 py-1 rounded-lg ${mCount >= mMax ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                          남 {mCount}/{mMax}
                        </span>
                        <span className={`text-[0.65rem] font-black px-2 py-1 rounded-lg ${fCount >= fMax ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                          여 {fCount}/{fMax}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {events.filter(e => e.id !== changeSessionApp.sessionId).length === 0 && (
                  <div className="p-4 text-center text-slate-500 text-sm font-bold bg-slate-50 rounded-xl">
                    이동 가능한 다른 기수가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button 
                onClick={() => { setChangeSessionModalOpen(false); setChangeSessionApp(null); setTargetSessionId(''); }}
                className="flex-1 py-3 text-sm font-black text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                취소
              </button>
              <button 
                onClick={handleChangeSession}
                disabled={!targetSessionId}
                className="flex-1 py-3 text-sm font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
              >
                이동하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── 기수 선택 커스텀 드롭다운 (Portal 방식으로 overflow clipping 방지) ──
function SessionDropdown({
  events,
  selectedEventId,
  setSelectedEventId,
}: {
  events: any[];
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        dropRef.current && !dropRef.current.contains(t)
      ) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    if (!dropOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const DROPDOWN_W = 170;
      const MARGIN = 8;
      // 버튼 오른쪽 끝 기준 좌측 정렬, 화면 밖으로 나가지 않게 클램핑
      const idealLeft = rect.right - DROPDOWN_W;
      const left = Math.max(MARGIN, Math.min(idealLeft, window.innerWidth - DROPDOWN_W - MARGIN));
      setCoords({ top: rect.bottom + 4, left });
    }
    setDropOpen(v => !v);
  };

  const eventOptions = [
    { value: 'all', label: '전체 기수 보기' },
    ...[...events]
      .filter(ev => {
        const now = new Date();
        const date = ev.eventDate?.toDate?.() || new Date();
        return !(ev.status === 'completed' || now >= new Date(date.getTime() + 2 * 60 * 60 * 1000));
      })
      .sort((a, b) => {
        const dateA = a.eventDate?.toDate?.() || new Date();
        const dateB = b.eventDate?.toDate?.() || new Date();
        return dateA.getTime() - dateB.getTime();
      })
      .map(ev => {
        const now = new Date();
        const eventDate = ev.eventDate?.toDate?.() || new Date();
        const twoHoursAfter = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
        const totalParticipants = (ev.currentMale || 0) + (ev.currentFemale || 0);
        const maxParticipants = (ev.maxMale || 0) + (ev.maxFemale || 0);
        const isOver = maxParticipants > 0 && totalParticipants >= maxParticipants;
        let statusLabel = '모집중';
        if (ev.status === 'completed' || now >= twoHoursAfter) statusLabel = '종료';
        else if (now >= eventDate) statusLabel = '진행중';
        else if (isOver) statusLabel = '마감';
        const dateLabel = eventDate ? `(${format(eventDate, 'MM/dd')})` : '';
        const regionLabel = ev.region === 'busan' ? '부산' : ev.region === 'changwon' ? '창원' : (ev.region ?? '부산');
        return { value: ev.id, label: `${regionLabel} ${ev.episodeNumber}기 ${dateLabel} [${statusLabel}]` };
      }),
  ];

  const selectedLabel = eventOptions.find(o => o.value === selectedEventId)?.label || '전체 기수 보기';

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl text-[0.72rem] font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
        style={{ height: '36px', padding: '0 10px 0 12px', minWidth: '148px' }}
      >
        <Calendar size={12} className="text-slate-400 shrink-0" />
        <span className="flex-1 text-left truncate">{selectedLabel}</span>
        <ChevronDown size={11} className={`text-slate-400 transition-transform duration-200 shrink-0 ${dropOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 99999,
          }}
          className="bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-150 origin-top-right overflow-hidden"
        >
          {eventOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSelectedEventId(opt.value); setDropOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[0.73rem] font-bold transition-colors ${
                selectedEventId === opt.value
                  ? 'bg-[#FFF5F4] text-[#FF6F61]'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
