'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Users, CreditCard, Calendar,
  ArrowUpRight, ArrowDownRight, DollarSign,
  Download, Filter, Loader2, X, ChevronRight
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

const panel = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  boxShadow: '0 4px 20px -1px rgba(0, 0, 0, 0.03)'
};

// 상세 모달 컴포넌트
function DetailModal({
  title,
  filterMonth,
  filterSessionId,
  applications,
  sessions,
  onClose,
}: {
  title: string;
  filterMonth: 'all' | 'current';
  filterSessionId?: string;
  applications: any[];
  sessions: any[];
  onClose: () => void;
}) {
  const sessionMap = useMemo(() => {
    const m: Record<string, any> = {};
    sessions.forEach(s => { m[s.id] = s; });
    return m;
  }, [sessions]);

  const handleToggleFree = async (app: any, makeFree: boolean) => {
    try {
      const appRef = doc(db, 'applications', app.id);
      await updateDoc(appRef, {
        amountPaid: makeFree ? 0 : null,
        updatedAt: new Date(),
      });
      toast.success(makeFree ? `${app.name}님이 🎁 무료 참여로 설정되었습니다.` : `${app.name}님이 ✅ 일반 결제로 복원되었습니다.`);
    } catch (e) {
      console.error('Error toggling free status:', e);
      toast.error('오류가 발생했습니다.');
    }
  };

  const handleToggleRefund = async (app: any, makeRefund: boolean) => {
    try {
      if (makeRefund) {
        const confirmRefund = window.confirm(`${app.name}님을 수동 환불 처리하시겠습니까?\n이 작업은 매출에 즉시 반영되며, 환불 취소 버튼으로 언제든 복구할 수 있습니다.`);
        if (!confirmRefund) return;
      }
      const appRef = doc(db, 'applications', app.id);
      await updateDoc(appRef, {
        isManualRefund: makeRefund ? true : null,
        updatedAt: new Date(),
      });
      toast.success(makeRefund ? `${app.name}님이 💸 수동 환불 처리되었습니다.` : `${app.name}님이 ✅ 환불 취소(정상 복구) 처리되었습니다.`);
    } catch (e) {
      console.error('Error toggling refund status:', e);
      toast.error('오류가 발생했습니다.');
    }
  };

  const rows = useMemo(() => {
    const confirmed = applications.filter(app =>
      app.status === 'confirmed' || app.paymentConfirmed === true
    );

    const now = new Date();
    let filtered = filterMonth === 'current'
      ? confirmed.filter(app => {
          const session = sessionMap[app.sessionId];
          if (!session) return false;
          const date = session.eventDate instanceof Date ? session.eventDate : session.eventDate?.toDate?.() || new Date();
          return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
        })
      : confirmed;

    if (filterSessionId) {
      filtered = filtered.filter(app => app.sessionId === filterSessionId);
    }

    return filtered
      .map(app => {
        const session = sessionMap[app.sessionId] || {};
        
        // v12.0.0: 정상 출석 + 환불 대상 = 실제 매출 0원 (보증금 환불)
        // 지각 or 노쇼 + 환불 대상 = 보증금 몰수 → 정상 매출로 계산
        // 단, 관리자 직권 환불(isManualRefund)은 예외로 매출 0원 처리
        const isRefunded = app.isManualRefund === true || app.status === 'refunded' || (app.isRefundDeposit === true && app.attendanceStatus === 'present');
        const isRefundPending = app.status !== 'refunded' && app.isManualRefund !== true && app.isRefundDeposit === true && (app.attendanceStatus === undefined || app.attendanceStatus === null || app.attendanceStatus === 'none' || !app.attendanceStatus);

        // v8.12.1: 성별 및 옵션 기반 가격 로직 동기화
        const malePrice = app.maleOption === 'safe' ? 60000 : (session.malePrice || 49000);
        const femalePrice = app.femaleOption === 'group' ? 24000 : (session.femalePrice || 29000);
        
        const amount = (isRefunded || isRefundPending)
          ? 0
          : (app.amountPaid !== undefined && app.amountPaid !== null && app.amountPaid !== '')
            ? Number(app.amountPaid)
            : (app.price !== undefined && app.price !== null && app.price !== '')
              ? Number(app.price)
              : (app.gender === 'male' ? malePrice : femalePrice);
          
        const sessionName = session.episodeNumber
          ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`
          : '-';
        const confirmedAt = app.updatedAt instanceof Date ? app.updatedAt : (app.updatedAt?.toDate?.() || new Date());
        
        // v8.12.2: 옵션 라벨 추가
        const optionLabel = app.gender === 'male'
          ? (app.maleOption === 'safe' ? '안심보험' : '기본')
          : (app.femaleOption === 'group' ? '지인동반' : '기본');

        const isFree = !isRefunded && !isRefundPending && amount === 0;
        const isNoShow = app.attendanceStatus === 'no-show';

        return { app, session, amount, sessionName, confirmedAt, optionLabel, isRefunded, isRefundPending, isFree, isNoShow };
      })
      .sort((a, b) => {
        const epA = a.session?.episodeNumber || 0;
        const epB = b.session?.episodeNumber || 0;
        if (epB !== epA) return epB - epA;

        const regA = a.session?.region || '';
        const regB = b.session?.region || '';
        if (regA !== regB) return regA.localeCompare(regB, 'ko');

        const nameA = a.app.name || '';
        const nameB = b.app.name || '';
        return nameA.localeCompare(nameB, 'ko');
      });
  }, [applications, sessions, sessionMap, filterMonth]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              총 {rows.length}건 · 합계 ₩{total.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 테이블 */}
        <div className="overflow-auto flex-1">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <TrendingUp size={36} className="text-slate-200" />
              <p className="font-bold text-sm">해당 기간의 결제 내역이 없습니다</p>
            </div>
          ) : (
            <table className="w-full text-left text-nowrap">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
                <tr>
                  {['기수', '참여자', '성별', '옵션', '결제 금액', '상태'].map(h => (
                    <th key={h} className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(({ app, amount, sessionName, confirmedAt, optionLabel, isRefunded, isRefundPending, isFree, isNoShow }, i) => (
                  <tr key={i} className={`hover:bg-slate-50/60 transition-colors ${
                    isRefunded ? 'bg-sky-50/30' : isRefundPending ? 'bg-amber-50/20' : isFree ? 'bg-purple-50/20' : isNoShow ? 'bg-rose-50/10' : ''
                  }`}>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-slate-700">{sessionName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">{app.name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        app.gender === 'male'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-pink-50 text-pink-600'
                      }`}>
                        {app.gender === 'male' ? '남성' : '여성'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500">{optionLabel}</span>
                    </td>
                    <td className="px-6 py-4">
                      {isRefunded ? (
                        <span className="text-base font-black text-sky-500">₩0 <span className="text-xs text-slate-400 font-medium">(보증금 반환)</span></span>
                      ) : isRefundPending ? (
                        <span className="text-base font-black text-amber-500">₩0 <span className="text-xs text-slate-400 font-medium">(환급 예정)</span></span>
                      ) : isFree ? (
                        <span className="text-base font-black text-purple-500">₩0 <span className="text-xs text-slate-400 font-medium">(무료)</span></span>
                      ) : (
                        <span className="text-base font-black text-slate-800">
                          ₩{amount.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isRefunded ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-600">
                            💸 환불 완료
                          </span>
                          <button
                            onClick={() => handleToggleRefund(app, false)}
                            className="px-2 py-0.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-md text-[0.68rem] font-bold transition-all"
                            title="환불 취소 후 일반 상태로 복구"
                          >
                            환불 취소
                          </button>
                          {isNoShow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
                              🚨 노쇼
                            </span>
                          )}
                        </div>
                      ) : isRefundPending ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600">
                            ⏳ 환급 예정
                          </span>
                          {isNoShow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
                              🚨 노쇼
                            </span>
                          )}
                        </div>
                      ) : isFree ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600">
                            🎁 무료 참여
                          </span>
                          <button
                            onClick={() => handleToggleFree(app, false)}
                            className="px-2 py-0.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-md text-[0.68rem] font-bold transition-all"
                            title="일반 입금 완료 상태로 전환"
                          >
                            일반으로 전환
                          </button>
                          {isNoShow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
                              🚨 노쇼
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                            입금 완료
                          </span>
                          <button
                            onClick={() => handleToggleFree(app, true)}
                            className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-md text-[0.68rem] font-black transition-all border border-purple-200/50"
                            title="무료 참여 상태로 전환"
                          >
                            🎁 무료 전환
                          </button>
                          <button
                            onClick={() => handleToggleRefund(app, true)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[0.68rem] font-black transition-all border border-slate-200"
                            title="수동 환불 처리"
                          >
                            💸 수동 환불
                          </button>
                          {isNoShow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
                              🚨 노쇼
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-sm font-black text-slate-500">합계</td>
                  <td className="px-6 py-4 text-lg font-black text-[#FF7E7E]">₩{total.toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RevenueStatsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().role === 'super_admin') {
          setIsSuperAdmin(true);
        } else {
          setIsSuperAdmin(false);
          router.replace('/admin');
        }
      } catch (e) {
        setIsSuperAdmin(false);
        router.replace('/admin');
      }
    });
    return () => unsubAuth();
  }, [router]);

  const [dummyUserIds, setDummyUserIds] = useState<Set<string>>(new Set());

  // 상세 모달 상태
  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    title: string;
    filterMonth: 'all' | 'current';
    filterSessionId?: string;
  }>({ open: false, title: '', filterMonth: 'all' });

  useEffect(() => {
    const qSessions = query(collection(db, 'sessions'), orderBy('episodeNumber', 'desc'));
    const unsubSessions = onSnapshot(qSessions, (snap) => {
      setSessions(snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        eventDate: doc.data().eventDate?.toDate() || new Date()
      })));
    });

    const qApps = query(collection(db, 'applications'));
    const unsubApps = onSnapshot(qApps, (snap) => {
      setApplications(snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const dummies = new Set<string>();
      snap.docs.forEach(doc => {
        const u = doc.data();
        const isDummy = u.isDummy === true || doc.id?.startsWith('dummy') || doc.id?.startsWith('user_m_') || doc.id?.startsWith('user_f_');
        if (isDummy) {
          dummies.add(doc.id);
        }
      });
      setDummyUserIds(dummies);
      setIsLoading(false);
    });

    return () => { unsubSessions(); unsubApps(); unsubUsers(); };
  }, []);

  const stats = useMemo(() => {
    if (isLoading) return null;

    // 1. 테스트 기수 제외
    const activeNonTestSessions = sessions.filter(s => !s.isTest);
    const activeSessionIds = new Set(activeNonTestSessions.map(s => s.id));

    // 2. 더미 회원 및 기재되지 않은(삭제된) 기수 결제 내역 제외
    const realApps = applications.filter(app => {
      if (!activeSessionIds.has(app.sessionId)) return false;
      const isDummy =
        app.isDummy === true ||
        app.id?.startsWith('dummy') ||
        app.userId?.startsWith('dummy') ||
        app.userId?.startsWith('user_m_') ||
        app.userId?.startsWith('user_f_') ||
        dummyUserIds.has(app.userId);
      return !isDummy;
    });

    const sessionMap: Record<string, any> = {};
    activeNonTestSessions.forEach(s => { sessionMap[s.id] = s; });

    const eventRevenues = activeNonTestSessions.map(session => {
      const confirmedApps = realApps.filter(app =>
        app.sessionId === session.id &&
        (app.status === 'confirmed' || app.paymentConfirmed === true)
      );

      let paidCount = 0;
      let freeCount = 0;
      let refundCount = 0;

      const revenue = confirmedApps.reduce((sum, app) => {
        // v12.0.0: 정상 출석 + 환불 대상 = 실제 매출 0원 (보증금 환불)
        // 지각 or 노쇼 + 환불 대상 = 보증금 몰수 → 정상 매출로 계산
        const isRefunded = app.isManualRefund === true || app.status === 'refunded' || (app.isRefundDeposit === true && app.attendanceStatus === 'present');
        const isRefundPending = app.status !== 'refunded' && app.isManualRefund !== true && app.isRefundDeposit === true && (app.attendanceStatus === undefined || app.attendanceStatus === null || app.attendanceStatus === 'none' || !app.attendanceStatus);
        
        if (isRefunded || isRefundPending) {
          refundCount++;
          return sum;
        }

        const malePrice = app.maleOption === 'safe' ? 60000 : (session.malePrice || 49000);
        const femalePrice = app.femaleOption === 'group' ? 24000 : (session.femalePrice || 29000);
        
        const price = (app.amountPaid !== undefined && app.amountPaid !== null && app.amountPaid !== '')
          ? Number(app.amountPaid)
          : (app.price !== undefined && app.price !== null && app.price !== '')
            ? Number(app.price)
            : (app.gender === 'male' ? malePrice : femalePrice);

        if (price === 0) {
          freeCount++;
        } else {
          paidCount++;
        }

        return sum + price;
      }, 0);

      // avgFee 왜곡 방지: 유료 결제 인원(paidCount)만 분모로 사용
      const avgFee = paidCount > 0
        ? Math.round(revenue / paidCount)
        : (session.price || 29000);

      return {
        id: session.id,
        name: `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`,
        date: session.eventDate,
        count: confirmedApps.length,
        paidCount,
        freeCount,
        refundCount,
        fee: avgFee,
        total: revenue
      };
    });

    const totalRevenue = eventRevenues.reduce((acc, curr) => acc + curr.total, 0);

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthRevenue = eventRevenues
      .filter(ev => isWithinInterval(ev.date, { start: currentMonthStart, end: currentMonthEnd }))
      .reduce((acc, curr) => acc + curr.total, 0);

    const prevMonthRevenue = eventRevenues
      .filter(ev => isWithinInterval(ev.date, { start: prevMonthStart, end: prevMonthEnd }))
      .reduce((acc, curr) => acc + curr.total, 0);

    const growth = prevMonthRevenue === 0 ? 100 : ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;

    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const monthRev = eventRevenues
        .filter(ev => isWithinInterval(ev.date, { start: mStart, end: mEnd }))
        .reduce((acc, curr) => acc + curr.total, 0);
      chartData.push({ name: format(monthDate, 'MMM', { locale: ko }), revenue: monthRev });
    }

    return { totalRevenue, thisMonthRevenue, growth, eventRevenues, chartData, realApps, activeNonTestSessions };
  }, [sessions, applications, isLoading, dummyUserIds]);

  if (isSuperAdmin === null || isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-[#FF7E7E]" size={32} />
        <p className="text-slate-400 font-medium text-sm">권한을 확인하고 매출 데이터를 집계하고 있습니다...</p>
      </div>
    );
  }

  if (!stats || stats.eventRevenues.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 gap-6" style={panel}>
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
          <TrendingUp size={32} className="text-slate-300" />
        </div>
        <div className="text-center">
          <h3 className="text-slate-800 font-bold text-lg">아직 집계된 매출 데이터가 없습니다</h3>
          <p className="text-slate-400 text-sm mt-1">기수를 등록하고 참가 신청을 받으면 자동으로 매출이 집계됩니다.</p>
        </div>
      </div>
    );
  }

  // 카드 정의 (처음 두 카드만 상세 보기 가능)
  const cards = [
    {
      label: '총 누적 매출',
      value: `₩${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: '#FF7E7E',
      desc: '현재까지 집계된 모든 수익',
      canDetail: true,
      filterMonth: 'all' as const,
    },
    {
      label: '당월 매출 내역',
      value: `₩${stats.thisMonthRevenue.toLocaleString()}`,
      icon: CreditCard,
      color: '#0F172A',
      desc: `${format(new Date(), 'MMMM', { locale: ko })} 매출액`,
      canDetail: true,
      filterMonth: 'current' as const,
    },
    {
      label: '전월 대비 성장률',
      value: `${stats.growth >= 0 ? '+' : ''}${stats.growth.toFixed(1)}%`,
      icon: stats.growth >= 0 ? ArrowUpRight : ArrowDownRight,
      color: stats.growth >= 0 ? '#4ade80' : '#FF6F61',
      desc: stats.growth >= 0 ? '지난달보다 수익 증가' : '지난달보다 수익 감소',
      canDetail: false,
      filterMonth: 'all' as const,
    },
  ];

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0F172A' }}>비즈니스 인사이트</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl h-11 px-5 border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
              <Download size={16} /> 엑셀 다운로드
            </button>
            <button className="rounded-xl h-11 px-5 bg-[#FF7E7E] text-white font-bold text-sm shadow-lg shadow-[#FF7E7E]/30 hover:opacity-90 transition-all">
              월간 보고서 출력
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <div key={i} style={panel} className="p-8 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${card.color}10` }}>
                  <card.icon size={24} style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{card.label}</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{card.value}</h3>
                </div>
                <p className="text-slate-500 text-xs">{card.desc}</p>
                {card.canDetail && (
                  <button
                    onClick={() => setModalConfig({ open: true, title: `${card.label} 상세 내역`, filterMonth: card.filterMonth })}
                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-[#FF7E7E] transition-colors w-fit mt-1 group/btn"
                  >
                    자세히 보기
                    <ChevronRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700" style={{ background: card.color }} />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={panel} className="p-8 border-none shadow-xl bg-white rounded-[24px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800">매출 추이 분석</h3>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Monthly Revenue Trend (Last 6 Months)</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg">
              <button className="px-3 py-1 text-xs font-bold bg-white text-slate-800 rounded shadow-sm">Monthly</button>
              <button className="px-3 py-1 text-xs font-bold text-slate-400">Quarterly</button>
            </div>
          </div>
          <div className="h-[320px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7E7E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF7E7E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(val) => `₩${(val / 10000).toLocaleString()}만`} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '12px 16px' }}
                  itemStyle={{ fontWeight: 900, color: '#0F172A' }}
                  labelStyle={{ fontWeight: 800, color: '#64748B', marginBottom: '4px' }}
                  formatter={(val: any) => [`₩${Number(val || 0).toLocaleString()}`, '매출액']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FF7E7E" strokeWidth={5} fillOpacity={1} fill="url(#colorRev)" animationDuration={2500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Revenue Table */}
        <div style={panel} className="overflow-hidden bg-white">
          <div className="p-8 flex items-center justify-between border-b border-slate-50">
            <div>
              <h3 className="text-lg font-black text-slate-800">기수별 매출 상세</h3>
              <p className="text-xs text-slate-400 font-bold mt-1 font-sans">INDIVIDUAL SESSION REVENUE PERFORMANCE</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600">
                <Filter size={12} />최근 기수 순
              </div>
            </div>
          </div>
          <div className="overflow-x-auto text-nowrap">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  {['운영 기수', '행사 일정', '확정 인원', '합계 매출액', '지표'].map(h => (
                    <th key={h} className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 italic">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.eventRevenues.map((ev, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-800 group-hover:text-[#FF7E7E] transition-colors">{ev.name}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-bold text-slate-500">{format(ev.date, 'yyyy. MM. dd (eee)', { locale: ko })}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => setModalConfig({ open: true, title: `${ev.name} 참가 상세 내역`, filterMonth: 'all', filterSessionId: ev.id })}
                          className="flex items-center gap-2 hover:bg-slate-100 p-1 -ml-1 rounded-lg transition-colors cursor-pointer group/sessionbtn text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-50 group-hover/sessionbtn:bg-[#FF7E7E]/10 flex items-center justify-center text-[#FF7E7E] transition-colors">
                            <Users size={14} />
                          </div>
                          <span className="text-sm font-bold text-slate-700 group-hover/sessionbtn:text-[#FF7E7E] transition-colors">{ev.count}명</span>
                        </button>
                        {(ev.freeCount > 0 || ev.refundCount > 0) && (
                          <div className="flex items-center gap-1 pl-10 text-[0.68rem] font-bold text-slate-400">
                            <span>유료 {ev.paidCount}</span>
                            {ev.freeCount > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-purple-500">무료 {ev.freeCount}</span>
                              </>
                            )}
                            {ev.refundCount > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-sky-500">환급 {ev.refundCount}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-base font-black text-[#0F172A]">₩{ev.total.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF7E7E] rounded-full" style={{ width: `${Math.min((ev.total / 500000) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 상세 모달 */}
      {modalConfig.open && stats && (
        <DetailModal
          title={modalConfig.title}
          filterMonth={modalConfig.filterMonth}
          filterSessionId={modalConfig.filterSessionId}
          applications={stats.realApps}
          sessions={stats.activeNonTestSessions}
          onClose={() => setModalConfig(prev => ({ ...prev, open: false }))}
        />
      )}
    </>
  );
}
