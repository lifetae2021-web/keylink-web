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

  const [totalRounds, setTotalRounds] = useState<number | ''>(8);
  const [talkTime, setTalkTime] = useState<number | ''>(15); // minutes
  const [cakeRound, setCakeRound] = useState<number | ''>(4);
  const [totalTables, setTotalTables] = useState<number | ''>(8);
  
  const [customMaleId, setCustomMaleId] = useState<number | ''>('');
  const [customTableId, setCustomTableId] = useState<number | ''>('');

  const [eventStartMs, setEventStartMs] = useState<number | null>(null);
  const [currentElapsedMs, setCurrentElapsedMs] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [viewMode, setViewMode] = useState<'schedule' | 'map'>('schedule');

  // 신규 타이머 제어 상태값
  const [customStartTime, setCustomStartTime] = useState<string>('');
  const [customDurations, setCustomDurations] = useState<Record<string, number>>({});

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
      
      // 마운트 시의 현재 HH:MM으로 시작 시각 초기값 설정
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCustomStartTime(`${hh}:${mm}`);

      // localStorage 상태 복원
      const savedStartTime = localStorage.getItem('startTime');
      const savedTargetTime = localStorage.getItem('targetTime');
      const savedSessionId = localStorage.getItem('selectedSessionId');
      const savedConfigStr = localStorage.getItem('timerConfig');

      if (savedStartTime) {
        const startTime = Number(savedStartTime);
        const targetTime = Number(savedTargetTime || 0);
        const elapsed = Date.now() - startTime;

        // 아직 종료 시점에 도달하지 않았다면 복원 진행
        if (elapsed < targetTime) {
          setEventStartMs(startTime);
          setCurrentElapsedMs(elapsed);
          setIsLive(true);

          if (savedConfigStr) {
            try {
              const config = JSON.parse(savedConfigStr);
              if (config.totalRounds) setTotalRounds(config.totalRounds);
              if (config.talkTime) setTalkTime(config.talkTime);
              if (config.cakeRound) setCakeRound(config.cakeRound);
              if (config.totalTables) setTotalTables(config.totalTables);
              if (config.customDurations) setCustomDurations(config.customDurations);
            } catch (e) {}
          }
          
          if (savedSessionId && list.some(s => s.id === savedSessionId)) {
            setSelectedSessionId(savedSessionId);
            // 실제 시작 시각을 HH:MM으로 변환하여 표시
            const startDate = new Date(startTime);
            const shh = String(startDate.getHours()).padStart(2, '0');
            const smm = String(startDate.getMinutes()).padStart(2, '0');
            setCustomStartTime(`${shh}:${smm}`);
          }
          return;
        } else {
          // 이미 지나간 시간이면 localStorage 초기화
          localStorage.removeItem('startTime');
          localStorage.removeItem('targetTime');
          localStorage.removeItem('selectedSessionId');
          localStorage.removeItem('timerConfig');
        }
      }

      // 저장된 세션이 있으면 해당 세션을 자동 선택, 없으면 모집 중인 세션 선택
      if (savedSessionId && list.some(s => s.id === savedSessionId)) {
        handleSelectSession(savedSessionId, list);
      } else {
        const openSession = list.find((s: any) => s.status === 'open');
        if (openSession) handleSelectSession(openSession.id, list);
      }
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
      
      // customDurations 로드
      if (session.timerConfig.customDurations) {
        setCustomDurations(session.timerConfig.customDurations);
      } else {
        setCustomDurations({});
      }

      if (session.timerConfig.startMs) {
        setEventStartMs(session.timerConfig.startMs);
        setIsLive(true);
        // 이미 진행 중인 타이머의 경우, 실제 시작 시각을 HH:MM으로 변환하여 표시
        const startDate = new Date(session.timerConfig.startMs);
        const hh = String(startDate.getHours()).padStart(2, '0');
        const mm = String(startDate.getMinutes()).padStart(2, '0');
        setCustomStartTime(`${hh}:${mm}`);
      } else {
        setEventStartMs(null);
        setIsLive(false);
      }
    } else {
      setEventStartMs(null);
      setIsLive(false);
      setCustomDurations({});
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
    const tr = Number(totalRounds) || 0;
    const tt = Number(talkTime) || 0;
    const cr = Number(cakeRound) || 0;

    for (let i = 1; i <= tr; i++) {
      if (i === cr && i > 1) {
        const breakId = `break_${i}`;
        // customDurations에 지정된 분이 있으면 사용하고, 없으면 기본값인 5분 사용
        const breakDurationMin = customDurations[breakId] !== undefined ? customDurations[breakId] : 5;
        let bEnd = currentMs + breakDurationMin * 60000;
        list.push({ id: breakId, type: 'break', label: '자리교체 & 휴식 (정비)', startMs: currentMs, endMs: bEnd, durationMs: breakDurationMin * 60000 });
        currentMs = bEnd;
      }
      const roundId = `round_${i}`;
      // customDurations에 지정된 분이 있으면 사용하고, 없으면 기본값인 talkTime 사용
      const roundDurationMin = customDurations[roundId] !== undefined ? customDurations[roundId] : tt;
      let tEnd = currentMs + roundDurationMin * 60000;
      list.push({ id: roundId, type: 'talk', roundNum: i, label: `${i}회차 ${i === cr ? '🍰(대화 + 케익 대접)' : ''}`, startMs: currentMs, endMs: tEnd, durationMs: roundDurationMin * 60000 });
      currentMs = tEnd;
    }
    return list;
  }, [totalRounds, talkTime, cakeRound, customDurations]);

  const totalDurationMs = blocks.length > 0 ? blocks[blocks.length - 1].endMs : 0;
  
  const currentBlockIndex = blocks.findIndex(b => currentElapsedMs >= b.startMs && currentElapsedMs < b.endMs);
  const currentBlock = currentBlockIndex >= 0 ? blocks[currentBlockIndex] : null;
  const isFinished = totalDurationMs > 0 && currentElapsedMs >= totalDurationMs;
  
  // 시작 시각 이전(미래에 시작)일 경우, 시작할 때까지의 남은 시간으로 처리
  const remainingInBlockMs = currentElapsedMs < 0 
    ? -currentElapsedMs 
    : (currentBlock ? currentBlock.endMs - currentElapsedMs : 0);

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
    if (!currentBlock || !isLive || currentElapsedMs < 0) return;
    
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
  }, [remainingInBlockMs, currentBlock, isLive, currentElapsedMs]);

  const handleStart = async () => {
    initAudio();
    // silent beep to unlock
    playTone(100, 'sine', 0.1, 0.01);

    // 커스텀 시작 시각 파싱
    let targetStartMs = Date.now();
    if (customStartTime) {
      const [hh, mm] = customStartTime.split(':').map(Number);
      const today = new Date();
      today.setHours(hh, mm, 0, 0);
      targetStartMs = today.getTime();
    }

    setEventStartMs(targetStartMs);
    setCurrentElapsedMs(Date.now() - targetStartMs);
    setIsLive(true);
    played1MinBeepRef.current = {};
    playedEndBeepRef.current = {};

    // localStorage에 타이머 시작 상태 영구 보존
    localStorage.setItem('startTime', targetStartMs.toString());
    localStorage.setItem('targetTime', totalDurationMs.toString());
    localStorage.setItem('selectedSessionId', selectedSessionId);
    localStorage.setItem('timerConfig', JSON.stringify({
      totalRounds,
      talkTime,
      cakeRound,
      totalTables,
      customDurations
    }));

    if (selectedSessionId) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig': {
          totalRounds, talkTime, cakeRound, totalTables,
          customMaleOffset: maleOffset,
          startMs: targetStartMs, status: 'running',
          customDurations
        }
      });
      toast.success('소개팅 진행 엔진이 시작되고 클라우드에 실시간 동기화되었습니다!');
    } else {
      toast.success('로컬 테스트용 소개팅 진행 엔진이 가동되었습니다.');
    }
  };

  const handleStop = async () => {
    setEventStartMs(null);
    setCurrentElapsedMs(0);
    setIsLive(false);

    // localStorage 저장 데이터 제거
    localStorage.removeItem('startTime');
    localStorage.removeItem('targetTime');
    localStorage.removeItem('selectedSessionId');
    localStorage.removeItem('timerConfig');

    if (selectedSessionId) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig.status': 'stopped',
        'timerConfig.startMs': null
      });
      toast.success('동기화 타이머가 정지 및 초기화되었습니다.');
    } else {
      toast.success('로컬 타이머가 초기화되었습니다.');
    }
  };

  // 개별 회차 소요 시간 조정 핸들러 (+1분 / -1분)
  const handleAdjustBlockDuration = async (blockId: string, deltaMinutes: number) => {
    let currentDurationMin = 0;
    if (blockId.startsWith('break_')) {
      currentDurationMin = customDurations[blockId] !== undefined ? customDurations[blockId] : 5;
    } else {
      currentDurationMin = customDurations[blockId] !== undefined ? customDurations[blockId] : (Number(talkTime) || 15);
    }

    const newDurationMin = Math.max(1, currentDurationMin + deltaMinutes);
    const updatedDurations = { ...customDurations, [blockId]: newDurationMin };
    setCustomDurations(updatedDurations);

    // 변경된 customDurations를 반영하여 targetTime 재계산 및 localStorage 저장
    const updatedTimerConfig = {
      totalRounds,
      talkTime,
      cakeRound,
      totalTables,
      customDurations: updatedDurations
    };
    
    // 임시로 blocks 배열을 구성하여 새 총 소요시간 구하기
    let currentMs = 0;
    const tr = Number(totalRounds) || 0;
    const tt = Number(talkTime) || 0;
    const cr = Number(cakeRound) || 0;
    for (let i = 1; i <= tr; i++) {
      if (i === cr && i > 1) {
        const breakId = `break_${i}`;
        const breakDurationMin = updatedDurations[breakId] !== undefined ? updatedDurations[breakId] : 5;
        currentMs += breakDurationMin * 60000;
      }
      const roundId = `round_${i}`;
      const roundDurationMin = updatedDurations[roundId] !== undefined ? updatedDurations[roundId] : tt;
      currentMs += roundDurationMin * 60000;
    }
    
    localStorage.setItem('targetTime', currentMs.toString());
    localStorage.setItem('timerConfig', JSON.stringify(updatedTimerConfig));

    if (selectedSessionId) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig.customDurations': updatedDurations
      });
      toast.success(`해당 회차 소요 시간이 ${newDurationMin}분으로 조정되었습니다!`);
    } else {
      toast.success(`로컬: 해당 회차 소요 시간이 ${newDurationMin}분으로 조정되었습니다.`);
    }
  };

  const adjustTime = async (minutesSign: number) => {
    if (!eventStartMs) return;
    const newStart = eventStartMs - (minutesSign * 60000);
    setEventStartMs(newStart);
    setCurrentElapsedMs(Date.now() - newStart);
    if (selectedSessionId && isLive) {
      await updateDoc(doc(db, 'sessions', selectedSessionId), {
        'timerConfig.startMs': newStart
      });
      toast.success(`${minutesSign > 0 ? '+1분' : '-1분'} 강제 조정됨!`);
    }
  };

  const openPopoutTimer = () => {
    const popWindow = window.open(
      '/admin/timer/popout',
      'KeylinkDatingMiniTimer',
      'width=340,height=220,resizable=no,scrollbars=no,status=no,location=no,toolbar=no,menubar=no'
    );
    if (!popWindow) {
      toast.error('팝업이 차단되었습니다. 주소창 우측에서 팝업 허용을 설정해 주세요!');
    }
  };

  const getMaleForTable = (table: number, round: number) => {
    const N = Number(totalTables) || 1; // Prevent div by zero
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
  
  // 전체 소개팅 진행률 (%)
  const overallProgressPct = totalDurationMs > 0 
    ? Math.min(100, Math.max(0, Math.floor((currentElapsedMs / totalDurationMs) * 100))) 
    : 0;
  
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
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">진행 대상 행사 (기수)</label>
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
                <Play fill="currentColor" size={20} /> 소개팅 매칭 엔진 가동
              </button>
            ) : (
              <button onClick={handleStop} className="flex-1 bg-slate-800 text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 hover:scale-[1.02] transition-transform">
                <Square fill="currentColor" size={20} /> 진행 정지 및 초기화
              </button>
            )}
            
            {selectedSessionId && (
              <Link href={`/live/${selectedSessionId}`} target="_blank" className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 hover:bg-blue-100 transition-colors" title="참여자 라이브 화면 열기">
                <ExternalLink size={24} />
              </Link>
            )}
          </div>

          <button
            onClick={openPopoutTimer}
            className="w-full mt-3 bg-slate-950 hover:bg-slate-900 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md text-xs border border-slate-800"
          >
            🖥️ 바탕화면 고정 미니 타이머 창 띄우기
          </button>
        </div>

        {/* 세부 설정 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex-1">
          <div className="flex items-center gap-2 mb-6">
            <Settings size={20} className="text-slate-400" />
            <h2 className="text-lg font-black text-slate-800">소개팅 설정 파라미터</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-[#FF6F61] pl-2">총 회차 (테이블 수 자동 지정)</label>
              <input
                type="number"
                value={totalRounds}
                onChange={e => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setTotalRounds(val);
                  if (typeof val === 'number') {
                    setTotalTables(val);
                  }
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm"
                disabled={isLive}
                placeholder="예: 7"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-[#FF6F61] pl-2">대화 시간 (분)</label>
                <input type="number" value={talkTime} onChange={e => setTalkTime(e.target.value === '' ? '' : Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm" disabled={isLive}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-purple-500 pl-2">케익 회차</label>
                <input type="number" value={cakeRound} onChange={e => setCakeRound(e.target.value === '' ? '' : Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm" disabled={isLive}/>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">* 해당 회차 직전 5분 휴식 블록 자동 삽입됨.</p>
              </div>
            </div>

            {/* 시작 시각 설정 추가 */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 border-l-2 border-emerald-500 pl-2">시작 시각 설정</label>
              <input
                type="time"
                value={customStartTime}
                onChange={e => setCustomStartTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 font-bold bg-slate-50 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                disabled={isLive}
              />
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">* 타이머 가동 시 기준 시작 시각으로 계산됩니다.</p>
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
        
        {/* 라이브 타이머 헤더 (더 콤팩트하게) */}
        <div className={`bg-white rounded-3xl p-6 border transition-all duration-500 shadow-sm relative overflow-hidden flex flex-col items-center justify-center text-center ${
          isLive && !isFinished && remainingInBlockMs < 60000 && currentElapsedMs >= 0
            ? 'border-rose-400 shadow-xl shadow-rose-100/50 ring-2 ring-rose-200 animate-pulse'
            : 'border-slate-200'
        }`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 z-0 pointer-events-none" />
          
          <div className="relative z-10 w-full mb-4">
            {isFinished ? (
              <div>
                <p className="text-[#FF6F61] font-black text-2xl mb-1">🎉 모든 소개팅 일정이 종료되었습니다!</p>
                <p className="text-slate-500 font-bold text-sm">참여자들에게 최종 매칭 투표를 안내해 주세요.</p>
              </div>
            ) : currentElapsedMs < 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-2 justify-center">
                  <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-emerald-100 text-emerald-700 animate-pulse">
                    소개팅 시작 대기 중 (STANDBY)
                  </span>
                  <span className="text-slate-500 font-bold text-sm">
                    {customStartTime} 정각 시작 예정
                  </span>
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">첫 번째 만남 시작 카운트다운</h2>
              </div>
            ) : currentBlock ? (
              <div>
                <div className="flex items-center gap-2 mb-2 justify-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${currentBlock.type === 'break' ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-600'} animate-pulse`}>
                    {currentBlock.type === 'break' ? '교체 및 휴식 시간' : `${currentBlock.roundNum}회차 대화 진행 중`}
                  </span>
                  <span className="text-slate-500 font-bold text-sm bg-slate-50 px-2 py-0.5 rounded border">
                    전체 남은 시간: {formatMinSec(totalDurationMs - currentElapsedMs)}
                  </span>
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">{currentBlock.label}</h2>
              </div>
            ) : (
              <div>
                 <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-slate-100 text-slate-500">STANDBY</span>
                 <h2 className="text-3xl font-black text-slate-800 tracking-tight mt-2">소개팅 진행 대기 중...</h2>
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-4 w-full">
             
             {/* 1. 단일 라운드 진행바 */}
             {isLive && !isFinished && currentBlock && (
               <div className="w-full max-w-xl">
                 <div className="flex justify-between items-center mb-1 text-[11px] font-bold text-slate-400">
                   <span>현재 라운드 진행도</span>
                   <span>{Math.floor(progressPct)}%</span>
                 </div>
                 <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className={`h-full transition-all duration-1000 ${currentBlock.type === 'break' ? 'bg-purple-500' : 'bg-[#FF6F61]'}`} 
                      style={{ width: `${progressPct}%` }}
                    />
                 </div>
               </div>
             )}

             {/* 2. 전체 행사 진행률 바 (소개팅 진행 상황 직관적으로 표시) */}
             {isLive && !isFinished && (
               <div className="w-full max-w-xl mb-2">
                 <div className="flex justify-between items-center mb-1 text-[11px] font-bold text-slate-500">
                   <span className="flex items-center gap-1">📍 전체 매칭 진행률 ({overallProgressPct}%)</span>
                   <span>{formatMinSec(currentElapsedMs)} 경과 / {formatMinSec(totalDurationMs)} 총 시간</span>
                 </div>
                 <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000" 
                      style={{ width: `${overallProgressPct}%` }}
                    />
                 </div>
               </div>
             )}

             {/* 3. 메인 타이머 렌더러 (1분 임박 시 다이내믹 피드백) */}
             <div className={`rounded-2xl px-8 py-5 font-mono text-5xl md:text-7xl font-black flex items-center justify-center min-w-[260px] border shadow-inner transition-colors duration-300 ${
               isLive && !isFinished && remainingInBlockMs < 60000 && currentElapsedMs >= 0
                 ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-rose-100/50 animate-pulse'
                 : 'bg-slate-950 border-slate-900 text-white shadow-black/20'
             }`}>
               {formatMinSec(remainingInBlockMs)}
             </div>

             {/* 4. 다음 이동 시간 안내 */}
              {isLive && !isFinished && currentBlock && (
                <div className="text-slate-500 font-bold text-base mt-2">
                  다음 파트너 자리 이동 시각: <span className="text-[#FF6F61] font-black underline decoration-rose-300 decoration-2 underline-offset-4">{getAbsoluteTime(currentBlock.endMs)}</span>
                </div>
              )}
              
              {/* 5. 타이머 미세 조정 (관리자 권한) */}
              {isLive && !isFinished && (
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200 mt-2">
                  <button onClick={() => adjustTime(-1)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors" title="-1분 (시간 줄이기)">
                    <Rewind size={16} />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">전체 시간 강제 조정</span>
                  <button onClick={() => adjustTime(1)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors" title="+1분 (시간 연장하기)">
                    <FastForward size={16} />
                  </button>
                </div>
              )}
           </div>
         </div>

        {/* 뷰 토글 버튼 (더 크게, 인스턴트 스왑용) */}
        <div className="flex justify-center -my-3 relative z-20">
          <button 
            onClick={() => setViewMode(v => v === 'schedule' ? 'map' : 'schedule')}
            className="flex items-center gap-3 px-12 py-5 bg-white border-2 border-slate-900 rounded-full shadow-[0_8px_0_0_rgba(15,23,42,1)] hover:shadow-none hover:translate-y-1 transition-all font-black text-xl active:scale-95 text-slate-900"
          >
            {viewMode === 'schedule' ? <RefreshCw size={24} /> : <Clock size={24} />}
            {viewMode === 'schedule' ? '로테이션 배치표 즉시 전환' : '시간표 트래커 즉시 전환'}
          </button>
        </div>

        {/* 듀얼 뷰 콘텐츠 (애니메이션 제거, 꽉 찬 레이아웃) */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col min-h-[600px]" style={bgStyle}>
          
          {viewMode === 'schedule' ? (
            <div className="flex flex-col h-full w-full">
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
                        <tr key={b.id} className={`${isCur ? 'bg-slate-900 text-white shadow-xl shadow-black/10 scale-[1.01] relative z-10' : isPast ? 'opacity-30' : ''} border-b border-slate-50 transition-all duration-300`}>
                          <td className="p-4 text-left pl-8">
                            <div className="font-black text-lg">{b.label}</div>
                            {isCur && <div className="text-[10px] font-bold text-[#FF6F61] uppercase tracking-widest mt-1">Currently Processing</div>}
                          </td>
                          <td className="p-4 font-bold">
                            <div className="flex items-center justify-center gap-2.5">
                              <button 
                                onClick={() => handleAdjustBlockDuration(b.id, -1)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center border font-black text-sm transition-all active:scale-90 ${isCur ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}
                                title="-1분 줄이기"
                              >
                                -
                              </button>
                              <span className={isCur ? 'text-white font-extrabold' : 'text-slate-500 font-bold'}>
                                {Math.floor(b.durationMs/60000)}분 소요
                              </span>
                              <button 
                                onClick={() => handleAdjustBlockDuration(b.id, 1)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center border font-black text-sm transition-all active:scale-90 ${isCur ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}
                                title="+1분 늘리기"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-4 pr-8 font-black text-lg tracking-tighter">{getAbsoluteTime(b.startMs)} ~ {getAbsoluteTime(b.endMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full w-full">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><RefreshCw size={18} className="text-[#FF6F61]"/> 스마트 로테이션 맵 (Full Map)</h3>
                <span className="text-xs font-bold text-slate-400">여성 고정 / 남성 +1 테이블 이동</span>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-center border-collapse">
                  <thead className="sticky top-0 bg-white z-20 shadow-sm font-black text-xs text-slate-500">
                    <tr>
                      <th className="p-4 bg-slate-100 border-b border-slate-200 min-w-[100px]">회차</th>
                      {Array.from({length: Number(totalTables) || 0}).map((_, i) => (
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
                          {Array.from({length: Number(totalTables) || 0}).map((_, tIdx) => {
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
