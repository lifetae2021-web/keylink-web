'use client';

import { useEffect } from 'react';
import { RotateCcw, Home, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Production Error Catch:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] p-6 text-center">
      <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
        <AlertCircle size={40} />
      </div>
      
      <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
        잠시 오류가 발생했습니다
      </h1>
      
      <p className="text-gray-500 font-medium max-w-md mb-10 leading-relaxed">
        일시적인 통신 장애이거나 데이터 처리 중 문제가 생겼을 수 있습니다. 
        잠시 후 다시 시도해 주시기 바랍니다.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 px-8 py-3.5 bg-pink-500 text-white font-bold rounded-2xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <RotateCcw size={18} /> 다시 시도하기
        </button>
        
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white border border-gray-100 text-gray-600 font-bold rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <Home size={18} /> 메인으로 이동
        </Link>
      </div>

      <p className="mt-12 text-xs text-gray-300 font-medium">
        Error ID: {error.digest || 'unknown_err'}
      </p>
    </div>
  );
}
