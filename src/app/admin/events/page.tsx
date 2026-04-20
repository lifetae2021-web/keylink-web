'use client';

import { useState } from 'react';
import {
  Calendar, MapPin, Users, Heart,
  Plus, Edit2, Trash2, Play,
  CheckCircle, Clock, RefreshCw, ChevronRight, Zap, BarChart3
} from 'lucide-react';
import { mockEvents, mockMatchingResults } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 };

export default function EventsPage() {
  const [selectedId, setSelectedId]   = useState(mockEvents[0].id);
  const [isMatching, setIsMatching]   = useState(false);

  const active = mockEvents.find(e => e.id === selectedId) ?? mockEvents[0];
  const maleRatio   = Math.round((active.currentMale   / active.maxMale)   * 100);
  const femaleRatio = Math.round((active.currentFemale / active.maxFemale) * 100);

  const runMatching = async () => {
    setIsMatching(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsMatching(false);
    toast.success('매칭 연산이 완료되었습니다. 결과를 검토해 주세요.');
  };

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
          onMouseEnter={e => (e.currentTarget.style.background = '#e85d50')}
          onMouseLeave={e => (e.currentTarget.style.background = '#FF6F61')}
        >
          <Plus size={14} /> 새 기수 등록
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '전체 기수',  value: mockEvents.length,                              color: '#FF6F61' },
          { label: '모집 중',    value: mockEvents.filter(e => e.status === 'open').length, color: '#4ade80' },
          { label: '총 참가자',  value: mockEvents.reduce((s, e) => s + e.currentMale + e.currentFemale, 0), color: '#60a5fa' },
          { label: '최근 매칭률', value: `${mockMatchingResults[0].matchingRate}%`,      color: '#f472b6' },
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
          {mockEvents.map(ev => {
            const total   = ev.currentMale + ev.currentFemale;
            const maxT    = ev.maxMale + ev.maxFemale;
            const pct     = Math.round((total / maxT) * 100);
            const sel     = selectedId === ev.id;
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
                    {ev.region === 'busan' ? '부산' : '창원'} {ev.episode}기
                  </p>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                    background: ev.status === 'open' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                    color:      ev.status === 'open' ? '#4ade80'              : '#555',
                  }}>
                    {ev.status === 'open' ? '모집 중' : '종료'}
                  </span>
                </div>
                <p className="flex items-center gap-1" style={{ fontSize: '0.72rem', color: '#555', marginBottom: 10 }}>
                  <Calendar size={10} /> {format(ev.date, 'MM. dd (E)', { locale: ko })}
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

          {/* Event detail */}
          <div style={{ ...panel, padding: '24px' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {active.region === 'busan' ? '부산' : '창원'} {active.episode}기
                  </h3>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: active.status === 'open' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                    color:      active.status === 'open' ? '#4ade80'              : '#555',
                  }}>
                    {active.status === 'open' ? '모집 중' : '종료'}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#555' }}>{active.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-lg transition-colors"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#888')}
                >
                  <Edit2 size={12} /> 수정
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg transition-colors"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}
                >
                  <Trash2 size={12} /> 삭제
                </button>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: '일시',   value: `${format(active.date, 'MM. dd (E)', { locale: ko })} ${active.time}` },
                { label: '장소',   value: active.venue },
                { label: '참가비', value: `₩${active.price.toLocaleString()}` },
                { label: '연령대', value: `${active.targetMaleAge}년생` },
              ].map(info => (
                <div key={info.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 14px' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{info.label}</p>
                  <p style={{ fontSize: '0.83rem', fontWeight: 600, color: '#ddd' }}>{info.value}</p>
                </div>
              ))}
            </div>

            {/* Capacity bars */}
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
                  <Clock size={16} style={{ color: '#facc15' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#facc15' }}>순위 입력 진행 중</p>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 1 }}>16명 중 11명 완료 (68%)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl" style={{ padding: '14px 16px', background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(74,222,128,0.1)' }}>
                  <CheckCircle size={16} style={{ color: '#4ade80' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4ade80' }}>알고리즘 준비 완료</p>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 1 }}>최소 정원 및 데이터 충족</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={runMatching}
                disabled={isMatching}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-all"
                style={{ padding: '13px', fontSize: '0.88rem', fontWeight: 700, background: '#FF6F61', color: '#fff', opacity: isMatching ? 0.6 : 1 }}
                onMouseEnter={e => { if (!isMatching) (e.currentTarget.style.background = '#e85d50'); }}
                onMouseLeave={e => { (e.currentTarget.style.background = '#FF6F61'); }}
              >
                {isMatching
                  ? <><RefreshCw className="animate-spin" size={16} /> 연산 중...</>
                  : <><Play size={16} fill="currentColor" /> 매칭 알고리즘 가동</>
                }
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 rounded-xl transition-colors"
                style={{ padding: '13px', fontSize: '0.88rem', fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
                onMouseLeave={e => (e.currentTarget.style.color = '#888')}
              >
                <Heart size={16} style={{ color: '#f472b6' }} /> 결과 미리보기
              </button>
            </div>
          </div>

          {/* Past results */}
          <div style={{ ...panel, overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="flex items-center gap-2" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                <BarChart3 size={15} style={{ color: '#60a5fa' }} /> 최근 매칭 결과
              </h3>
              <button className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: '#555' }}>
                전체 보기 <ChevronRight size={12} />
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['기수', '날짜', '참가자', '성사 커플', '매칭률'].map((h, i) => (
                    <th key={h} style={{
                      padding: '10px 24px', textAlign: i === 4 ? 'right' : 'left',
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
                {mockMatchingResults.map(r => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '13px 24px' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{r.episode}기</span>
                        {r.labels.map((lb, i) => (
                          <span key={i} style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'rgba(255,111,97,0.1)', color: '#FF6F61' }}>
                            {lb}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '13px 24px', fontSize: '0.8rem', color: '#666' }}>{r.date}</td>
                    <td style={{ padding: '13px 24px', fontSize: '0.85rem', color: '#bbb' }}>{r.totalParticipants}명</td>
                    <td style={{ padding: '13px 24px', fontSize: '0.85rem', color: '#bbb' }}>{r.coupleCount}쌍</td>
                    <td style={{ padding: '13px 24px', textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-3">
                        <div style={{ width: 64, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${r.matchingRate}%`, height: '100%', borderRadius: 4,
                            background: r.matchingRate >= 80 ? '#4ade80' : r.matchingRate >= 60 ? '#FF6F61' : '#60a5fa',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{r.matchingRate}%</span>
                      </div>
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
