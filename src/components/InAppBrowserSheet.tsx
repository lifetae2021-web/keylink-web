'use client';

import { ReactNode } from 'react';

interface InAppBrowserSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// 인앱 브라우저 안내용 하단 시트
export default function InAppBrowserSheet({ title, onClose, children }: InAppBrowserSheetProps) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '480px', padding: '28px 24px calc(28px + env(safe-area-inset-bottom))', boxShadow: '0 -20px 60px rgba(0,0,0,0.12)' }}
      >
        <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '100px', margin: '0 auto 20px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', textAlign: 'center', marginBottom: '14px', wordBreak: 'keep-all' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
