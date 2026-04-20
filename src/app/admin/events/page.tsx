'use client';

import { useState } from 'react';
import {
  Calendar, MapPin, Users, Heart,
  Plus, Edit2, Trash2, Play,
  CheckCircle, Clock, RefreshCw,
  ChevronRight, Zap, TrendingUp, BarChart3
} from 'lucide-react';
import { mockEvents, mockMatchingResults } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function EventsManagementPage() {
  const [selectedEventId, setSelectedEventId] = useState(mockEvents[0].id);
  const [isMatching, setIsMatching] = useState(false);

  const activeEvent = mockEvents.find(e => e.id === selectedEventId) ?? mockEvents[0];
  const totalParticipants = mockEvents.reduce((s, e) => s + e.currentMale + e.currentFemale, 0);
  const openCount = mockEvents.filter(e => e.status === 'open').length;

  const handleRunMatching = async () => {
    setIsMatching(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsMatching(false);
    toast.success('매칭 연산이 완료되었습니다. 결과를 검토해 주세요.');
  };

  const maleRatio = Math.round((activeEvent.currentMale / activeEvent.maxMale) * 100);
  const femaleRatio = Math.round((activeEvent.currentFemale / activeEvent.maxFemale) * 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">행사 / 매칭 관리</h1>
          <p className="text-gray-500 text-sm mt-1">기수별 행사 현황과 매칭 알고리즘을 관리합니다.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6F61] hover:bg-[#e85d50] text-white rounded-xl text-sm font-bold transition-colors self-start sm:self-auto">
          <Plus size={15} /> 새 기수 등록
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '전체 기수', value: mockEvents.length, icon: Calendar, color: '#FF6F61', bg: 'rgba(255,111,97,0.08)' },
          { label: '모집 중', value: openCount, icon: Zap, color: '#6EAE7C', bg: 'rgba(110,174,124,0.08)' },
          { label: '총 참가자', value: totalParticipants, icon: Users, color: '#6A98C8', bg: 'rgba(106,152,200,0.08)' },
          { label: '최근 매칭률', value: `${mockMatchingResults[0].matchingRate}%`, icon: Heart, color: '#C878A0', bg: 'rgba(200,120,160,0.08)' },
        ].map((s, i) => (
          <div key={i} className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-all">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
              <s.icon size={17} style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-extrabold text-white">{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* Event List */}
        <div className="xl:col-span-1 space-y-3">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider px-1">기수 목록</p>
          {mockEvents.map((ev) => {
            const isSelected = selectedEventId === ev.id;
            const total = ev.currentMale + ev.currentFemale;
            const maxTotal = ev.maxMale + ev.maxFemale;
            const fillPct = Math.round((total / maxTotal) * 100);
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 ${
                  isSelected
                    ? 'bg-[#FF6F61]/10 border-[#FF6F61]/30'
                    : 'bg-[#1A1D23] border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-extrabold text-white">
                    {ev.region === 'busan' ? '부산' : '창원'} {ev.episode}기
                  </p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    ev.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'
                  }`}>
                    {ev.status === 'open' ? '모집 중' : '종료'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                  <Calendar size={11} /> {format(ev.date, 'MM. dd (E)', { locale: ko })}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1.5">
                  <span>{total}명 / {maxTotal}명</span>
                  <span className={isSelected ? 'text-[#FF6F61]' : ''}>{fillPct}%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: isSelected ? '#FF6F61' : '#4B5563'
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Panel */}
        <div className="xl:col-span-3 space-y-5">

          {/* Event Detail */}
          <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-extrabold text-white">
                    {activeEvent.region === 'busan' ? '부산' : '창원'} {activeEvent.episode}기
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeEvent.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {activeEvent.status === 'open' ? '모집 중' : '종료'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{activeEvent.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors">
                  <Edit2 size={13} /> 수정
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/15 text-red-400 rounded-lg text-xs font-bold transition-colors">
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-gray-900/50 rounded-xl p-3.5 border border-gray-800/60">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-1.5">일시</p>
                <p className="text-xs text-gray-200 font-semibold leading-relaxed">
                  {format(activeEvent.date, 'MM. dd (E)', { locale: ko })}<br />
                  {activeEvent.time}
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-3.5 border border-gray-800/60">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-1.5">장소</p>
                <p className="text-xs text-gray-200 font-semibold">{activeEvent.venue}</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-3.5 border border-gray-800/60">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-1.5">참가비</p>
                <p className="text-xs text-gray-200 font-semibold">₩{activeEvent.price.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-3.5 border border-gray-800/60">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-1.5">연령대</p>
                <p className="text-xs text-gray-200 font-semibold">{activeEvent.targetMaleAge}년생</p>
              </div>
            </div>

            {/* Capacity Bars */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-400">남성</span>
                  <span className="text-xs text-gray-500">{activeEvent.currentMale} / {activeEvent.maxMale}명</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${maleRatio}%` }} />
                </div>
                <p className="text-right text-[11px] text-blue-400 font-bold mt-1">{maleRatio}%</p>
              </div>
              <div className="bg-pink-500/5 rounded-xl p-4 border border-pink-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-pink-400">여성</span>
                  <span className="text-xs text-gray-500">{activeEvent.currentFemale} / {activeEvent.maxFemale}명</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-400 rounded-full transition-all" style={{ width: `${femaleRatio}%` }} />
                </div>
                <p className="text-right text-[11px] text-pink-400 font-bold mt-1">{femaleRatio}%</p>
              </div>
            </div>
          </div>

          {/* Matching Section */}
          <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Zap size={16} className="text-[#FF6F61]" /> 매칭 알고리즘
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Clock size={18} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-yellow-400">순위 입력 진행 중</p>
                  <p className="text-xs text-gray-500 mt-0.5">16명 중 11명 완료 (68%)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle size={18} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-400">알고리즘 준비 완료</p>
                  <p className="text-xs text-gray-500 mt-0.5">최소 정원 및 데이터 충족</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRunMatching}
                disabled={isMatching}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#FF6F61] hover:bg-[#e85d50] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {isMatching
                  ? <><RefreshCw className="animate-spin" size={16} /> 연산 중...</>
                  : <><Play size={16} fill="currentColor" /> 매칭 알고리즘 가동</>
                }
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-sm transition-colors border border-gray-700">
                <Heart size={16} className="text-pink-400" /> 결과 미리보기
              </button>
            </div>
          </div>

          {/* Past Matching Results */}
          <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 size={16} className="text-[#6A98C8]" /> 최근 매칭 결과
              </h3>
              <button className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                전체 보기 <ChevronRight size={13} />
              </button>
            </div>
            <div className="space-y-3">
              {mockMatchingResults.map((res) => (
                <div key={res.id} className="flex items-center gap-4 p-3.5 bg-gray-900/40 rounded-xl border border-gray-800/60 hover:border-gray-700 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[#FF6F61]/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-extrabold text-[#FF6F61]">{res.episode}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-white">{res.episode}기</p>
                      {res.labels.map((label, i) => (
                        <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 bg-[#FF6F61]/10 text-[#FF6F61] rounded-full">
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">{res.date} · {res.totalParticipants}명 참가 · {res.coupleCount}쌍 성사</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-white">{res.matchingRate}%</p>
                    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${res.matchingRate}%`,
                          backgroundColor: res.matchingRate >= 80 ? '#6EAE7C' : res.matchingRate >= 60 ? '#FF6F61' : '#6A98C8'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
