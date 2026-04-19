'use client';

import { useState } from 'react';
import { 
  Calendar, MapPin, Users, Heart, 
  Plus, Edit, Trash2, Play, 
  CheckCircle, Clock, AlertCircle, RefreshCw,
  MoreVertical, ArrowRight
} from 'lucide-react';
import { mockEvents } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function EventsManagementPage() {
  const [selectedEventId, setSelectedEventId] = useState(mockEvents[0].id);
  const [isMatching, setIsMatching] = useState(false);

  const activeEvent = mockEvents.find(e => e.id === selectedEventId) || mockEvents[0];

  const handleRunMatching = async () => {
    setIsMatching(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsMatching(false);
    toast.success('✅ 매칭 연산이 완료되었습니다! 결과를 검토해 주세요.');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-[#6EAE7C]" size={24} /> 행사 및 매칭 관리
          </h1>
          <p className="text-gray-400 text-sm mt-1">기수별 행사 등록과 매칭 알고리즘을 실행합니다.</p>
        </div>
        <button className="kl-btn-primary flex items-center gap-2 px-5 py-2.5">
          <Plus size={18} /> 새 행사 기수 등록
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Left: Event List Sidebar */}
        <div className="xl:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-2">최근 기수 목록</h2>
          <div className="space-y-2">
            {mockEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedEventId === ev.id 
                    ? 'bg-gradient-to-r from-[#FF6F61]/10 to-transparent border-[#FF6F61]/30 ring-1 ring-[#FF6F61]/20' 
                    : 'bg-[#1A1D23] border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ev.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                  }`}>
                    {ev.status === 'open' ? '모집 중' : '종료'}
                  </span>
                  <span className="text-xs text-gray-500">{format(ev.date, 'MM/dd')}</span>
                </div>
                <p className="font-bold text-white text-sm">{ev.region === 'busan' ? '부산' : '창원'} {ev.episode}기</p>
                <div className="flex gap-3 mt-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><Users size={12} /> {ev.currentMale + ev.currentFemale}명</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {ev.venue}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Event Detail & Matching */}
        <div className="xl:col-span-3 space-y-6">
          {/* Detailed Info Card */}
          <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-6 lg:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6">
              <button className="p-2 text-gray-500 hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-extrabold text-white">{activeEvent.region === 'busan' ? '부산' : '창원'} {activeEvent.episode}기</h3>
                  <span className="px-3 py-1 bg-gradient-to-r from-[#6A98C8]/20 to-[#FF6F61]/20 border border-white/10 rounded-full text-xs font-bold text-white">
                    {activeEvent.title}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 text-gray-400">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">일시</p>
                      <p className="text-sm text-gray-200">{format(activeEvent.date, 'yyyy. MM. dd (E) HH:mm', { locale: ko })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 text-gray-400">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">장소</p>
                      <p className="text-sm text-gray-200">{activeEvent.venue}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 text-[#6A98C8]">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">남성 신청</p>
                      <p className="text-sm text-white font-bold">{activeEvent.currentMale} <span className="text-gray-600 font-normal">/ {activeEvent.maxMale}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 text-[#FF6F61]">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">여성 신청</p>
                      <p className="text-sm text-white font-bold">{activeEvent.currentFemale} <span className="text-gray-600 font-normal">/ {activeEvent.maxFemale}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex md:flex-col gap-3 justify-end">
                <button className="flex-1 md:flex-none kl-btn-secondary px-6 py-2.5 text-sm flex items-center justify-center gap-2">
                  <Edit size={16} /> 행사 수정
                </button>
                <button className="flex-1 md:flex-none border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            </div>
          </div>

          {/* Matching Management Section */}
          <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#FF6F61]/5 to-[#E6E6FA]/5 rounded-full blur-3xl -mr-32 -mt-32 transition-all group-hover:bg-[#FF6F61]/10"></div>
            
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-2 h-6 bg-[#FF6F61] rounded-full"></div>
                Matching Algorithm
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div className="p-5 bg-[#0F1115] rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-300 font-bold">참여자 순위 입력</p>
                      <p className="text-xs text-gray-500 mt-1">16명 중 11명 완료 (68%)</p>
                    </div>
                  </div>
                  <div className="p-5 bg-green-500/5 rounded-2xl border border-green-500/10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-green-400 font-bold">알고리즘 준비 완료</p>
                      <p className="text-xs text-green-500/70 mt-1">최소 정원 및 순위 데이터 충족</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/40 p-6 rounded-2xl border border-gray-800">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-4">운영 가이드</p>
                  <ul className="space-y-3">
                    {[
                      '당일 자정까지 참여자 순위 마감 권장',
                      '매칭 알고리즘 실행 후 최종 확정 버튼 필수',
                      '확정 직후 전송되는 알림톡 확인'
                    ].map((guide, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                        <ArrowRight size={14} className="mt-1 text-[#FF6F61]" /> {guide}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-800/50">
                <button 
                  onClick={handleRunMatching}
                  disabled={isMatching}
                  className="flex-1 bg-gradient-to-r from-[#FF6F61] to-[#E6E6FA] text-white font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isMatching ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                  매칭 알고리즘 가동
                </button>
                <button className="flex-1 bg-gray-800 text-white font-bold py-4 rounded-xl border border-gray-700 hover:bg-gray-700 transition-all flex items-center justify-center gap-3">
                  <Heart size={20} className="text-[#FF6F61]" /> 매칭 결과 미리보기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
