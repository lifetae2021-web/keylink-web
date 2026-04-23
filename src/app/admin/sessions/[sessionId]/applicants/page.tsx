'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getApplicationsBySession,
  getApplicationsByStatus,
} from '@/lib/firestore/applications';
import {
  selectApplicant,
  confirmPayment,
  cancelApplicant,
  bulkSelectApplicants,
  restoreApplicant,
} from '@/lib/admin/selection';
import { getSession } from '@/lib/firestore/sessions';
import { Application, Session, ApplicationStatus } from '@/lib/types';
import {
  Users, CheckCircle2, Banknote, XCircle, Filter,
  ArrowLeft, RefreshCw, MessageSquare, ChevronDown,
  UserCheck, User2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import SMSPreviewModal from '@/components/admin/SMSPreviewModal';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '검토 중',
  selected: '입금 대기',
  confirmed: '참가 확정',
  cancelled: '취소',
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  applied: '#F59E0B',
  selected: '#8B5CF6',
  confirmed: '#10B981',
  cancelled: '#9CA3AF',
};

export default function ApplicantsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // 관리자 인증 확인
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/admin/login'); return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists() && snap.data().role === 'admin') {
        setIsAdmin(true);
        loadData();
      } else {
        router.push('/');
      }
    });
    return () => unsub();
  }, [sessionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, apps] = await Promise.all([
        getSession(sessionId),
        getApplicationsBySession(sessionId),
      ]);
      setSession(s);
      setApplications(apps);
    } catch (e) {
      console.error(e);
      toast.error('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상태 필터링
  const filtered = filterStatus === 'all'
    ? applications
    : applications.filter(a => a.status === filterStatus);

  // 집계
  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    selected: applications.filter(a => a.status === 'selected').length,
    confirmed: applications.filter(a => a.status === 'confirmed').length,
    cancelled: applications.filter(a => a.status === 'cancelled').length,
    maleConfirmed: applications.filter(a => a.status === 'confirmed' && a.gender === 'male').length,
    femaleConfirmed: applications.filter(a => a.status === 'confirmed' && a.gender === 'female').length,
  };

  // 단일 상태 변경
  const handleAction = async (
    app: Application,
    action: 'select' | 'confirm' | 'cancel' | 'restore',
    customMessage?: string
  ) => {
    setActionLoading(app.id);
    try {
      if (action === 'select') {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/applications/select', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            applicationId: app.id,
            customMessage: customMessage
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '처리 중 오류가 발생했습니다.');
        
        if (data.warning) {
          toast(data.warning, { icon: '⚠️', duration: 4000 });
        } else {
          toast.success(`${app.name}님 선발 및 안내 문자 발송 완료`);
        }
      } else if (action === 'confirm') {
        await confirmPayment(app.id, sessionId, app.gender);
        toast.success(`${app.name}님 입금 확인 완료!`);
      } else if (action === 'restore') {
        await restoreApplicant(app.id, sessionId, app.gender);
        toast.success(`${app.name}님을 참가 확정으로 복구했습니다.`);
      } else {
        await cancelApplicant(app.id, sessionId, app.gender, app.status === 'confirmed');
        toast.success(`${app.name}님을 취소 처리했습니다.`);
      }
      await loadData();
    } catch (e: any) {
      toast.error(e.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPreview = (app: Application) => {
    if (!session) return toast.error('세션 정보를 불러오는 중입니다.');
    
    // 타임존 보정 로직 (KST 기준)
    const eventTime = session.eventDate;
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
${app.name}님은 ${fDate} ${fDay} ${fTime} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 ${ (app.price || session.price || 60000).toLocaleString('ko-KR') }원 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요😭
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요🥰`;

    setPreviewData({ app, session, defaultMsg });
    setPreviewModalOpen(true);
  };

  // 일괄 선발
  const handleBulkSelect = async () => {
    if (selectedIds.size === 0) return toast.error('선택된 신청자가 없습니다.');
    if (!confirm(`${selectedIds.size}명을 일괄 선발하시겠습니까?`)) return;
    setActionLoading('bulk');
    try {
      await bulkSelectApplicants(Array.from(selectedIds));
      toast.success(`${selectedIds.size}명을 선발했습니다.`);
      setSelectedIds(new Set());
      await loadData();
    } catch (e: any) {
      toast.error(e.message || '일괄 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 font-semibold">데이터 로딩 중...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">
              {session?.title || `기수 ${sessionId}`} — 신청자 관리
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              행사일: {session?.eventDate.toLocaleDateString('ko-KR')} | 상태: {session?.status}
            </p>
          </div>
          <button onClick={loadData} className="ml-auto p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <RefreshCw size={18} className="text-gray-400" />
          </button>
        </div>

        {/* 성비 현황 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: '총 신청', value: stats.total, color: '#6B7280' },
            { label: '검토 중', value: stats.applied, color: '#F59E0B' },
            { label: '입금 대기', value: stats.selected, color: '#8B5CF6' },
            { label: '참가 확정', value: stats.confirmed, color: '#10B981' },
            { label: '취소', value: stats.cancelled, color: '#EF4444' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs font-bold mb-2">{label}</p>
              <p className="text-3xl font-black" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* 성비 게이지 */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <User2 size={16} className="text-blue-400" /> 남성 확정: {stats.maleConfirmed}명
            </span>
            <span className="text-sm font-bold text-gray-300 flex items-center gap-2">
              여성 확정: {stats.femaleConfirmed}명 <User2 size={16} className="text-pink-400" />
            </span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
            {stats.confirmed > 0 && (
              <>
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${(stats.maleConfirmed / stats.confirmed) * 100}%` }}
                />
                <div
                  className="h-full bg-pink-500 transition-all"
                  style={{ width: `${(stats.femaleConfirmed / stats.confirmed) * 100}%` }}
                />
              </>
            )}
          </div>
          <p className="text-center text-xs text-gray-500 mt-2 font-semibold">
            목표: 남 {session?.maxMale || '-'}명 / 여 {session?.maxFemale || '-'}명
          </p>
        </div>

        {/* 필터 + 일괄 선발 */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'applied', 'selected', 'confirmed', 'cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  filterStatus === s
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s === 'all' ? '전체' : STATUS_LABELS[s]}
                <span className="ml-1.5 text-xs opacity-70">
                  {s === 'all' ? stats.total : stats[s] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkSelect}
                disabled={actionLoading === 'bulk'}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <UserCheck size={16} />
                {selectedIds.size}명 일괄 선발
              </button>
            )}
            <Link
              href={`/admin/sessions/${sessionId}/matching`}
              className="flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 rounded-xl text-sm font-bold transition-all"
            >
              매칭 결과 관리 →
            </Link>
          </div>
        </div>

        {/* 신청자 테이블 */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedIds.size === filtered.filter(a => a.status === 'applied').length && filtered.filter(a => a.status === 'applied').length > 0}
                      onChange={(e) => {
                        const eligible = filtered.filter(a => a.status === 'applied').map(a => a.id);
                        setSelectedIds(e.target.checked ? new Set(eligible) : new Set());
                      }}
                    />
                  </th>
                  {['이름', '성별', '나이', '직업', '거주지', '신청일', '상태', '액션'].map(h => (
                    <th key={h} className="p-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-gray-500 font-semibold">
                      해당 상태의 신청자가 없습니다.
                    </td>
                  </tr>
                ) : filtered.map(app => (
                  <tr key={app.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      {app.status === 'applied' && (
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(app.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(app.id);
                            else next.delete(app.id);
                            setSelectedIds(next);
                          }}
                        />
                      )}
                    </td>
                    <td className="p-4 font-bold text-white">{app.name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${app.gender === 'male' ? 'bg-blue-900/50 text-blue-300' : 'bg-pink-900/50 text-pink-300'}`}>
                        {app.gender === 'male' ? '남' : '여'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 text-sm">{app.age}세</td>
                    <td className="p-4 text-gray-300 text-sm">{app.job}</td>
                    <td className="p-4 text-gray-400 text-xs">{app.residence}</td>
                    <td className="p-4 text-gray-400 text-xs">{app.appliedAt.toLocaleDateString('ko-KR')}</td>
                    <td className="p-4">
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-bold"
                        style={{ background: `${STATUS_COLORS[app.status]}20`, color: STATUS_COLORS[app.status] }}
                      >
                        {STATUS_LABELS[app.status]}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {app.status === 'applied' && (
                          <div className="flex items-center gap-2">
                             <button
                              onClick={() => {
                                if (window.confirm('문자 발송 없이 입금 완료 처리하시겠습니까?')) {
                                  handleAction(app, 'confirm');
                                }
                              }}
                              disabled={actionLoading === app.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 transition-all disabled:opacity-50"
                            >
                              선발확정
                            </button>
                            <button
                              onClick={() => handleOpenPreview(app)}
                              disabled={actionLoading === app.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 transition-all disabled:opacity-50"
                            >
                              선발
                            </button>
                          </div>
                        )}
                        {app.status === 'selected' && (
                          <button
                            onClick={() => handleAction(app, 'confirm')}
                            disabled={actionLoading === app.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600/20 text-green-300 hover:bg-green-600/40 transition-all disabled:opacity-50"
                          >
                            입금확인
                          </button>
                        )}
                        {app.status === 'cancelled' && (
                          <button
                            onClick={() => handleAction(app, 'restore')}
                            disabled={actionLoading === app.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600/20 text-green-300 hover:bg-green-600/40 transition-all disabled:opacity-50"
                          >
                            참가 확정으로 복구
                          </button>
                        )}
                        {app.status !== 'cancelled' && app.status !== 'confirmed' && (
                          <button
                            onClick={() => handleAction(app, 'cancel')}
                            disabled={actionLoading === app.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/20 text-red-300 hover:bg-red-600/40 transition-all disabled:opacity-50"
                          >
                            취소
                          </button>
                        )}
                        {app.status === 'confirmed' && (
                           <button
                            onClick={() => handleAction(app, 'cancel')}
                            disabled={actionLoading === app.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/20 text-red-300 hover:bg-red-600/40 transition-all disabled:opacity-50"
                           >
                            취소
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SMS 트리거 (v5.1.0 이연 - 스텁) */}
        <div className="mt-6 p-5 bg-gray-900 rounded-2xl border border-gray-800 border-dashed">
          <div className="flex items-center gap-3 text-gray-500">
            <MessageSquare size={18} />
            <div>
              <p className="text-sm font-bold">문자 발송 (v5.1.0 예정)</p>
              <p className="text-xs mt-0.5">Coolsms API 연동 후 활성화됩니다. 선발/확정 안내 문자를 일괄 발송할 수 있습니다.</p>
            </div>
          </div>
        </div>
      </div>

      <SMSPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        onConfirm={async (msg) => {
          if (previewData) await handleAction(previewData.app, 'select', msg);
        }}
        applicant={previewData?.app}
        session={previewData?.session}
        defaultMessage={previewData?.defaultMsg || ''}
      />
    </div>
  );
}
