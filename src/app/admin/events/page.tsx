'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, MapPin, Users, Heart,
  Plus, Edit2, Trash2, Play, X,
  CheckCircle, Clock, RefreshCw, ChevronRight, Zap, BarChart3,
  Loader2, ListChecks, Phone, UserCheck
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, where, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Session, SessionStatus, MatchingResult, Application } from '@/lib/types';
import Link from 'next/link';

// v6.6.0 Premium Light Theme Panel
const panel = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' };

export default function EventsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matchingHistory, setMatchingHistory] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [applicants, setApplicants] = useState<Application[]>([]); // v7.2.0
  const [applicantsLoading, setApplicantsLoading] = useState(false); // v7.2.0
  const [userMap, setUserMap] = useState<Record<string, any>>({}); // v7.9.6: 유저 정보 조인용

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // v7.0.0: 수정 중인 문서 ID
  const ageEndRef = useRef<HTMLInputElement>(null); // v7.5.2: 자동 포커스 이동용
  
  const initialFormData = {
    region: 'busan',
    episodeNumber: '', 
    eventDate: '',
    eventTime: '20:00', 
    venue: '서면역 인근 프라이빗한 파티룸',
    venueAddress: '',
    price: '29,000', 
    ageStart: '', // v7.5.3: 빈칸으로 시작
    ageEnd: '',   // v7.5.3: 빈칸으로 시작
    maxMale: '8',
    maxFemale: '8',
    status: 'open' as SessionStatus
  };

  const [formData, setFormData] = useState(initialFormData);
  
  // v8.1.7: 투표 설정 모달 상태
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [configFormData, setConfigFormData] = useState({
    maxSelection: 3,
    questionText: '오늘 가장 호감 갔던 이성을 3명까지 골라주세요.',
    showReason: false,
    resultVisibility: 'all' as 'all' | 'mutual',
    q1Label: '실명을 적어주세요',
    q2Label: '본인의 호를 체크해주세요',
    q3Label: '호감가는 이성 선택',
    q4Label: '매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?',
    q5Label: '후기',
  });

  // v8.2.0: 기수 목록 사이드바 실시간 집계를 위한 전역 구독 (성능 최적화: confirmed, selected만 필터링)
  const [globalCounts, setGlobalCounts] = useState<Record<string, { male: number, female: number }>>({});

  useEffect(() => {
    // 확정 및 입금 대기 상태인 신청자만 실시간 집계하여 사이드바와 대시보드 동기화
    const q = query(
      collection(db, 'applications'),
      where('status', 'in', ['confirmed', 'selected'])
    );
    const unsub = onSnapshot(q, (snap) => {
      const counts: Record<string, { male: number, female: number }> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const sid = data.sessionId;
        if (!sid) return;
        if (!counts[sid]) counts[sid] = { male: 0, female: 0 };
        if (data.gender === 'male') counts[sid].male++;
        else counts[sid].female++;
      });
      setGlobalCounts(counts);
    }, (err) => console.error("Global counts sync error:", err));
    return () => unsub();
  }, []);

  // 1. 실시간 데이터 구독 (기수 목록)
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('episodeNumber', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          eventDate: d.eventDate?.toDate?.() || new Date(),
          createdAt: d.createdAt?.toDate?.() || new Date(),
        } as Session;
      });
      setSessions(fetched);
      if (fetched.length > 0 && !selectedId) {
        setSelectedId(fetched[0].id);
      }
      setIsLoading(false);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v7.2.0: 선택된 기수의 신청자 명단 실시간 구독
  useEffect(() => {
    if (!selectedId) { setApplicants([]); return; }
    setApplicantsLoading(true);
    const q = query(
      collection(db, 'applications'),
      where('sessionId', '==', selectedId)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        userId: d.data().userId,
        sessionId: d.data().sessionId,
        name: d.data().name,
        age: d.data().age,
        gender: d.data().gender,
        job: d.data().job,
        phone: d.data().phone ?? '',
        residence: d.data().residence,
        status: d.data().status,
        paymentConfirmed: d.data().paymentConfirmed ?? false,
        appliedAt: d.data().appliedAt?.toDate() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
        instaId: d.data().instaId,
        smoking: d.data().smoking,
        drinking: d.data().drinking,
        religion: d.data().religion,
        drink: d.data().drink,
        idealType: d.data().idealType,
        nonIdealType: d.data().nonIdealType,
        avoidAcquaintance: d.data().avoidAcquaintance,
        etc: d.data().etc,
      } as Application));
      list.sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());
      setApplicants(list);
      setApplicantsLoading(false);

      // v7.9.6: 유저 컬렉션에서 상세 정보(생년월일 등) 조인
      const uids = Array.from(new Set(list.map(a => a.userId)));
      const newUserMap = { ...userMap };
      let updated = false;

      for (const uid of uids) {
        if (!newUserMap[uid]) {
          try {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              newUserMap[uid] = uSnap.data();
              updated = true;
            }
          } catch (e) {
            console.error("Error fetching user data:", e);
          }
        }
      }
      if (updated) setUserMap(newUserMap);
    }, (err) => {
      console.error(err);
      setApplicantsLoading(false);
    });
    return () => unsub();
  }, [selectedId]);

  // 2. 매칭 히스토리 로드 (간이 통계용)
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('episodeNumber', 'desc'), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      const history = snap.docs.map(doc => ({
        id: doc.id,
        episode: doc.data().episodeNumber,
        date: format(doc.data().eventDate?.toDate?.() || new Date(), 'yyyy. MM. dd'),
        status: doc.data().status
      }));
      setMatchingHistory(history);
    });
    return () => unsub();
  }, []);

  const active = useMemo(() => sessions.find(s => s.id === selectedId), [sessions, selectedId]);

  const stats = useMemo(() => {
    const openCount = sessions.filter(s => s.status === 'open').length;
    // v8.2.0: 모든 기수의 실시간 집계 인원을 합산하여 표시 (Global Sync)
    const totalParticipants = Object.values(globalCounts).reduce((sum, c) => sum + c.male + c.female, 0);
    return {
      total: sessions.length,
      open: openCount,
      participants: totalParticipants,
      rate: 75
    };
  }, [sessions, globalCounts]);

    } catch (e) {
      toast.error('상태 변경 중 오류 발생');
    }
  };

  // v8.2.0: 참가 명단 (확정자만) 필터링 및 초과 인원 색출
  const participants = useMemo(() => applicants.filter(a => a.status === 'confirmed'), [applicants]);
  
  const overQuotaAppIds = useMemo(() => {
    const overIds = new Set<string>();
    if (!active) return overIds;

    const maleConfirmed = participants.filter(a => a.gender === 'male')
      .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());
    const femaleConfirmed = participants.filter(a => a.gender === 'female')
      .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());

    if (maleConfirmed.length > active.maxMale) {
      maleConfirmed.slice(active.maxMale).forEach(a => overIds.add(a.id));
    }
    if (femaleConfirmed.length > active.maxFemale) {
      femaleConfirmed.slice(active.maxFemale).forEach(a => overIds.add(a.id));
    }
    return overIds;
  }, [participants, active]);

  // v8.2.0: 선발 취소 (보류/검토 중으로 원복)
  const handleCancelSelection = async (app: Application) => {
    if (!window.confirm(`[${app.name}] 님의 선발을 취소하고 '검토 중' 상태로 변경하시겠습니까?`)) return;
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'applications', app.id), {
        status: 'applied',
        updatedAt: serverTimestamp()
      });
      toast.success('선발이 취소되었습니다.');
    } catch (e) {
      toast.error('오류가 발생했습니다.');
    }
  };

  const runMatching = async () => {
    if (!selectedId) return;
    const user = auth.currentUser;
    if (!user) return toast.error('인증이 필요합니다.');

    setIsMatching(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/sessions/${selectedId}/match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '매칭 오류');
      
      toast.success(`매칭 완료: ${data.stats.coupleCount}쌍이 성사되었습니다.`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsMatching(false);
    }
  };

  // 3. 수정 모드 진입
  const openEditModal = (session: Session) => {
    setEditingId(session.id);
    // v7.5.2: 기존 '90~96년생' 또는 '90년생~96년생' 문자열 파싱
    const ageString = session.targetMaleAge || '94~01년생';
    const ages = ageString.replace(/년생/g, '').split('~');
    const ageStart = ages[0]?.trim() || '';
    const ageEnd = ages[1]?.trim() || '';

    setFormData({
      region: session.region,
      episodeNumber: String(session.episodeNumber),
      eventDate: format(session.eventDate, 'yyyy-MM-dd'),
      eventTime: format(session.eventDate, 'HH:mm'),
      venue: session.venue || '서면역 인근 프라이빗한 파티룸',
      venueAddress: session.venueAddress || '',
      price: Number(session.price || 0).toLocaleString(), 
      ageStart,
      ageEnd,
      maxMale: String(session.maxMale),
      maxFemale: String(session.maxFemale),
      status: session.status
    });
    setIsModalOpen(true);
  };

  // v8.1.7: 투표 설정 모달 열기
  const openConfigModal = (session: Session) => {
    if (session.voteConfig) {
      setConfigFormData({
        maxSelection: session.voteConfig.maxSelection || 3,
        questionText: session.voteConfig.questionText || '오늘 가장 호감 갔던 이성을 3명까지 골라주세요.',
        showReason: !!session.voteConfig.showReason,
        resultVisibility: session.voteConfig.resultVisibility || 'all',
        q1Label: session.voteConfig.q1Label || '실명을 적어주세요',
        q2Label: session.voteConfig.q2Label || '본인의 호를 체크해주세요',
        q3Label: session.voteConfig.q3Label || '호감가는 이성 선택',
        q4Label: session.voteConfig.q4Label || '매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?',
        q5Label: session.voteConfig.q5Label || '후기',
      });
    } else {
      setConfigFormData({
        maxSelection: 3,
        questionText: '오늘 가장 호감 갔던 이성을 3명까지 골라주세요.',
        showReason: false,
        resultVisibility: 'all',
        q1Label: '실명을 적어주세요',
        q2Label: '본인의 호를 체크해주세요',
        q3Label: '호감가는 이성 선택',
        q4Label: '매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?',
        q5Label: '후기',
      });
    }
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedId) return;
    setIsConfigSaving(true);
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'sessions', selectedId), {
        voteConfig: configFormData
      });
      toast.success('설정이 저장되었습니다.');
      setIsConfigModalOpen(false);
    } catch (e) {
      toast.error('설정 저장 중 오류 발생');
    } finally {
      setIsConfigSaving(false);
    }
  };

  // 4. 삭제 처리
  const handleDeleteSession = async (id: string, name: string) => {
    if (!window.confirm(`[${name}] 정말 이 기수를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.`)) return;

    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'sessions', id));
      toast.success('기수가 삭제되었습니다.');
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      toast.error('삭제 중 오류 발생');
    }
  };

  // 5. 서버에 저장/수정 실행
  const handleSubmitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.episodeNumber || !formData.eventDate || !formData.venue) {
      toast.error('필수 항목을 모두 입력해 주세요.');
      return;
    }
    
    const [year, month, day] = formData.eventDate.split('-');
    const [h, m] = formData.eventTime.split(':');
    const combinedDate = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m));

    // v7.5.1: 콤마 제거 후 숫자로 변환
    const numericPrice = Number(formData.price.replace(/,/g, ''));
    // v7.5.2: 연령대 결합
    const combinedAge = `${formData.ageStart}~${formData.ageEnd}년생`;

    setIsSubmitting(true);
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      
      const payload = {
        region: formData.region,
        episodeNumber: Number(formData.episodeNumber),
        title: `${formData.region === 'busan' ? '부산' : '창원'} 로테이션 소개팅 ${formData.episodeNumber}기`,
        eventDate: combinedDate,
        venue: formData.venue,
        venueAddress: formData.venueAddress,
        price: numericPrice,
        originalPrice: numericPrice + 10000,
        targetMaleAge: combinedAge,
        targetFemaleAge: combinedAge, // 남성과 동일하게 설정
        maxMale: Number(formData.maxMale),
        maxFemale: Number(formData.maxFemale),
        status: formData.status,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        // v7.0.0: 수정(Update) 로직
        await updateDoc(doc(db, 'sessions', editingId), payload);
        toast.success('기수 정보가 수정되었습니다.');
      } else {
        // v7.0.0: 신규 등록 로직
        await addDoc(collection(db, 'sessions'), {
          ...payload,
          currentMale: 0,
          currentFemale: 0,
          votingUnlockedAt: null,
          createdAt: serverTimestamp()
        });
        toast.success('새 기수가 등록되었습니다.');
      }
      
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormData);
    } catch (err: any) {
      console.error(err);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-[#FF6F61]" size={32} />
      </div>
    );
  }

  // v8.2.0: globalCounts에서 실시간 집계 데이터 추출 (선발확정 + 입금대기 포함)
  const liveStats = globalCounts[selectedId || ''] || { male: 0, female: 0 };
  const liveConfirmedMale = liveStats.male;
  const liveConfirmedFemale = liveStats.female;
  const maleRatio = active ? Math.round((liveConfirmedMale / (active.maxMale || 1)) * 100) : 0;
  const femaleRatio = active ? Math.round((liveConfirmedFemale / (active.maxFemale || 1)) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900" style={{ fontSize: '1.2rem', fontWeight: 700 }}>행사 / 매칭 관리</h2>
          <p className="text-slate-500" style={{ fontSize: '0.85rem', marginTop: 4 }}>기수별 행사 현황과 매칭 알고리즘을 관리합니다.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData(initialFormData);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg transition-transform hover:scale-105"
          style={{ padding: '10px 18px', fontSize: '0.85rem', fontWeight: 600, background: '#FF6F61', color: '#fff', boxShadow: '0 4px 12px rgba(255,111,97,0.2)' }}
        >
          <Plus size={16} /> 새 기수 등록
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '전체 기수',  value: stats.total,        color: '#FF6F61' },
          { label: '모집 중',    value: stats.open,         color: '#10b981' },
          { label: '총 참가자',  value: stats.participants,  color: '#3b82f6' },
          { label: '평균 매칭률', value: `${stats.rate}%`,     color: '#ec4899' },
        ].map((s, i) => (
          <div key={i} style={{ ...panel, padding: '20px' }}>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6, fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* Event list */}
        <div className="xl:col-span-1 space-y-3">
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4 }}>
            기수 목록
          </p>
          <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            {sessions.map(ev => {
              // v8.2.0: 전역 applicants 데이터 기반 실시간 집계 (선발 + 확정 합산)
              const live = globalCounts[ev.id] || { male: 0, female: 0 };
              const total = live.male + live.female;
              const maxT = ev.maxMale + ev.maxFemale;
              const pct = maxT > 0 ? Math.min(100, Math.round((total / maxT) * 100)) : 0;
              const sel = selectedId === ev.id;
              const isOver = total > maxT; // v8.2.0 정원 초과 여부
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedId(ev.id)}
                  className="w-full text-left rounded-xl transition-all duration-150"
                  style={{
                    padding: '16px',
                    background: sel ? '#FFF5F4' : '#ffffff',
                    border: `1px solid ${sel ? '#ffc2bc' : '#e2e8f0'}`,
                    boxShadow: sel ? '0 4px 12px rgba(255,111,97,0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className={sel ? 'text-[#FF6F61]' : 'text-slate-800'} style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                      {ev.region === 'busan' ? '부산' : '창원'} {ev.episodeNumber}기
                    </p>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                      background: ev.status === 'open' ? '#dcfce7' : '#f1f5f9',
                      color:      ev.status === 'open' ? '#15803d' : '#64748b',
                    }}>
                      {ev.status === 'open' ? '모집 중' : ev.status === 'completed' ? '종료' : '진행 중'}
                    </span>
                  </div>
                  <p className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 12 }}>
                    <Calendar size={12} /> {format(ev.eventDate, 'MM. dd (E)', { locale: ko })}
                  </p>
                  <div className="flex justify-between mb-1.5" style={{ fontSize: '0.7rem', color: isOver ? '#ef4444' : '#475569', fontWeight: isOver ? 900 : 500 }}>
                    <span className={isOver ? 'animate-pulse' : ''}>{total} / {maxT}명</span>
                    <span style={{ color: isOver ? '#ef4444' : (sel ? '#FF6F61' : '#64748b') }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: isOver ? '#ef4444' : (sel ? '#FF6F61' : '#cbd5e1'), borderRadius: 4 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="xl:col-span-3 space-y-6">
          {active ? (
            <>
              {/* Event detail */}
              <div style={{ ...panel, padding: '28px' }}>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-slate-900" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                        {active.region === 'busan' ? '부산' : '창원'} {active.episodeNumber}기
                      </h3>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: 12,
                        background: active.status === 'open' ? '#dcfce7' : '#f1f5f9',
                        color:      active.status === 'open' ? '#15803d' : '#64748b',
                      }}>
                         {active.status === 'open' ? '모집 중' : active.status === 'completed' ? '종료' : '진행 중'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openEditModal(active)}
                      className="flex items-center gap-1.5 rounded-lg transition-colors px-4 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <Edit2 size={14} /> 수정
                    </button>
                    <button 
                      onClick={() => handleDeleteSession(active.id, `${active.region === 'busan' ? '부산' : '창원'} ${active.episodeNumber}기`)}
                      className="flex items-center gap-1.5 rounded-lg transition-colors px-4 py-2 bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {[
                    { label: '일시', value: `${format(active.eventDate, 'MM. dd (E) HH:mm', { locale: ko })}` },
                    { label: '장소', value: active.venue || '서면역 인근' },
                    { label: '참가비', value: `${(active.price || 29000).toLocaleString()}원` },
                  ].map(info => (
                    <div key={info.label} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '16px' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>{info.label}</p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>{info.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {[
                    { label: '남성 모집 현황', cur: liveConfirmedMale,   max: active.maxMale,   pct: maleRatio,   color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
                    { label: '여성 모집 현황', cur: liveConfirmedFemale, max: active.maxFemale, pct: femaleRatio, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
                  ].map(g => (
                    <div key={g.label} style={{ background: g.bg, border: `1px solid ${g.border}`, borderRadius: '12px', padding: '20px' }}>
                      <div className="flex justify-between mb-4">
                        <span className="flex items-center gap-2" style={{ fontSize: '0.85rem', fontWeight: 800, color: g.color }}>
                           <Users size={14} /> {g.label}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{g.cur} / {g.max}명</span>
                      </div>
                      <div style={{ height: 6, background: '#ffffff', borderRadius: 4, overflow: 'hidden', border: `1px solid ${g.border}` }}>
                        <div style={{ width: `${g.pct}%`, height: '100%', background: g.color, borderRadius: 3 }} />
                      </div>
                      <p style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 800, color: g.color, marginTop: 8 }}>{g.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matching Panel */}
              <div style={{ ...panel, padding: '28px' }}>
                <h3 className="flex items-center gap-2 mb-6" style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                  <Zap size={18} style={{ color: '#FF6F61' }} /> 매칭 알고리즘 가동 시스템
                </h3>
                
                {/* v8.1.7: 3컬럼 레이아웃 개편 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* 신규: 호감도 매칭 폼 제어 */}
                  <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 p-5 bg-indigo-50/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-indigo-100">
                        <Heart size={18} className="text-indigo-600" fill={active.status === 'voting' ? 'currentColor' : 'none'} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-extrabold text-indigo-900">호감도 매칭 폼</p>
                        <p className="text-[0.7rem] font-bold text-indigo-500 mt-0.5">상태: {active.status === 'voting' ? '열림 (Live)' : '닫힘 (Hidden)'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => toggleVotingForm(active.status === 'voting' ? 'closed' : 'voting')}
                        className={`flex-1 h-9 rounded-lg text-[0.75rem] font-black transition-all ${active.status === 'voting' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        {active.status === 'voting' ? '폼 닫기' : '폼 열기'}
                      </button>
                      <button 
                        onClick={() => openConfigModal(active)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-indigo-200 text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <ListChecks size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl" style={{ padding: '16px 20px', background: '#fefce8', border: '1px solid #fef08a' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#fef08a' }}>
                      <Users size={18} style={{ color: '#ca8a04' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ca8a04' }}>참가자 현황 검증</p>
                      <p style={{ fontSize: '0.75rem', color: '#a16207', marginTop: 2, fontWeight: 500 }}>총 {liveConfirmedMale + liveConfirmedFemale}명 참여 확인</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl" style={{ padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#bbf7d0' }}>
                      <CheckCircle size={18} style={{ color: '#16a34a' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#16a34a' }}>연산 클러스터 연결</p>
                      <p style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 2, fontWeight: 500 }}>API 정상 통합됨</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={runMatching}
                    disabled={isMatching || active.status === 'completed'}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-all h-14 bg-[#FF6F61] hover:bg-[#ff5746] text-white font-bold disabled:opacity-50 shadow-[0_4px_12px_rgba(255,111,97,0.25)]"
                  >
                    {isMatching ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                    가중치 기반 자동 매칭 시작
                  </button>
                  <Link
                    href={`/admin/sessions/${active.id}/matching`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white h-14 text-slate-700 font-bold hover:bg-slate-50 shadow-sm"
                  >
                    <Heart size={18} className="text-pink-500" /> 결과 상세 보기
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center" style={panel}>
              <p className="text-slate-400 font-medium">기수를 선택해 주세요.</p>
            </div>
          )}

          {/* v7.2.0: Applicant List Panel */}
          {active && (
            <div style={{ ...panel, overflow: 'hidden' }}>
              <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <h3 className="flex items-center gap-2 text-slate-800" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                  <ListChecks size={16} style={{ color: '#FF6F61' }} />
                  참가 명단
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: '#FFF5F4', color: '#FF6F61', marginLeft: 4 }}>
                    총 {participants.length}명 ({participants.filter(a => a.gender === 'male').length}남 / {participants.filter(a => a.gender === 'female').length}여)
                  </span>
                </h3>
                {applicantsLoading && <Loader2 className="animate-spin text-slate-400" size={16} />}
              </div>

              {applicants.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium text-sm">
                  {applicantsLoading ? '불러오는 중...' : '신청자가 없습니다.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['#', '이름', '성별', '연락처', '나이', '직업', '거주지', '상태', '관리'].map((h) => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: h === '관리' ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((app, idx) => {
                        const isMale = app.gender === 'male';
                        const isOverQuota = overQuotaAppIds.has(app.id); // v8.2.0
                        const statusMap: Record<string, { label: string; bg: string; color: string }> = {
                          applied:   { label: '검토 중',   bg: '#FFFBEB', color: '#92400E' },
                          selected:  { label: '입금 대기', bg: '#F5F3FF', color: '#5B21B6' },
                          confirmed: { label: '참가 확정', bg: '#ECFDF5', color: '#065F46' },
                          cancelled: { label: '취소',      bg: '#F1F5F9', color: '#64748b' },
                        };
                        const badge = statusMap[app.status] ?? { label: app.status, bg: '#F1F5F9', color: '#64748b' };
                        return (
                          <tr 
                            key={app.id} 
                            style={{ 
                              borderBottom: '1px solid #f1f5f9', 
                              // v8.2.0: 정원 초과 인원은 붉은색 배경 적용
                              background: isOverQuota ? '#FFE4E6' : (isMale ? 'rgba(59,130,246,0.02)' : 'rgba(236,72,153,0.02)') 
                            }}
                            className={isOverQuota ? 'animate-pulse' : ''}
                          >
                            <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>{app.name || '-'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: isMale ? '#EFF6FF' : '#FDF2F8', color: isMale ? '#1D4ED8' : '#BE185D' }}>
                                {isMale ? '남' : '여'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              <span className="flex items-center gap-1"><Phone size={11} />{app.phone || '-'}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                              {(() => {
                                const user = userMap[app.userId];
                                if (user?.birthDate) {
                                  return `${user.birthDate.includes('-') ? user.birthDate.slice(2,4) : user.birthDate.slice(0,2)}년생`;
                                }
                                if (!app.age) return '-';
                                const ageNum = Number(app.age);
                                // 나이가 50 미만이면 실제 '나이'로 판단하고 2026년 기준 '출생연도'로 계산
                                if (ageNum > 0 && ageNum < 50) {
                                  const birthYear = 2026 - ageNum;
                                  return `${String(birthYear).slice(-2)}년생`;
                                }
                                return `${String(app.age).padStart(2, '0')}년생`;
                              })()}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {app.job || '-'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>{app.residence || '-'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                                {badge.label}
                              </span>
                            </td>
                            {/* v8.2.0: 선발 취소 버튼 추가 */}
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button 
                                onClick={() => handleCancelSelection(app)}
                                className="px-2.5 py-1 rounded-lg text-[0.65rem] font-black bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                              >
                                {isOverQuota ? '🔴 선발 취소' : '선발 취소'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Past results */}
          <div style={{ ...panel, overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <h3 className="flex items-center gap-2 text-slate-800" style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                <BarChart3 size={16} style={{ color: '#3b82f6' }} /> 최근 매칭 스테이터스 통계
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['기수', '날짜', '상태'].map((h, i) => (
                    <th key={h} style={{
                      padding: '12px 28px', textAlign: 'left',
                      fontSize: '0.75rem', fontWeight: 700, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchingHistory.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td style={{ padding: '16px 28px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{r.episode}기</td>
                    <td style={{ padding: '16px 28px', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{r.date}</td>
                    <td style={{ padding: '16px 28px' }}>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'completed' ? '매칭 완료' : '진행 중'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* v8.1.7: 호감도 신청폼 세부 설정 모달 */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">호감도 신청폼 세부 설정</h3>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* 모집 정원 및 제한 */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">최대 선택 인원</p>
                    <p className="text-[0.75rem] text-slate-400">유저가 투표 시 고를 수 있는 최대 인원</p>
                  </div>
                  <input 
                    type="number" 
                    value={configFormData.maxSelection}
                    onChange={e => setConfigFormData({ ...configFormData, maxSelection: Number(e.target.value) })}
                    className="w-16 h-10 text-center rounded-lg border border-slate-200 font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
              </section>

              {/* 네이버 폼 커스텀 문항 */}
              <section className="space-y-6">
                <p className="text-[0.75rem] font-bold text-indigo-500 uppercase tracking-widest">네이버 폼 문항 커스터마이징</p>
                
                <div className="space-y-4">
                  {[
                    { key: 'q1Label', label: '1번 문항 (실명 확인)', placeholder: '실명을 적어주세요' },
                    { key: 'q2Label', label: '2번 문항 (본인 호수)', placeholder: '본인의 호를 체크해주세요' },
                    { key: 'q3Label', label: '3번 문항 (이성 선택 메인)', placeholder: '호감가는 이성 선택' },
                    { key: 'q4Label', label: '4번 문항 (최종 확인 체크)', placeholder: '최종 라인업 확인 및 확인 체크' },
                    { key: 'q5Label', label: '5번 문항 (후기 작성)', placeholder: '후기' },
                  ].map(q => (
                    <div key={q.key}>
                      <label className="block text-[0.7rem] font-black text-slate-400 mb-1.5">{q.label}</label>
                      <input 
                        type="text" 
                        value={(configFormData as any)[q.key] || ''}
                        onChange={e => setConfigFormData({ ...configFormData, [q.key]: e.target.value })}
                        placeholder={q.placeholder}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                    </div>
                  ))}
                  
                  <div>
                    <label className="block text-[0.7rem] font-black text-slate-400 mb-1.5">3번 문항 서브 설명 (질문 문구)</label>
                    <textarea 
                      value={configFormData.questionText}
                      onChange={e => setConfigFormData({ ...configFormData, questionText: e.target.value })}
                      rows={2}
                      placeholder="투표 페이지 3번 문항 안내 문구"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* 선택 사유 활성화 */}
              <section className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">선택 사유 입력 여부</p>
                  <p className="text-[0.75rem] text-slate-400">호감 표시와 함께 짧은 코멘트 허용</p>
                </div>
                <button 
                  onClick={() => setConfigFormData({ ...configFormData, showReason: !configFormData.showReason })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${configFormData.showReason ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${configFormData.showReason ? 'left-6' : 'left-1'}`} />
                </button>
              </section>

              {/* 결과 공개 로직 */}
              <section className="space-y-4">
                <p className="text-sm font-bold text-slate-700">결과 공개 로직 설정</p>
                <div className="space-y-2">
                  {[
                    { id: 'all', label: '나를 선택한 사람 모두 공개' },
                    { id: 'mutual', label: '맞호감(매칭 성공)인 경우만 공개' }
                  ].map(opt => (
                    <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="radio" 
                        name="visibility" 
                        checked={configFormData.resultVisibility === opt.id}
                        onChange={() => setConfigFormData({ ...configFormData, resultVisibility: opt.id as any })}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-slate-600">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setIsConfigModalOpen(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSaveConfig}
                disabled={isConfigSaving}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {isConfigSaving ? '저장 중...' : '설정 저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Session Config Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? '기수 정보 수정' : '새 기수 등록 시스템'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                  setFormData(initialFormData);
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitSession} className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Region & Episode */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">지역 선택</label>
                    <select 
                      value={formData.region} 
                      onChange={e => setFormData({ ...formData, region: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    >
                      <option value="busan">부산 (Busan)</option>
                      <option value="changwon">창원 (Changwon)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">기수 번호 (숫자)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="예: 121"
                      value={formData.episodeNumber} 
                      onChange={e => setFormData({ ...formData, episodeNumber: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">행사 일자</label>
                    <input 
                      type="date" 
                      required
                      value={formData.eventDate} 
                      onChange={e => setFormData({ ...formData, eventDate: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">시작 시간</label>
                    <input 
                      type="time" 
                      required
                      value={formData.eventTime} 
                      onChange={e => setFormData({ ...formData, eventTime: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Venue */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">장소</label>
                    <select 
                      value={formData.venue} 
                      onChange={e => setFormData({ ...formData, venue: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    >
                      <option value="서면역 인근 프라이빗한 파티룸">서면역 인근 프라이빗한 파티룸</option>
                      <option value="상남동 프라이빗한 파티룸 (창원)">상남동 프라이빗한 파티룸 (창원)</option>
                      <option value="추가 장소 필요시 입력">추가 장소 필요시 입력...</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">참가비 (원)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="예: 29,000"
                      value={formData.price} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setFormData({ ...formData, price: val ? Number(val).toLocaleString() : '' });
                      }}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Target Age */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">남성 연령대</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        required
                        maxLength={2}
                        placeholder="94"
                        value={formData.ageStart} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormData({ ...formData, ageStart: val });
                          if (val.length === 2 && ageEndRef.current) {
                            ageEndRef.current.focus();
                          }
                        }}
                        className="w-16 h-11 text-center rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                      />
                      <span className="text-slate-300 font-bold">~</span>
                      <input 
                        type="text" 
                        required
                        maxLength={2}
                        ref={ageEndRef}
                        placeholder="01"
                        value={formData.ageEnd} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormData({ ...formData, ageEnd: val });
                        }}
                        className="w-16 h-11 text-center rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                      />
                      <span className="text-slate-400 text-sm font-bold ml-1">년생</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Capacities */}
              <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-100 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide text-center">초기 상태</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value as SessionStatus })}
                    className="w-full h-10 text-center rounded-lg border border-slate-300 bg-white text-slate-800 font-bold focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none"
                  >
                    <option value="open">모집 중 (게시됨)</option>
                    <option value="closed">모집 마감</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide text-center">남성 정원</label>
                  <input 
                    type="number" 
                    required
                    value={formData.maxMale} 
                    onChange={e => setFormData({ ...formData, maxMale: e.target.value })}
                    className="w-full h-10 text-center px-4 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide text-center">여성 정원</label>
                  <input 
                    type="number" 
                    required
                    value={formData.maxFemale} 
                    onChange={e => setFormData({ ...formData, maxFemale: e.target.value })}
                    className="w-full h-10 text-center px-4 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-12 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] h-12 rounded-xl font-bold text-white bg-[#FF6F61] hover:bg-[#ff5746] shadow-[0_4px_12px_rgba(255,111,97,0.25)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                  데이터베이스에 기수 등록 반영
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

