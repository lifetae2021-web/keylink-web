import PrivateMatching from '@/components/PrivateMatching';
import { Suspense } from 'react';

export default function PrivateMatchingApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center pt-[80px]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
      <PrivateMatching />
    </Suspense>
  );
}
