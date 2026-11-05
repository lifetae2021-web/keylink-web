'use client';
import { useEffect, useState } from 'react';
import { getContent } from '@/lib/firestore/cms';
import { POLICY_TITLE, type PolicyKey } from '@/components/PolicyModal';

// /privacy, /terms — 바로 열 수 있는 전문 주소(키링 월드 입장 동의 화면 등에서 링크)
export default function PolicyPage({ policy }: { policy: PolicyKey }) {
  const title = POLICY_TITLE[policy];
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    getContent(policy)
      .then(b => setBody(b || `${title}이 아직 등록되지 않았습니다.`))
      .catch(() => setBody('내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }, [policy, title]);

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '100px 20px 60px' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--color-text-primary)', marginBottom: '24px' }}>{title}</h1>
      <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>
        {body ?? '불러오는 중...'}
      </div>
    </main>
  );
}
