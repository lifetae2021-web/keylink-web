'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Clock, RefreshCw, MapPin } from 'lucide-react';

type RelativeBlock = {
  id: string;
  type: 'talk' | 'break';
  roundNum?: number;
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
};

export default function LiveTimerPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [sessionInfo, setSessionInfo] = useState<{ region: string, episode: number } | null>(null);
  const [timerConfig, setTimerConfig] = useState<any>(null);
  const [currentElapsedMs, setCurrentElapsedMs] = useState(0);

  // Search filter for participant to find their table
  const [searchGender, setSearchGender] = useState<'female' | 'male' | ''>('');
  const [searchNum, setSearchNum] = useState<number | ''>('');

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSessionInfo({ region: data.region === 'busan' ? '부산' : '창원', episode: data.episodeNumber });
        setTimerConfig(data.timerConfig || null);
      }
    });
    return () => unsub();
  }, [sessionId]);

  // Tick if running
  useEffect(() => {
    if (!timerConfig || timerConfig.status !== 'running' || !timerConfig.startMs) return;
    const interval = setInterval(() => {
      setCurrentElapsedMs(Date.now() - timerConfig.startMs);
    }, 500);
    return () => clearInterval(interval);
  }, [timerConfig]);

  const blocks = useMemo(() => {
    if (!timerConfig) return [];
    const list: RelativeBlock[] = [];
    let currentMs = 0;
    const tr = timerConfig.totalRounds || 8;
    const tt = timerConfig.talkTime || 15;
    const cr = timerConfig.cakeRound || 4;

    for (let i = 1; i <= tr; i++) {
       if (i === cr && i > 1) {
         let bEnd = currentMs + 5 * 60000;
         list.push({ id: `break_${i}`, type: 'break', label: '자리교체 & 휴식 (정비)', startMs: currentMs, endMs: bEnd, durationMs: 5 * 60000 });
         currentMs = bEnd;
       }
       let endMs = currentMs + tt * 60000;
       list.push({ id: `round_${i}`, type: 'talk', roundNum: i, label: `${i}회차 ${i === cr ? '🍰(대화 + 케익 대접)' : ''}`, startMs: currentMs, endMs: endMs, durationMs: tt * 60000 });
       currentMs = endMs;
    }
    return list;
  }, [timerConfig]);

  if (!timerConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <Clock size={40} className="animate-pulse text-slate-300" />
          <p className="font-bold">아직 타이머 연동이 시작되지 않았습니다.</p>
        </div>
      </div>
    );
  }

  const totalDurationMs = blocks.length > 0 ? blocks[blocks.length - 1].endMs : 0;
  const currentBlockIndex = blocks.findIndex(b => currentElapsedMs >= b.startMs && currentElapsedMs < b.endMs);
  const currentBlock = currentBlockIndex >= 0 ? blocks[currentBlockIndex] : null;
  const isFinished = totalDurationMs > 0 && currentElapsedMs >= totalDurationMs;
  const isRunning = timerConfig.status === 'running';
  const remainingInBlockMs = currentBlock ? currentBlock.endMs - currentElapsedMs : 0;

  const totalTables = timerConfig.totalTables || 16;
  const maleOffset = timerConfig.customMaleOffset || 0;

  const getMaleForTable = (table: number, round: number) => {
    const N = totalTables;
    const val = table - round + maleOffset;
    return ((val % N) + N) % N + 1;
  };

  const getTableForMale = (maleId: number, round: number) => {
    // If getting male for table: maleId = ((table - round + maleOffset) % N + N) % N + 1
    // Let X = maleId - 1. Then X = (table - round + maleOffset) % N
    // table = (X + round - maleOffset) % N
    // Ensure positive: table = ((maleId - 1 + round - maleOffset) % N + N) % N
    // Table is 1-indexed: + 1
    const val = maleId - 1 + round - maleOffset;
    return ((val % totalTables) + totalTables) % totalTables + 1;
  };

  const formatMinSec = (ms: number) => {
    if (ms < 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Helper properties
  const currentStatusLabel = isFinished 
    ? '행사 종료됨' 
    : isRunning 
      ? (currentBlock?.label + ' 진행 중')
      : '일시 정지됨';

  // Compute my current table
  let myTable = null;
  if (currentBlock?.roundNum && searchGender && searchNum) {
     if (searchGender === 'female') {
        myTable = searchNum <= totalTables ? searchNum : null;
     } else if (searchGender === 'male') {
        myTable = getTableForMale(searchNum, currentBlock.roundNum);
     }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="bg-white px-5 py-4 shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center">
             <Clock size={18} />
           </div>
           <div>
             <h1 className="text-sm font-black text-slate-800 tracking-tight">키링크 라이브 타이머</h1>
             <p className="text-[10px] font-bold text-slate-400">
               {sessionInfo ? `${sessionInfo.region} ${sessionInfo.episode}기` : '로딩 중...'}
             </p>
           </div>
        </div>
      </div>

      {/* DASHBOARD BLOCK */}
      <div className="p-5 flex-1 max-w-lg mx-auto w-full">
         
         <div className="bg-slate-900 rounded-3xl p-6 text-white text-center shadow-lg shadow-slate-900/20 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl -ml-10 -mt-10 pointer-events-none"/>
           <div className="relative z-10">
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest mb-3 ${isFinished ? 'bg-slate-800 text-slate-400' : isRunning ? 'bg-rose-500 text-white animate-pulse' : 'bg-orange-500 text-white'}`}>
                {isRunning && !isFinished ? 'LIVE' : isFinished ? 'FINISHED' : 'PAUSED'}
              </span>
              <h2 className="text-xl font-black mb-3">{currentStatusLabel}</h2>
              <div className="text-[3.5rem] font-mono font-black tracking-tighter leading-none mb-3 drop-shadow-md">
                 {formatMinSec(isFinished ? 0 : remainingInBlockMs)}
              </div>
           </div>
         </div>

         {/* FIND MY SEAT */}
         {!isFinished && currentBlock && (
           <div className="mt-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
             <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2"><MapPin size={16} className="text-rose-500"/>내 자리 찾기</h3>
             
             <div className="flex items-center gap-2 mb-4">
               <select className="h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none flex-1" value={searchGender} onChange={e => setSearchGender(e.target.value as any)}>
                 <option value="">성별</option>
                 <option value="male">남성</option>
                 <option value="female">여성</option>
               </select>
               <input type="number" placeholder="번호 (ex. 1)" className="w-24 h-10 px-3 text-center bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 outline-none" value={searchNum} onChange={e => setSearchNum(e.target.value === '' ? '' : Number(e.target.value))} />
             </div>

             {myTable ? (
               <div className="bg-rose-50 rounded-xl p-4 text-center border border-rose-100">
                 <p className="text-xs font-bold text-slate-500 mb-1">
                   {currentBlock.label} 
                   <span className="ml-1 text-rose-500">당신의 테이블은</span>
                 </p>
                 <p className="text-2xl font-black text-rose-600">Table {myTable}</p>
                 {searchGender === 'male' && <p className="text-[10px] text-slate-400 mt-2">다음 회차에는 Table {myTable === totalTables ? 1 : myTable + 1}로 이동합니다.</p>}
               </div>
             ) : (
               <div className="bg-slate-50 border border-dashed border-slate-200 p-4 text-center rounded-xl text-slate-400 text-xs font-semibold">
                 위에 성별과 본인 번호를 입력하세요.
               </div>
             )}
           </div>
         )}
         
         {/* SCHEDULE LIST */}
         <div className="mt-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
           <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-1.5"><RefreshCw size={16} className="text-slate-400"/>전체 시간표</h3>
           
           <div className="space-y-0 relative">
             <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100 z-0"></div>
             {blocks.map((b, i) => {
               const isCur = currentBlock?.id === b.id;
               const isPast = currentElapsedMs >= b.endMs;

               return (
                 <div key={b.id} className={`relative z-10 flex gap-4 py-2 ${isCur ? 'scale-100 px-2 -ml-2 bg-slate-50 rounded-lg' : ''} transition-all`}>
                   {/* Timeline dot */}
                   <div className="w-6 shrink-0 flex justify-center mt-1">
                     <div className={`w-2.5 h-2.5 rounded-full outline outline-2 outline-white shadow-sm ${isCur ? 'bg-[#FF6F61] scale-150 shadow-[#FF6F61]/30' : isPast ? 'bg-slate-300' : 'bg-slate-200 border-2 border-white'}`} />
                   </div>
                   
                   <div className="flex-1 pb-1">
                     <div className="flex justify-between items-baseline mb-0.5">
                       <span className={`text-[13px] font-black ${isCur ? 'text-[#FF6F61]' : isPast ? 'text-slate-400' : 'text-slate-600'}`}>{b.label}</span>
                       <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                         {Math.floor(b.durationMs/60000)}분
                       </span>
                     </div>
                   </div>
                 </div>
               )
             })}
           </div>
         </div>
         
      </div>

    </div>
  );
}
