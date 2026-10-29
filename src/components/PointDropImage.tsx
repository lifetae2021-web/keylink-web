'use client';

/**
 * 떨어지는 포인트 이미지. 값은 기본 제공('preset:coin' 등) 또는 관리자가 올린 이미지 URL.
 * 사이트(PointRewards)와 관리자 설정 미리보기가 같은 모양을 쓰도록 공용으로 둔다.
 */

export const POINT_DROP_PRESETS: { key: string; label: string }[] = [
  { key: 'preset:coin', label: '동전' },
  { key: 'preset:key', label: '열쇠' },
  { key: 'preset:heart', label: '하트' },
  { key: 'preset:star', label: '별' },
  { key: 'preset:clover', label: '네잎클로버' },
  { key: 'preset:gift', label: '선물' },
];

export const DEFAULT_POINT_DROP_IMAGE = 'preset:coin';

const GLOW = 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.65)) drop-shadow(0 3px 4px rgba(0,0,0,0.15))';

function PresetSvg({ name, size }: { name: string; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 48 48', style: { display: 'block', filter: GLOW } };
  switch (name) {
    case 'key':
      return (
        <svg {...common}>
          <defs><linearGradient id="pdKey" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF3B0" /><stop offset="0.5" stopColor="#FACC15" /><stop offset="1" stopColor="#CA8A04" /></linearGradient></defs>
          <circle cx="16" cy="16" r="10" fill="url(#pdKey)" stroke="#B45309" strokeWidth="2" />
          <circle cx="16" cy="16" r="4" fill="#FFF7D6" stroke="#B45309" strokeWidth="1.5" />
          <path d="M23 23 L40 40 M33 33 L37 29 M37 37 L41 33" stroke="#B45309" strokeWidth="5" strokeLinecap="round" />
          <path d="M23 23 L40 40 M33 33 L37 29 M37 37 L41 33" stroke="url(#pdKey)" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <defs><linearGradient id="pdHeart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFB4AC" /><stop offset="1" stopColor="#FF4F6D" /></linearGradient></defs>
          <path d="M24 41 C10 31 5 24 5 16.5 C5 10.5 9.5 6 15 6 C19 6 22 8.2 24 11.5 C26 8.2 29 6 33 6 C38.5 6 43 10.5 43 16.5 C43 24 38 31 24 41 Z" fill="url(#pdHeart)" stroke="#E11D48" strokeWidth="1.5" />
          <ellipse cx="15" cy="15" rx="4" ry="2.6" fill="#fff" opacity="0.55" transform="rotate(-30 15 15)" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <defs><linearGradient id="pdStar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF3B0" /><stop offset="0.55" stopColor="#FACC15" /><stop offset="1" stopColor="#EAB308" /></linearGradient></defs>
          <path d="M24 4 L29.6 16.8 L43.5 18.1 L33 27.3 L36.1 41 L24 33.8 L11.9 41 L15 27.3 L4.5 18.1 L18.4 16.8 Z" fill="url(#pdStar)" stroke="#CA8A04" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'clover':
      return (
        <svg {...common}>
          <g fill="#22C55E" stroke="#15803D" strokeWidth="1.5">
            <circle cx="17" cy="15" r="8" /><circle cx="31" cy="15" r="8" />
            <circle cx="17" cy="29" r="8" /><circle cx="31" cy="29" r="8" />
          </g>
          <circle cx="24" cy="22" r="4" fill="#16A34A" />
          <path d="M24 26 Q26 36 32 44" stroke="#15803D" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'gift':
      return (
        <svg {...common}>
          <rect x="7" y="20" width="34" height="22" rx="3" fill="#FF6F61" stroke="#E04E40" strokeWidth="1.5" />
          <rect x="5" y="14" width="38" height="8" rx="2" fill="#FF8A7E" stroke="#E04E40" strokeWidth="1.5" />
          <rect x="21" y="14" width="6" height="28" fill="#FACC15" />
          <path d="M24 14 C18 4 10 8 14 13 Z M24 14 C30 4 38 8 34 13 Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="1.2" />
        </svg>
      );
    default: // coin
      return (
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: size - 4, height: size - 4, margin: 2, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #FFF3B0 0%, #FACC15 45%, #CA8A04 100%)',
          border: '2px solid #FDE68A',
          boxShadow: '0 0 14px rgba(250, 204, 21, 0.75), 0 4px 10px rgba(0,0,0,0.15)',
          color: '#7C4A03', fontWeight: 900, fontSize: size * 0.42, lineHeight: 1,
        }}>
          P
        </span>
      );
  }
}

export default function PointDropImage({ image, size = 44, animate = false }: { image: string; size?: number; animate?: boolean }) {
  const isPreset = image.startsWith('preset:');
  const isCoin = image === 'preset:coin' || !image;
  // 동전은 뒤집히듯 돌고, 나머지(일반 그림)는 좌우로 살랑 흔들림
  const animation = animate ? (isCoin ? 'pointCoinSpin 1.6s ease-in-out infinite' : 'pointImageWobble 1.6s ease-in-out infinite') : undefined;

  return (
    <span style={{ display: 'block', width: size, height: size, animation }}>
      {isPreset || !image ? (
        <PresetSvg name={image.replace('preset:', '') || 'coin'} size={size} />
      ) : (
        <img src={image} alt="" draggable={false} style={{ display: 'block', width: size, height: size, objectFit: 'contain', filter: GLOW }} />
      )}
    </span>
  );
}
