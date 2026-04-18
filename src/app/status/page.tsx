'use client';

import Link from 'next/link';
import { Calendar, MapPin, Users, ArrowRight, Timer, LayoutGrid } from 'lucide-react';
import { mockEvents } from '@/lib/mockData';

export default function StatusListPage() {
  // Logic to determine status labels and colors
  const getStatusInfo = (event: any) => {
    const totalFilled = event.currentMale + event.currentFemale;
    const totalMax = event.maxMale + event.maxFemale;
    const ratio = totalFilled / totalMax;

    if (event.status === 'closed') {
      return { label: '진행 완료', color: '#999', bg: '#f5f5f5' };
    }
    if (ratio >= 0.8) {
      return { label: '마감 임박', color: '#fff', bg: 'linear-gradient(90deg, #FF9A8B, #FF6F61)' };
    }
    return { label: '모집 중', color: '#FF6F61', bg: '#FFF5F4' };
  };

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="kl-container" style={{ paddingTop: '60px' }}>
        <header style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h1 style={{ fontSize: '2.8rem', fontWeight: '900', marginBottom: '16px', letterSpacing: '-0.04em' }}>
            현재 모집 중인 <span style={{ color: '#FF6F61' }}>기수 명단</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', fontWeight: '500' }}>
            지점별 라인업과 모집 상태를 확인하고 원하는 기수에 참여하세요.
          </p>
        </header>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
          gap: '30px'
        }}>
          {mockEvents.map((event) => {
            const status = getStatusInfo(event);
            const progressMale = event.currentMale / event.maxMale;
            const progressFemale = event.currentFemale / event.maxFemale;

            return (
              <Link 
                key={event.id}
                href={`/status/${event.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ 
                  background: '#fff',
                  borderRadius: '32px',
                  padding: '32px',
                  border: '1.5px solid #eee',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.borderColor = '#FF6F61';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(255,111,97,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#eee';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ 
                      padding: '6px 16px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: '800',
                      background: status.bg, color: status.color,
                      boxShadow: status.label === '마감 임박' ? '0 4px 12px rgba(255,111,97,0.3)' : 'none'
                    }}>
                      {status.label}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: '700' }}>
                      {event.episode}기
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', marginBottom: '12px', color: '#111' }}>
                      {event.title}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', color: '#666', fontSize: '0.9rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={16} /> {event.venue}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={16} /> {new Date(event.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fcfcfc', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#666', width: '30px' }}>남성</span>
                      <div style={{ flex: 1, height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressMale * 100}%`, height: '100%', background: '#007AFF', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: progressMale >= 1 ? '#007AFF' : '#666' }}>{event.currentMale}/{event.maxMale}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#666', width: '30px' }}>여성</span>
                      <div style={{ flex: 1, height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressFemale * 100}%`, height: '100%', background: '#FF4D8D', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: progressFemale >= 1 ? '#FF4D8D' : '#666' }}>{event.currentFemale}/{event.maxFemale}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FF6F61', fontWeight: '800', fontSize: '0.9rem', marginTop: '4px' }}>
                    현황 상세 보기 <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 480px) {
          h1 { font-size: 2rem !important; }
          .kl-container { padding: 0 20px; }
        }
      `}</style>
    </div>
  );
}
