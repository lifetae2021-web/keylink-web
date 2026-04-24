'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, updateDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore';
import { Session } from '@/lib/types';
import { Clock, Users, Play, Square, RotateCcw, Volume2, Save, ExternalLink, RefreshCw, AlertCircle, FastForward, Rewind, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

type RelativeBlock = {
  id: string;
  type: 'talk' | 'break';
  roundNum?: number;
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
};

export default function AdminTimerPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const [totalRounds, setTotalRounds] = useState(8);
  const [talkTime, setTalkTime] = useState(15); // minutes
  const [cakeRound, setCakeRound] = useState(4);
  const [totalTables, setTotalTables] = useState(8);
  
  const [customMaleId, setCustomMaleId] = useState<number | ''>('');
  const [customTableId, setCustomTableId] = useState<number | ''>('');

  const [eventStartMs, setEventStartMs] = useState<number | null>(null);
  const [currentElapsedMs, setCurrentElapsedMs] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [viewMode, setViewMode] = useState<'schedule' | 'map'>('schedule');

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const played1MinBeepRef = useRef<Record<string, boolean>>({});
  const playedEndBeepRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    async function loadSessions() {
      const snap = await getDocs(query(collection(db, 'sessions'), orderBy('eventDate', 'desc')));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          region: data.region,
          episodeNumber: data.episodeNumber,
          eventDate: data.eventDate instanceof Timestamp ? data.eventDate.toDate() : new Date(),
          timerConfig: data.timerConfig,
          status: data.status,
        } as any;
      });
      setSessions(list);
      // Auto select the first open session
      const openSession = list.find((s: any) => s.status === 'open');
      if (openSession) handleSelectSession(openSession.id, list);
    }
    loadSessions();
  }, []);

  const handleSelectSession = (id: string, list = sessions) => {
    setSelectedSessionId(id);
    const session = list.find(s => s.id === id);
    if (session?.timerConfig) {
      setTotalRounds(session.timerConfig.totalRounds || 8);
      setTalkTime(session.timerConfig.talkTime || 15);
      setCakeRound(session.timerConfig.cakeRound || 4);
      setTotalTables(session.timerConfig.totalTables || 8);
      if (session.timerConfig.startMs) {
        setEventStartMs(session.timerConfig.startMs);
        setIsLive(true);
      } else {
        setEventStartMs(null);
        setIsLive(false);
      }
    } else {
      setEventStartMs(null);
      setIsLive(false);
    }
  };

  // Timer Tick
  useEffect(() => {
    if (!eventStartMs) return;
    const interval = setInterval(() => {
      setCurrentElapsedMs(Date.now() - eventStartMs);
    }, 500);
    return () => clearInterval(interval);
  }, [eventStartMs]);

  const maleOffset = useMemo(() => {
    if (typeof customMaleId === 'number' && typeof customTableId === 'number') {
      return customMaleId - customTableId;
    }
    return 0;
  }, [customMaleId, customTableId]);

  const blocks = useMemo(() => {
    const list: RelativeBlock[] = [];
    let currentMs = 0;
    for (let i = 1; i <= totalRounds; i++) {
      if (i === cakeRound && i > 1) {
        let bEnd = currentMs + 5 * 60000;
        list.push({ id: `break_${i}`, type: 'break', label: '자리교체 & 휴식 (정비)', startMs: currentMs, endMs: bEnd, durationMs: 5 * 60000 });
        currentMs = bEnd;
      }
      let tEnd = currentMs + talkTime * 60000;
      list.push({ id: `round_${i}`, type: 'talk', roundNum: i, label: `${i}회차 ${i === cakeRound ? '🍰(대화 + 케익 대접)' : ''}`, startMs: currentMs, endMs: tEnd, durationMs: talkTime * 60000 });
      currentMs = tEnd;
    }
    return list;
  }, [totalRounds, talkTime, cakeRound]);

  const totalDurationMs = blocks.length > 0 ? blocks[blocks.length - 1].endMs : 0;
  
  const currentBlockIndex = blocks.findIndex(b => currentElapsedMs >= b.startMs && currentElapsedMs < b.endMs);
  const currentBlock = currentBlockIndex >= 0 ? blocks[currentBlockIndex] : null;
  const isFinished = totalDurationMs > 0 && currentElapsedMs >= totalDurationMs;
  const remainingInBlockMs = currentBlock ? currentBlock.endMs - currentElapsedMs : 0;

  // Audio integration
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTone = (freq: number, type: OscillatorType, duration: number, vol: number = 0.5) => {
    if (!audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(vol, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch(e) {}
  };

  useEffect(() => {
    if (!currentBlock || !isLive) return;
    
    const remainingSec = Math.floor(remainingInBlockMs / 1000);
    // 1 Min warning
    if (remainingSec === 60 && !played1MinBeepRef.current[currentBlock.id]) {
       playTone(880, 'sine', 0.5, 0.5);
       setTimeout(() => playTone(880, 'sine', 0.5, 0.5), 600);
       played1MinBeepRef.current[currentBlock.id] = true;
    }
    // End warning
    if (remainingSec === 0 && !playedEndBeepRef.current[currentBlock.id]) {
       playTone(523.25, 'sine', 1.5, 0.4); 
       playTone(659.25, 'sine', 1.5, 0.4); 
       playTone(783.99, 'sine', 1.5, 0.4); 
       setTimeout(() => playTone(1046.50, 'sine', 2.0, 0.6), 400); 
       playedEndBeepRef.current[currentBlock.id] = true;
    }
  }, [remainingInBlockMs, currentBlock, isLive]);

  const handleStart = async () => {
    initAudio();
    // silent beep to unlock
    playTone(100, 'sine', 0.1, 0.01);

    const confirmation = window.confirm(selectedSessionId ? '타이머를 시작하고 참여자 화면과 동기화하시겠습니까?' : '선택된 기수가 없습니다. 로컬 테스트 모드로 타이머만 시작할까요?');
    if (!confirmation) return;

    const now = Date.now();
    setEventStartMs(now);
    setCurrentElapsedMs(0);
    setIsLive(true);
    played1MinBeepRef.current = {};
    playedEndBeepRef.current = {};

    if (selectedSessionId) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig': {
          totalRounds, talkTime, cakeRound, totalTables,
          customMaleOffset: maleOffset,
          startMs: now, status: 'running'
        }
      });
      toast.success('타이머 켜짐 & 클라우드 동기화 완료!');
    } else {
      toast.success('로컬 테스트 타이머가 시작되었습니다.');
    }
  };

  const handleStop = async () => {
    if (!window.confirm('타이머를 초기화/중지하시겠습니까? 참여자 화면도 멈춥니다.')) return;
    setEventStartMs(null);
    setCurrentElapsedMs(0);
    setIsLive(false);
    if (selectedSessionId) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig.status': 'stopped',
        'timerConfig.startMs': null
      });
      toast.success('동기화 타이머가 정지되었습니다.');
    }
  };

  const adjustTime = async (minutesSign: number) => {
    if (!eventStartMs) return;
    const newStart = eventStartMs - (minutesSign * 60000);
    setEventStartMs(newStart);
    if (selectedSessionId && isLive) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig.startMs': newStart
      });
      toast.success(`${minutesSign > 0 ? '+1분' : '-1분'} 강제 조정됨!`);
    }
  };

  const getMaleForTable = (table: number, round: number) => {
    const N = totalTables;
    const val = table - round + maleOffset;
    return ((val % N) + N) % N + 1;
  };

  const formatMinSec = (ms: number) => {
    if (ms < 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getAbsoluteTime = (relativeMs: number) => {
    if (!eventStartMs) return '--:--';
    const date = new Date(eventStartMs + relativeMs);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const progressPct = currentBlock ? Math.min(100, Math.max(0, (currentElapsedMs - currentBlock.startMs) / currentBlock.durationMs * 100)) : 0;
  
  const bgStyle = useMemo(() => {
    if (!currentBlock) return { background: '#F8FAFC' };
    if (currentBlock.type === 'break') return { background: '#F0F7FF' }; // 파스텔 블루
    if (currentBlock.label.includes('케익')) return { background: '#FFF5F7' }; // 파스텔 핑크
    return { background: '#FFFFFF' };
  }, [currentBlock]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-130px)]">
      
      {/* LEFT PANEL: 설정 */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        
        {/* 기수 선택 & 제어부 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">적용할 행사 (기수)</label>
            <select
              value={selectedSessionId}
              onChange={e => handleSelectSession(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 font-bold focus:border-[#FF6F61] focus:ring-1 focus:ring-[#FF6F61] outline-none"
              disabled={isLive}
            >
              <option value="">-- 기수 선택 안함 (로컬 테스트) --</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.region === 'busan' ? '부산' : '창원'} {s.episodeNumber}기 {s.status === 'open' ? '(모집 중)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {!isLive ? (
              <button onClick={handleStart} className="flex-1 bg-gradient-to-r from-[#FF6F61] to-[#FF9A9E] text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF6F61]/20 hover:scale-[1.02] transition-transform">
                <Play fill="currentColor" size={20} /> 실시간 엔진 가동
              </button>
            ) : (
              <button onClick={handleStop} className="flex-1 bg-slate-800 text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 hover:scale-[1.02] transition-transform">
                <Square fill="currentColor" size={20} /> 타이머 정지 (리셋)
              </button>
            )}
            
            {selectedSessionId && (
              <Link href={`/live/${selectedSessionId}`} target="_blank" className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 hover:bg-blue-100 transition-colors" title="참여자 라이브 화면 열기">
                <ExternalLink size={24} />
              </Link>
            )}
          </div>
        </div>

        {/* 세부 설정 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex-1">
          <div className="flex items-center gap-2 mb-6">
            <Settings size={20} className="text-slate-400" />
            <h2 className="text-lg font-black text-slate-800">엔진 파라미터 <span className="text-[10px] font-bold text-blue-500 ml-1">v8.3.2 Premium</span></h2>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-[#FF6F61] pl-2">총 회차</label>
                <input type="number" value={totalRounds} onChange={e => setTotalRounds(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm" disabled={isLive} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-[#FF6F61] pl-2">총 테이블 수</label>
                <input type="number" value={totalTables} onChange={e => setTotalTables(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm" disabled={isLive}/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-[#FF6F61] pl-2">대화 시간 (분)</label>
                <input type="number" value={talkTime} onChange={e => setTalkTime(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm" disabled={isLive}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-purple-500 pl-2">케익 회차</label>
                <input type="number" value={cakeRound} onChange={e => setCakeRound(Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm" disabled={isLive}/>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">* 해당 회차 직전 5분 휴식 블록 자동 삽입됨.</p>
              </div>
            </div>

            <hr className="border-slate-100 my-2" />

            {/* 수동 커스텀 배치 */}
            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
              <label className="block text-xs font-bold text-orange-600 mb-3 flex items-center gap-1"><AlertCircle size={14}/> 남성 초기 배치 강제 오버라이드 (선택)</label>
              <div className="flex gap-3 items-center">
                <span className="text-sm font-bold text-slate-700">남성</span>
                <input type="number" value={customMaleId} onChange={e => setCustomMaleId(e.target.value === '' ? '' : Number(e.target.value))} className="w-16 h-8 text-center rounded border border-orange-200 font-bold" placeholder="N" disabled={isLive}/>
                <span className="text-sm font-bold text-slate-700">번을, 1회차때</span>
                <input type="number" value={customTableId} onChange={e => setCustomTableId(e.target.value === '' ? '' : Number(e.target.value))} className="w-16 h-8 text-center rounded border border-orange-200 font-bold" placeholder="T" disabled={isLive}/>
                <span className="text-sm font-bold text-slate-700">번 테이블에 배정</span>
              </div>
              <p className="text-[10px] text-orange-500 font-semibold mt-2 leading-relaxed">
                * 입력 시 모든 남성의 번호 배열이 충돌 없이 자동 Shift 계산됩니다. <br/>
                * 아무것도 입력하지 않으면 정상 순차 배정(남1-&gt;T1) 적용. 
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* RIGHT PANEL: 대시보드 */}
      <div className="w-full lg:w-2/3 flex flex-col gap-6">
        
        {/* 라이브 타이머 헤더 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col items-center justify-center text-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 z-0 pointer-events-none" />
          
          <div className="relative z-10 w-full mb-6">
            {isFinished ? (
              <div>
                <p className="text-[#FF6F61] font-black text-xl mb-1">🎉 모든 일정이 종료되었습니다!</p>
                <p className="text-slate-500 font-bold text-sm">참여자들에게 매칭 투표를 안내해 주세요.</p>
              </div>
            ) : currentBlock ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${currentBlock.type === 'break' ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-600'} animate-pulse`}>
                    {currentBlock.type === 'break' ? 'BREAK TIME' : 'LIVE ROUND'}
                  </span>
                  <span className="text-slate-500 font-bold text-sm">
                    전체 {formatMinSec(totalDurationMs - currentElapsedMs)} 남음
                  </span>
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">{currentBlock.label} 진행 중</h2>
              </div>
            ) : (
              <div>
                 <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-slate-100 text-slate-500">STANDBY</span>
                 <h2 className="text-3xl font-black text-slate-800 tracking-tight mt-2">엔진 대기 중...</h2>
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-3 w-full">
             {/* 상태바 추가 */}
             {isLive && !isFinished && currentBlock && (
               <div className="w-full max-w-2xl h-2 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200">
                  <div 
                    className={`h-full transition-all duration-1000 ${currentBlock.type === 'break' ? 'bg-blue-400' : 'bg-[#FF6F61]'}`} 
                    style={{ width: `${progressPct}%` }}
                  />
               </div>
             )}

             <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 font-mono text-6xl md:text-8xl font-black shadow-inner shadow-black/20 flex items-center justify-center min-w-[280px]">
               {formatMinSec(remainingInBlockMs)}
             </div>
             
             {/* 다음 이동 시간 안내 */}
             {isLive && !isFinished && currentBlock && (
               <div className="mt-4 text-slate-500 font-bold text-lg">
                 다음 자리 이동 시각: <span className="text-slate-800 font-black">{getAbsoluteTime(currentBlock.endMs)}</span>
               </div>
             )}
             
             {/* 타이머 미세 조정 (관리자 권한) */}
             {isLive && !isFinished && (
               <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200">
                 <button onClick={() => adjustTime(-1)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors" title="-1분 (시간 줄이기)">
                   <Rewind size={16} />
                 </button>
                 <span className="text-[10px] font-bold text-slate-400">강제 조정</span>
                 <button onClick={() => adjustTime(1)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors" title="+1분 (시간 연장하기)">
                   <FastForward size={16} />
                 </button>
               </div>
             )}
          </div>
        </div>

        {/* 뷰 토글 버튼 */}
        <div className="flex justify-center -my-2 relative z-20">
          <button 
            onClick={() => setViewMode(v => v === 'schedule' ? 'map' : 'schedule')}
            className="flex items-center gap-2 px-10 py-4 bg-white border-2 border-slate-200 rounded-full shadow-lg hover:border-[#FF6F61] hover:text-[#FF6F61] transition-all font-black text-lg active:scale-95"
          >
            {viewMode === 'schedule' ? <RefreshCw size={20} /> : <Clock size={20} />}
            {viewMode === 'schedule' ? '로테이션 배치표 보기' : '전체 라이브 스케줄 보기'}
          </button>
        </div>

        {/* 듀얼 뷰 콘텐츠 (애니메이션 적용) */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col min-h-[500px]" style={bgStyle}>
          
          {viewMode === 'schedule' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><Clock size={18} className="text-blue-500"/> 라이브 타임 트래커 (Live Tracker)</h3>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-center border-collapse">
                  <thead className="sticky top-0 bg-white z-20 shadow-sm">
                    <tr className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      <th className="p-4 border-b border-slate-100 text-left pl-8">회차 / 상태</th>
                      <th className="p-4 border-b border-slate-100">소요 시간</th>
                      <th className="p-4 border-b border-slate-100 pr-8">예정 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b) => {
                      const isCur = currentBlock?.id === b.id;
                      const isPast = currentElapsedMs >= b.endMs;
                      return (
                        <tr key={b.id} className={`${isCur ? 'bg-slate-900 text-white' : isPast ? 'opacity-40' : ''} border-b border-slate-50 transition-colors`}>
                          <td className="p-4 text-left pl-8 font-black text-lg">{b.label}</td>
                          <td className="p-4 font-bold">{Math.floor(b.durationMs/60000)}분</td>
                          <td className="p-4 pr-8 font-black text-lg">{getAbsoluteTime(b.startMs)} ~ {getAbsoluteTime(b.endMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><RefreshCw size={18} className="text-[#FF6F61]"/> 스마트 로테이션 맵 (Full Map)</h3>
                <span className="text-xs font-bold text-slate-400">여성 고정 / 남성 +1 테이블 이동</span>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-center border-collapse">
                  <thead className="sticky top-0 bg-white z-20 shadow-sm font-black text-xs text-slate-500">
                    <tr>
                      <th className="p-4 bg-slate-100 border-b border-slate-200 min-w-[100px]">회차</th>
                      {Array.from({length: totalTables}).map((_, i) => (
                        <th key={i} className="p-4 bg-rose-50/80 border-b border-r border-slate-200">
                          <div className="text-rose-600 font-black text-lg">T{i+1}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {blocks.filter(b => b.type === 'talk').map((b) => {
                      const isCur = currentBlock?.id === b.id;
                      return (
                        <tr key={b.id} className={`${isCur ? 'bg-orange-100' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className={`p-5 border-b border-slate-200 font-black ${isCur ? 'text-orange-600' : 'text-slate-500'}`}>
                            {b.roundNum}회차
                          </td>
                          {Array.from({length: totalTables}).map((_, tIdx) => {
                              const table = tIdx + 1;
                              const maleId = getMaleForTable(table, b.roundNum!);
                              return (
                                <td key={table} className={`p-5 border-b border-r border-slate-100 text-xl font-black ${isCur ? 'text-orange-600' : 'text-blue-600'}`}>
                                  남{maleId}
                                </td>
                              );
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );

  function tablesShiftLabel() {
    return '1테이블씩';
  }
}
