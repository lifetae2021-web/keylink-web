'use client';

import { useState, type MouseEvent } from 'react';

type Props = {
  src: string;
  alt?: string;
  onError?: () => void;
  zoom?: number;
  lensSize?: number;
};

/**
 * object-contain 이미지 위에 마우스를 올리면 커서 위치를 동그란 돋보기로 확대해 보여준다.
 * 레터박스(이미지 바깥 여백) 위에서는 돋보기를 숨긴다. 터치 기기에서는 mousemove가 없어 동작하지 않는다.
 */
export default function MagnifierImage({ src, alt, onError, zoom = 2, lensSize = 220 }: Props) {
  const [lens, setLens] = useState<{ x: number; y: number; bgW: number; bgH: number; bgX: number; bgY: number } | null>(null);

  const handleMove = (e: MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const box = img.getBoundingClientRect();
    // object-contain으로 실제 그려진 이미지 영역 계산
    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const offX = (box.width - w) / 2;
    const offY = (box.height - h) / 2;
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    if (x < offX || x > offX + w || y < offY || y > offY + h) {
      setLens(null);
      return;
    }
    setLens({
      x,
      y,
      bgW: w * zoom,
      bgH: h * zoom,
      bgX: -((x - offX) * zoom - lensSize / 2),
      bgY: -((y - offY) * zoom - lensSize / 2),
    });
  };

  return (
    <div className="relative w-full h-full">
      <img
        src={src}
        alt={alt}
        onError={onError}
        onMouseMove={handleMove}
        onMouseLeave={() => setLens(null)}
        className={`w-full h-full object-contain ${lens ? 'cursor-none' : ''}`}
      />
      {lens && (
        <div
          className="pointer-events-none absolute z-10 rounded-full border-2 border-white shadow-[0_4px_20px_rgba(0,0,0,0.35)] bg-no-repeat bg-white"
          style={{
            width: lensSize,
            height: lensSize,
            left: lens.x - lensSize / 2,
            top: lens.y - lensSize / 2,
            backgroundImage: `url("${src}")`,
            backgroundSize: `${lens.bgW}px ${lens.bgH}px`,
            backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
          }}
        />
      )}
    </div>
  );
}
