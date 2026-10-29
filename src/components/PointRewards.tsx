'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import PointDropImage, { DEFAULT_POINT_DROP_IMAGE } from './PointDropImage';

// 떨어지는 포인트를 띄우지 않는 화면 (신청/로그인/투표 등 집중이 필요한 곳)
const NO_DROP_PREFIXES = ['/apply', '/login', '/register', '/vote', '/live', '/matching'];
const ROLL_INTERVAL_MS = 3 * 60 * 1000;
// 하루 첫 입장 시 서버가 한 번은 반드시 떨어뜨리므로, 첫 시도는 입장 후 3~8초 사이 (10초 안에 떨어짐)
const FIRST_ROLL_DELAY_MS = 3000 + Math.floor(Math.random() * 5000);
const FALL_DURATION_S = 9;

interface Drop {
  id: string;
  x: number; // 시작 X 위치 (vw)
  image: string; // 관리자가 선택한 이미지 중 하나 (기본 제공 'preset:*' 또는 업로드 URL)
}

/**
 * 매일 첫 방문 포인트 적립 + 사이트에 머무는 동안 낮은 확률로 포인트가 떨어지고, 클릭하면 적립된다.
 * 떨어질지/금액은 모두 서버(/api/points)가 결정한다.
 */
export default function PointRewards() {
  const pathname = usePathname();
  const { user, authLoading } = useAuth();
  const [drop, setDrop] = useState<Drop | null>(null);
  const claimingRef = useRef(false);

  const callPoints = useCallback(async (payload: Record<string, unknown>) => {
    const token = user ? await user.getIdToken().catch(() => null) : null;
    const res = await fetch('/api/points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('points api failed');
    return res.json();
  }, [user]);

  // 1. 방문 포인트 (로그인 상태가 바뀌면 다시 호출 → 회원 로그인 시 비회원 포인트 합치기)
  useEffect(() => {
    if (authLoading) return;
    callPoints({ action: 'visit' })
      .then(data => {
        if (data.merged > 0) {
          toast.success(`비회원으로 모은 ${data.merged.toLocaleString()}P가 회원 포인트로 옮겨졌어요!`, { duration: 4000 });
        }
        if (data.granted > 0) {
          toast(
            data.isMember
              ? `🎁 오늘의 방문 포인트 +${data.granted}P`
              : `🎁 오늘의 방문 포인트 +${data.granted}P\n가입하면 모은 포인트를 쓸 수 있어요`,
            { duration: 3500 }
          );
        } else if (data.capped && !data.isMember) {
          toast(`비회원은 ${data.visitorCap.toLocaleString()}P까지 모을 수 있어요.\n가입하고 계속 모아보세요!`, { duration: 4000 });
        }
      })
      .catch(() => { /* 포인트 실패가 사이트 이용을 막지 않도록 무시 */ });
  }, [authLoading, user?.uid, callPoints]);

  // 2. 떨어지는 포인트 (일정 간격으로 서버에 굴려보기)
  const dropsAllowed = !NO_DROP_PREFIXES.some(p => pathname.startsWith(p));
  useEffect(() => {
    if (authLoading || !dropsAllowed) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const roll = () => {
      if (document.visibilityState !== 'visible') return;
      callPoints({ action: 'roll' })
        .then(data => {
          // 관리자 설정에서 꺼져 있으면 이 페이지에서는 더 묻지 않음
          if (data.disabled) { clearInterval(interval); return; }
          if (data.dropId) setDrop({ id: data.dropId, x: 8 + Math.random() * 76, image: data.image || DEFAULT_POINT_DROP_IMAGE });
        })
        .catch(() => {});
    };

    const first = setTimeout(roll, FIRST_ROLL_DELAY_MS);
    interval = setInterval(roll, ROLL_INTERVAL_MS);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [authLoading, dropsAllowed, callPoints]);

  const claim = async () => {
    if (!drop || claimingRef.current) return;
    claimingRef.current = true;
    const dropId = drop.id;
    setDrop(null);
    try {
      const data = await callPoints({ action: 'claim', dropId });
      if (data.earned >= 500) {
        toast.success(`🎉 대박! +${data.earned}P 적립!`, { duration: 4000 });
      } else if (data.earned > 0) {
        toast.success(`+${data.earned}P 적립!`);
      } else if (!data.isMember) {
        toast(`비회원은 ${data.visitorCap.toLocaleString()}P까지 모을 수 있어요.\n가입하고 계속 모아보세요!`);
      }
    } catch {
      toast.error('포인트를 줍지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      claimingRef.current = false;
    }
  };

  if (!drop || !dropsAllowed) return null;

  return (
    <>
      <button
        key={drop.id}
        type="button"
        aria-label="떨어지는 포인트 줍기"
        onClick={claim}
        onAnimationEnd={() => setDrop(null)}
        style={{
          position: 'fixed',
          top: 0,
          left: `${drop.x}vw`,
          zIndex: 60,
          width: '52px',
          height: '52px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          animation: `pointCoinFall ${FALL_DURATION_S}s linear forwards`,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ display: 'block', margin: '4px' }}>
          <PointDropImage image={drop.image} size={44} animate />
        </span>
      </button>
      <style>{`
        @keyframes pointCoinFall {
          0% { transform: translateY(-60px) translateX(0); opacity: 0; }
          8% { opacity: 1; }
          35% { transform: translateY(35vh) translateX(4vw); }
          70% { transform: translateY(70vh) translateX(-4vw); }
          92% { opacity: 1; }
          100% { transform: translateY(105vh) translateX(2vw); opacity: 0; }
        }
        @keyframes pointCoinSpin {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(0.2); }
        }
        @keyframes pointImageWobble {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
      `}</style>
    </>
  );
}
