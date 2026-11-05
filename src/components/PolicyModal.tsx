'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getContent } from '@/lib/firestore/cms';

export type PolicyKey = 'terms' | 'privacy';
export const POLICY_TITLE: Record<PolicyKey, string> = { terms: '이용약관', privacy: '개인정보처리방침' };

// 이용약관·개인정보처리방침 전문 창(관리자 CMS에 저장된 글을 그대로 보여 준다)
export default function PolicyModal({ policy, onClose }: { policy: PolicyKey; onClose: () => void }) {
  const title = POLICY_TITLE[policy];
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getContent(policy)
      .then(b => { if (alive) setBody(b || `${title}이 아직 등록되지 않았습니다.`); })
      .catch(() => { if (alive) setBody('내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); });
    return () => { alive = false; };
  }, [policy, title]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#111' }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', fontSize: '0.85rem', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>
          {body ?? '불러오는 중...'}
        </div>
      </div>
    </div>
  );
}

// 동의 항목 옆 '보기' 버튼(줄 바꿈 없이 한 줄)
export function PolicyViewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#94A3B8', textDecoration: 'underline', whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      보기
    </button>
  );
}
