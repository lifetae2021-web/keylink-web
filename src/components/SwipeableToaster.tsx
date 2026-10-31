'use client';

import { Toaster, ToastBar, toast, type Toast, type ToasterProps } from 'react-hot-toast';
import { motion, useAnimate, type PanInfo } from 'framer-motion';

/** 이 className을 준 토스트는 스와이프로 닫히지 않는다 (예: 캡처가 필요한 에러 토스트). */
export const NO_SWIPE_TOAST = 'toast-no-swipe';

const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 500;

function SwipeableToast({ t }: { t: Toast }) {
  const [scope, animate] = useAnimate();

  if (t.className?.includes(NO_SWIPE_TOAST)) return <ToastBar toast={t} />;

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    if (info.offset.y < -SWIPE_DISTANCE || info.velocity.y < -SWIPE_VELOCITY) {
      await animate(scope.current, { y: -150, opacity: 0 }, { duration: 0.2 });
      toast.dismiss(t.id);
    }
  };

  return (
    <motion.div
      ref={scope}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 1, bottom: 0.1 }}
      onDragEnd={handleDragEnd}
      style={{ cursor: 'grab' }}
    >
      <ToastBar toast={t} />
    </motion.div>
  );
}

export default function SwipeableToaster(props: ToasterProps) {
  return <Toaster {...props}>{(t) => <SwipeableToast t={t} />}</Toaster>;
}
