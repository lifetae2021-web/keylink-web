'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { isSnowActive } from '@/lib/seasonalEffects';

// 눈송이 하나를 나타내는 속성
interface Flake {
  id: number;
  x: number; // 시작 X 위치 (0~100vw)
  yOffset: number; // 시작 Y 위치 오프셋
  scale: number; // 크기
  duration: number; // 떨어지는 시간
  delay: number; // 시작 지연 시간
  sway: number; // 좌우로 흔들리는 폭 (vw)
  opacity: number;
}

export default function Snow() {
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'settings', 'general'))
      .then(snap => {
        if (cancelled) return;
        setEnabled(isSnowActive(snap.exists() ? snap.data() : null));
      })
      .catch(() => { /* 설정 조회 실패 시 노출하지 않음 */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // 눈송이 26개 생성
    const newFlakes = Array.from({ length: 26 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      yOffset: Math.random() * -20,
      scale: 0.5 + Math.random() * 0.8,
      duration: 9 + Math.random() * 10, // 9초 ~ 19초, 눈은 벚꽃/낙엽보다 조금 더 천천히
      delay: Math.random() * 6,
      sway: 3 + Math.random() * 5, // 3~8vw 좌우 흔들림 (낙엽보다 완만하게)
      opacity: 0.55 + Math.random() * 0.35,
    }));
    setFlakes(newFlakes);
  }, []);

  if (!enabled) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      {flakes.map(f => (
        <div key={f.id} style={{
          position: 'absolute',
          left: `${f.x}vw`,
          top: `${f.yOffset}vh`,
          width: `${7 * f.scale}px`,
          height: `${7 * f.scale}px`,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 0 5px 1px rgba(180,210,240,0.7)',
          filter: 'blur(0.3px)',
          opacity: f.opacity,
          willChange: 'transform',
          animation: `snowFall ${f.duration}s linear ${f.delay}s infinite`,
          ['--sway' as any]: `${f.sway}vw`,
        }} />
      ))}

      <style>{`
        @keyframes snowFall {
          0% {
            transform: translateY(-10vh) translateX(0);
          }
          50% {
            transform: translateY(50vh) translateX(var(--sway));
          }
          100% {
            transform: translateY(110vh) translateX(calc(var(--sway) * -1));
          }
        }
      `}</style>
    </div>
  );
}
