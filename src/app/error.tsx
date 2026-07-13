'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Home, AlertCircle, Wifi } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(8);
  const [autoRetrying, setAutoRetrying] = useState(true);

  // 에러 유형 분류
  const isNetworkError =
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('Load failed') ||
    error?.message?.includes('NetworkError') ||
    error?.digest === undefined;

  useEffect(() => {
    // 에러 로깅 (개발자가 확인할 수 있도록)
    console.error('[GlobalError] Type:', isNetworkError ? 'Network' : 'App', '| Digest:', error.digest, '| Message:', error.message, '| Stack:', error.stack);
  }, [error]);

  // 네트워크 에러일 경우 자동 재시도
  useEffect(() => {
    if (!autoRetrying) return;

    if (countdown <= 0) {
      reset();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, autoRetrying, reset]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FDFDFD',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '80px', height: '80px',
        background: isNetworkError ? '#EFF6FF' : '#FFF1F0',
        borderRadius: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        {isNetworkError
          ? <Wifi size={40} color="#3B82F6" />
          : <AlertCircle size={40} color="#FF6F61" />
        }
      </div>

      <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '12px', letterSpacing: '-0.03em' }}>
        {isNetworkError ? '네트워크 연결 오류' : '잠시 오류가 발생했습니다'}
      </h1>

      <p style={{ color: '#6B7280', fontWeight: '500', maxWidth: '340px', lineHeight: 1.7, marginBottom: '32px', fontSize: '0.95rem' }}>
        {isNetworkError
          ? '인터넷 연결이 불안정합니다.\n잠시 후 자동으로 다시 시도합니다.'
          : '일시적인 통신 장애이거나 데이터 처리 중\n문제가 생겼을 수 있습니다.'
        }
      </p>

      {/* 자동 재시도 카운트다운 */}
      {autoRetrying && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#F8FAFF', border: '1px solid #DBEAFE',
          borderRadius: '100px', padding: '8px 20px',
          marginBottom: '20px',
          fontSize: '0.85rem', fontWeight: '700', color: '#3B82F6',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#3B82F6',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
          {countdown}초 후 자동으로 다시 시도합니다...
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
        <button
          onClick={() => { setAutoRetrying(false); reset(); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '14px 24px',
            background: '#FF6F61', color: '#fff',
            fontWeight: '800', fontSize: '0.95rem',
            borderRadius: '16px', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,111,97,0.3)',
          }}
        >
          <RotateCcw size={18} /> 지금 바로 다시 시도
        </button>

        <Link
          href="/"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px 24px',
            background: '#fff', border: '1.5px solid #E5E7EB', color: '#374151',
            fontWeight: '700', fontSize: '0.9rem',
            borderRadius: '16px', textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <Home size={18} /> 메인으로 이동
        </Link>
      </div>

      <p style={{ marginTop: '32px', fontSize: '0.72rem', color: '#D1D5DB', fontWeight: '500' }}>
        Error: {error.digest || error.message?.slice(0, 40) || 'unknown_err'}
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
