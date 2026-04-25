'use client';

import Link from 'next/link';
import { Calendar, MapPin, Users, ArrowRight, Timer, LayoutGrid, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllSessions } from '@/lib/firestore/sessions';
import { Session } from '@/lib/types';

export default function StatusListPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const data = await getAllSessions();
        // v8.4.8: 최신 기수가 맨 위에 오도록 정렬 (이미 episodeNumber로 정산되어 내려올 수 있으나 date로 재검증)
        const sorted = data.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
        setSessions(sorted);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSessions();
  }, []);

  // Logic to determine status labels and colors (v8.4.8 확장)
  const getStatusInfo = (event: Session) => {
    const currentMale = event.currentMale || 0;
    const currentFemale = event.currentFemale || 0;
    const totalFilled = currentMale + currentFemale;
    const totalMax = (event.maxMale || 8) + (event.maxFemale || 8);
    const ratio = totalFilled / totalMax;
    const isPast = event.eventDate < new Date();

    if (isPast || event.status === 'completed') {
      return { label: '종료', color: '#666', bg: '#f1f1f1' };
    }
    if (event.status === 'voting' || event.status === 'matching') {
      return { label: '진행 중', color: '#111', bg: '#EBF3FF' };
    }
    if (event.status === 'closed' || ratio >= 0.95) {
      return { label: '모집 마감', color: '#C86A6A', bg: 'rgba(200,106,106,0.1)' };
    }
    if (ratio >= 0.7) {
      return { label: '마감 임박', color: '#fff', bg: 'linear-gradient(90deg, #FF9A8B, #FF6F61)' };
    }
    return { label: '모집 중', color: '#FF6F61', bg: '#FFF5F4' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)', minHeight: '100vh' }}>
      <div className="kl-container" style={{ paddingTop: '60px' }}>
        <header style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h1 style={{ fontSize: '2.8rem', fontWeight: '900', marginBottom: '16px', letterSpacing: '-0.04em' }}>
            전체 기수 <span style={{ color: '#FF6F61' }}>현황 라인업</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', fontWeight: '500' }}>
            진행 중인 기수부터 종료된 기수까지 모든 실시간 명단을 확인하세요. <span style={{ fontSize: '0.7rem', color: '#CCC' }}>v8.5.0 Premium</span>
          </p>
        </header>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
          gap: '30px'
        }}>
          {sessions.map((event) => {
            const status = getStatusInfo(event);
            const currentMale = event.currentMale || 0;
            const currentFemale = event.currentFemale || 0;
            const progressMale = currentMale / event.maxMale;
            const progressFemale = currentFemale / event.maxFemale;

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
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', marginBottom: '12px', color: '#111' }}>
                      {event.title}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', color: '#666', fontSize: '0.9rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={16} /> {event.region === 'busan' ? '부산' : '창원'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={16} /> {event.eventDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} {event.eventDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fcfcfc', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#666', width: '30px' }}>남성</span>
                      <div style={{ flex: 1, height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressMale * 100}%`, height: '100%', background: '#007AFF', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: progressMale >= 1 ? '#007AFF' : '#666' }}>{currentMale}/{event.maxMale}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#666', width: '30px' }}>여성</span>
                      <div style={{ flex: 1, height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressFemale * 100}%`, height: '100%', background: '#FF4D8D', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: progressFemale >= 1 ? '#FF4D8D' : '#666' }}>{currentFemale}/{event.maxFemale}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FF6F61', fontWeight: '800', fontSize: '0.9rem', marginTop: '4px' }}>
                    라인업 상세보기 <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            );
          })}
          
          {sessions.length === 0 && (
            <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '100px 0', background: '#fff', borderRadius: '32px', border: '2px dashed #eee' }}>
              <Users size={48} color="#ddd" style={{ marginBottom: '16px' }} />
              <p style={{ color: '#999', fontWeight: '700' }}>현재 모집 중인 기수가 없습니다.</p>
            </div>
          )}
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
