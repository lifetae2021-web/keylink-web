'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { Timer, Clock } from 'lucide-react';

export default function PopoutTimerPage() {
  const [runningSession, setRunningSession] = useState<any>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [overallProgressPct, setOverallProgressPct] = useState<number>(0);

  // 1. Firestore에서 현재 'running' 상태인 소개팅 세션 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'sessions'),
      where('timerConfig.status', '==', 'running'),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setRunningSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        setRunningSession(null);
      }
    }, (err) => {
      console.error('Error fetching popout session:', err);
    });

    return () => unsub();
  }, []);

  // 2. 초정밀 1초 단위 타이머 역산 연계 작동
  useEffect(() => {
    if (!runningSession || !runningSession.timerConfig) {
      setRemainingMs(0);
      setCurrentBlock(null);
      return;
    }

    const timerConfig = runningSession.timerConfig;

    const tick = () => {
      const startTime = timerConfig.startTime;
      if (!startTime) return;

      const now = Date.now();
      const elapsedMs = now - startTime;

      const cakeRoundNum = timerConfig.cakeRound || 4;
      const talkTimeVal = timerConfig.talkTime || 15;
      const totalRoundsVal = timerConfig.totalRounds || 7;
      const customDurations = timerConfig.customDurations || {};

      // 대화 시간 및 휴식 시간 블록 계산
      const list: { type: 'talk' | 'break'; label: string; durationMs: number; roundNum?: number }[] = [];

      for (let r = 1; r <= totalRoundsVal; r++) {
        const roundTalkMin = customDurations[r] !== undefined ? customDurations[r] : talkTimeVal;
        const roundTalkMs = roundTalkMin * 60000;

        list.push({
          type: 'talk',
          label: `${r}회차 대화 진행 중`,
          durationMs: roundTalkMs,
          roundNum: r
        });

        if (r < totalRoundsVal) {
          if (r + 1 === cakeRoundNum) {
            list.push({ type: 'break', label: '교체 및 케이크 5분 휴식', durationMs: 5 * 60000 });
          } else {
            list.push({ type: 'break', label: '자리 교체 및 이동 시간', durationMs: 1.5 * 60000 });
          }
        }
      }

      const totalDurationMs = list.reduce((sum, item) => sum + item.durationMs, 0);

      if (elapsedMs >= totalDurationMs) {
        setRemainingMs(0);
        setCurrentBlock({ label: '모든 소개팅 일정 종료', type: 'break', durationMs: 0 });
        return;
      }

      let accumMs = 0;
      let currentBlockObj = null;
      let remainingInBlockMs = 0;

      for (const block of list) {
        const blockStart = accumMs;
        const blockEnd = accumMs + block.durationMs;

        if (elapsedMs >= blockStart && elapsedMs < blockEnd) {
          currentBlockObj = block;
          remainingInBlockMs = blockEnd - elapsedMs;
          break;
        }
        accumMs += block.durationMs;
      }

      if (currentBlockObj) {
        setRemainingMs(remainingInBlockMs);
        setCurrentBlock(currentBlockObj);
        setProgressPct(((currentBlockObj.durationMs - remainingInBlockMs) / currentBlockObj.durationMs) * 100);
        setOverallProgressPct((elapsedMs / totalDurationMs) * 100);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [runningSession]);

  // 분/초 렌더링 헬퍼
  const formatMinSec = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isUrgent = remainingMs < 60000 && currentBlock && currentBlock.durationMs > 0;

  return (
    <div className={`min-h-screen bg-slate-950 text-white flex flex-col p-4 select-none overflow-hidden justify-between border-2 transition-colors duration-300 ${
      isUrgent ? 'border-rose-500 animate-pulse' : 'border-slate-800'
    }`}>
      {/* 상단 기수 및 회차 정보 */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-rose-400 tracking-wider bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/30">
          KEYLINK LIVE WIDGET
        </span>
        <span className="text-[10px] font-bold text-slate-400">
          {runningSession?.title?.replace('(모집 중)', '') || '기수 대기 중'}
        </span>
      </div>

      {/* 메인 타이머 디스플레이 */}
      <div className="flex flex-col items-center justify-center my-1.5">
        {currentBlock ? (
          <>
            <p className={`text-xs font-black mb-1 ${isUrgent ? 'text-rose-400' : 'text-slate-400'}`}>
              {currentBlock.label}
            </p>
            <div className={`font-mono text-5xl font-black tracking-tighter ${isUrgent ? 'text-rose-400' : 'text-white'}`}>
              {formatMinSec(remainingMs)}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <Clock size={24} className="text-slate-500 animate-pulse" />
            <p className="text-sm font-black text-slate-400">소개팅 가동 대기 중</p>
          </div>
        )}
      </div>

      {/* 하단 진행 바 */}
      {currentBlock && (
        <div className="space-y-1.5">
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${currentBlock.type === 'break' ? 'bg-purple-500' : 'bg-[#FF6F61]'}`} 
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
            <span>📍 전체 매칭률: {Math.floor(overallProgressPct)}%</span>
            <span>Keylink Timer</span>
          </div>
        </div>
      )}
    </div>
  );
}
