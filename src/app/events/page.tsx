'use client';
import { Suspense } from 'react';
import { EventsSection } from '@/components/EventsSection';

export default function EventsPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: '90px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--color-text-muted)' }}>로딩 중...</p></div>}>
      <EventsSection standalone={true} />
    </Suspense>
  );
}
