'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { isAutumnLeavesActive } from '@/lib/seasonalEffects';

// 낙엽 하나를 나타내는 속성
interface Leaf {
  id: number;
  x: number; // 시작 X 위치 (0~100vw)
  yOffset: number; // 시작 Y 위치 오프셋
  scale: number; // 크기
  rotation: number; // 초기 회전각
  duration: number; // 떨어지는 시간
  delay: number; // 시작 지연 시간
  color: string; // 잎 색상
  sway: number; // 좌우로 흔들리는 폭 (vw)
  shape: 'maple' | 'ginkgo';
}

const MAPLE_COLORS = ['#D97706', '#EA580C', '#B45309', '#DC2626'];
const GINKGO_COLORS = ['#EAB308', '#FACC15', '#CA8A04', '#FDE047'];

// 단풍잎(뾰족한 갈퀴 모양)
const MAPLE_PATH = 'M12 2c1 2 1 3.2.5 4.8 1.6-1.2 3-1.4 5-.8-1 1.6-1.6 2.6-1.2 4.2 1.8-.2 3 .2 4.5 1.6-1.6 1-2.8 1.2-4 2.6 1.6.8 2.4 1.8 3 3.6-2 .2-3.2-.2-4.6-1.4.2 1.8-.2 3-1.4 4.4-1-1.6-1.4-2.8-1.2-4.4-1.2 1.2-2.4 1.6-4.2 1.4.4-1.8 1.2-2.8 2.6-3.8-1.8-.6-3-1.6-4-3 1.8-.6 3-.6 4.6.2-.6-1.6-.6-2.8.2-4.4 1.6.8 2.4 1.8 2.6 3.4-.6-1.6-.8-2.8.2-4.4z';
// 은행잎(부채꼴 모양, 위쪽 중앙에 살짝 갈라진 홈)
const GINKGO_PATH = 'M12 3.5c-3.2 1-6 4-6.6 8.2-.5 3.4 1 6.4 3.6 8.3l2.2-4 .8 2.6.8-2.6 2.2 4c2.6-1.9 4.1-4.9 3.6-8.3-.6-4.2-3.4-7.2-6.6-8.2z';

export default function AutumnLeaves() {
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'settings', 'general'))
      .then(snap => {
        if (cancelled) return;
        setEnabled(isAutumnLeavesActive(snap.exists() ? snap.data() : null));
      })
      .catch(() => { /* 설정 조회 실패 시 노출하지 않음 */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // 낙엽 18개 생성 (단풍잎/은행잎 랜덤 혼합)
    const newLeaves = Array.from({ length: 18 }).map((_, i) => {
      const shape: 'maple' | 'ginkgo' = Math.random() < 0.5 ? 'maple' : 'ginkgo';
      const palette = shape === 'ginkgo' ? GINKGO_COLORS : MAPLE_COLORS;
      return {
        id: i,
        x: Math.random() * 100,
        yOffset: Math.random() * -20,
        scale: 0.5 + Math.random() * 0.6,
        rotation: Math.random() * 360,
        duration: 7 + Math.random() * 9, // 7초 ~ 16초 (벚꽃보다 살짝 빠르게, 낙엽 느낌)
        delay: Math.random() * 5,
        color: palette[Math.floor(Math.random() * palette.length)],
        sway: 6 + Math.random() * 8, // 8~14vw 좌우 흔들림
        shape,
      };
    });
    setLeaves(newLeaves);
  }, []);

  if (!enabled) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      {leaves.map(l => (
        <div key={l.id} style={{
          position: 'absolute',
          left: `${l.x}vw`,
          top: `${l.yOffset}vh`,
          opacity: 0.18,
          willChange: 'transform',
          transform: `scale(${l.scale}) rotate(${l.rotation}deg)`,
          animation: `leafFall ${l.duration}s ease-in-out ${l.delay}s infinite`,
          // 잎마다 흔들림 폭이 다르도록 CSS 변수로 전달
          ['--sway' as any]: `${l.sway}vw`,
        }}>
          {/* 단풍잎/은행잎 모양 SVG (그림자 제거로 렌더링 부하 최소화) */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d={l.shape === 'ginkgo' ? GINKGO_PATH : MAPLE_PATH}
              fill={l.color}
              opacity={0.9}
            />
            <path d="M12 2v20" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes leafFall {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.85;
          }
          40% {
            transform: translateY(40vh) translateX(var(--sway)) rotate(150deg);
          }
          70% {
            transform: translateY(75vh) translateX(calc(var(--sway) * -1)) rotate(260deg);
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(110vh) translateX(var(--sway)) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
