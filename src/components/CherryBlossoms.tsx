'use client';

import { useEffect, useState } from 'react';

// 벚꽃 잎 하나를 나타내는 속성
interface Petal {
  id: number;
  x: number; // 시작 X 위치 (0~100vw)
  yOffset: number; // 시작 Y 위치 오프셋
  scale: number; // 크기
  rotation: number; // 초기 회전각
  duration: number; // 떨어지는 시간
  delay: number; // 시작 지연 시간
}

export default function CherryBlossoms() {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    // 벚꽃 잎 20개 생성
    const newPetals = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      yOffset: Math.random() * -20, // 위쪽 안보이는 곳에서 시작
      scale: 0.4 + Math.random() * 0.6, // 크기 40% ~ 100%
      rotation: Math.random() * 360,
      duration: 8 + Math.random() * 10, // 8초 ~ 18초 동안 천천히 떨어짐
      delay: Math.random() * 5, // 0초 ~ 5초 사이에 떨어지기 시작
    }));
    setPetals(newPetals);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      {petals.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}vw`,
          top: `${p.yOffset}vh`,
          opacity: 0.15,
          transform: `scale(${p.scale}) rotate(${p.rotation}deg)`,
          animation: `fall ${p.duration}s linear ${p.delay}s infinite`,
        }}>
          {/* 부드러운 벚꽃 잎 모양 SVG */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 4px rgba(255,182,193,0.3))' }}>
            <path d="M12 2C12 2 16.5 5 18 9C19.5 13 17.5 17.5 12 21C6.5 17.5 4.5 13 6 9C7.5 5 12 2 12 2Z" fill="#FFDBE9" />
            <path d="M12 2C12 2 16.5 5 18 9C19.5 13 17.5 17.5 12 21" stroke="#FFB6C1" strokeWidth="0.5" />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          50% {
            transform: translateY(50vh) translateX(5vw) rotate(180deg);
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(110vh) translateX(-5vw) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
