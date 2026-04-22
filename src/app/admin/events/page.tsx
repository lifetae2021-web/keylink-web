'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, MapPin, Users, Heart,
  Plus, Edit2, Trash2, Play,
  CheckCircle, Clock, RefreshCw, ChevronRight, Zap, BarChart3,
  Loader2
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Session, MatchingResult } from '@/lib/types';
import Link from 'next/link';

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 };

export default function EventsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matchingHistory, setMatchingHistory] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);

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
  }, []);

  // 2. 매칭 히스토리 로드 (간이 통계용)
  useEffect(() => {
    // 실제로는 matchingResults를 집계해야 하지만, 가독성을 위해 최근 완료된 세션 기반으로 표시
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
    const totalParticipants = sessions.reduce((sum, s) => sum + (s.currentMale || 0) + (s.currentFemale || 0), 0);
    return {
      total: sessions.length,
      open: openCount,
      participants: totalParticipants,
      rate: 75 // Mock rate for header
    };
  }, [sessions]);

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

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-[#FF6F61]" size={32} />
      </div>
    );
  }

  const maleRatio = active ? Math.round(((active.currentMale || 0) / active.maxMale) * 100) : 0;
  const femaleRatio = active ? Math.round(((active.currentFemale || 0) / active.maxFemale) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>행사 / 매칭 관리</h2>
          <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>기수별 행사 현황과 매칭 알고리즘을 관리합니다.</p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg transition-colors"
          style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, background: '#FF6F61', color: '#fff' }}
        >
          <Plus size={14} /> 새 기수 등록
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '전체 기수',  value: stats.total,        color: '#FF6F61' },
          { label: '모집 중',    value: stats.open,         color: '#4ade80' },
          { label: '총 참가자',  value: stats.participants,  color: '#60a5fa' },
          { label: '평균 매칭률', value: `${stats.rate}%`,     color: '#f472b6' },
        ].map((s, i) => (
          <div key={i} style={{ ...panel, padding: '16px 20px' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: '#555', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* Event list */}
        <div className="xl:col-span-1 space-y-2">
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            기수 목록
          </p>
          {sessions.map(ev => {
            const total = (ev.currentMale || 0) + (ev.currentFemale || 0);
            const maxT = ev.maxMale + ev.maxFemale;
            const pct = Math.round((total / maxT) * 100);
            const sel = selectedId === ev.id;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedId(ev.id)}
                className="w-full text-left rounded-xl transition-all duration-150"
                style={{
                  padding: '14px 16px',
                  background: sel ? 'rgba(255,111,97,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${sel ? 'rgba(255,111,97,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <p style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    {ev.region === 'busan' ? '부산' : '창원'} {ev.episodeNumber}기
                  </p>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                    background: ev.status === 'open' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                    color:      ev.status === 'open' ? '#4ade80'              : '#555',
                  }}>
                    {ev.status === 'open' ? '모집 중' : ev.status === 'completed' ? '종료' : '진행 중'}
                  </span>
                </div>
                <p className="flex items-center gap-1" style={{ fontSize: '0.72rem', color: '#555', marginBottom: 10 }}>
                  <Calendar size={10} /> {format(ev.eventDate, 'MM. dd (E)', { locale: ko })}
                </p>
                <div className="flex justify-between mb-1" style={{ fontSize: '0.68rem', color: '#444' }}>
                  <span>{total} / {maxT}명</span>
                  <span style={{ color: sel ? '#FF6F61' : '#444' }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: sel ? '#FF6F61' : '#333', borderRadius: 3 }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="xl:col-span-3 space-y-5">
          {active ? (
            <>
              {/* Event detail */}
              <div style={{ ...panel, padding: '24px' }}>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {active.region === 'busan' ? '부산' : '창원'} {active.episodeNumber}기
                      </h3>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: active.status === 'open' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                        color:      active.status === 'open' ? '#4ade80'              : '#555',
                      }}>
                         {active.status === 'open' ? '모집 중' : active.status === 'completed' ? '종료' : '진행 중'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-1.5 rounded-lg transition-colors px-3 py-1.5 bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white"
                    >
                      <Edit2 size={12} /> 수정
                    </button>
                    <button
                      className="flex items-center gap-1.5 rounded-lg transition-colors px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-500 hover:bg-rose-500/20"
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  {[
                    { label: '일시', value: `${format(active.eventDate, 'MM. dd (E)', { locale: ko })}` },
                  ].map(info => (
                    <div key={info.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 14px' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{info.label}</p>
                      <p style={{ fontSize: '0.83rem', fontWeight: 600, color: '#ddd' }}>{info.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: '남성', cur: active.currentMale,   max: active.maxMale,   pct: maleRatio,   color: '#60a5fa' },
                    { label: '여성', cur: active.currentFemale, max: active.maxFemale, pct: femaleRatio, color: '#f472b6' },
                  ].map(g => (
                    <div key={g.label} style={{ background: `${g.color}08`, border: `1px solid ${g.color}18`, borderRadius: 10, padding: '14px 16px' }}>
                      <div className="flex justify-between mb-2">
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: g.color }}>{g.label}</span>
                        <span style={{ fontSize: '0.75rem', color: '#555' }}>{g.cur} / {g.max}명</span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${g.pct}%`, height: '100%', background: g.color, borderRadius: 4 }} />
                      </div>
                      <p style={{ textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: g.color, marginTop: 4 }}>{g.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matching */}
              <div style={{ ...panel, padding: '24px' }}>
                <h3 className="flex items-center gap-2 mb-4" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  <Zap size={15} style={{ color: '#FF6F61' }} /> 매칭 알고리즘
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div className="flex items-center gap-3 rounded-xl" style={{ padding: '14px 16px', background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.12)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(250,204,21,0.1)' }}>
                      <Users size={16} style={{ color: '#facc15' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#facc15' }}>참가자 현황</p>
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 1 }}>총 {(active.currentMale || 0) + (active.currentFemale || 0)}명 참여 중</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl" style={{ padding: '14px 16px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(74,222,128,0.1)' }}>
                      <CheckCircle size={16} style={{ color: '#4ade80' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4ade80' }}>연산 준비 완료</p>
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 1 }}>서버 API 연결됨</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={runMatching}
                    disabled={isMatching || active.status === 'completed'}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-all h-12 bg-[#FF6F61] text-white font-bold disabled:opacity-50"
                  >
                    {isMatching ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} fill="currentColor" />}
                    매칭 알고리즘 가동
                  </button>
                  <Link
                    href={`/admin/sessions/${active.id}/matching`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 h-12 text-gray-400 font-bold hover:text-white"
                  >
                    <Heart size={16} className="text-pink-400" /> 결과 상세 보기
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center" style={panel}>
              <p className="text-gray-500">기수를 선택해 주세요.</p>
            </div>
          )}

          {/* Past results */}
          <div style={{ ...panel, overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="flex items-center gap-2" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                <BarChart3 size={15} style={{ color: '#60a5fa' }} /> 최근 매칭 스테이터스
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['기수', '날짜', '상태'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 24px', textAlign: 'left',
                      fontSize: '0.7rem', fontWeight: 600, color: '#444',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchingHistory.map(r => (
                  <tr key={r.id} className="hover:bg-white/[0.02] border-b border-white/[0.03]">
                    <td style={{ padding: '13px 24px', fontSize: '0.88rem', fontWeight: 700 }}>{r.episode}기</td>
                    <td style={{ padding: '13px 24px', fontSize: '0.8rem', color: '#666' }}>{r.date}</td>
                    <td style={{ padding: '13px 24px' }}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
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
    </div>
  );
}
