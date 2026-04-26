'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Users, ArrowRight, Timer, LayoutGrid, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllSessions } from '@/lib/firestore/sessions';
import { Session } from '@/lib/types';

export default function StatusListPage() {
  const router = useRouter();
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

  const getStatusInfo = (event: Session) => {
    const currentMale = event.currentMale || 0;
    const currentFemale = event.currentFemale || 0;
    const totalFilled = currentMale + currentFemale;
    const totalMax = (event.maxMale || 0) + (event.maxFemale || 0);
    const now = new Date();
    const twoHoursAfter = new Date(event.eventDate.getTime() + 2 * 60 * 60 * 1000);
    const isFull = (event.maxMale > 0 && currentMale >= event.maxMale) && (event.maxFemale > 0 && currentFemale >= event.maxFemale);

    if (now >= twoHoursAfter) return { label: '종료', color: '#64748b', bg: '#f1f5f9' };
    if (now >= event.eventDate) return { label: '진행 중', color: '#1d4ed8', bg: '#dbeafe' };
    if (isFull) return { label: '모집 마감', color: '#dc2626', bg: '#fee2e2' };
    return { label: '모집 중', color: '#047857', bg: '#d1fae5' };
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
      <div className="kl-container" style={{ paddingTop: '120px' }}>
        <header className="status-header" style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h1 style={{ fontSize: '2.8rem', fontWeight: '900', marginBottom: '16px', letterSpacing: '-0.04em' }}>
            전체 기수 <span style={{ color: '#FF6F61' }}>현황 라인업</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', fontWeight: '500' }}>
            진행 중인 기수부터 종료된 기수까지 모든 실시간 명단을 확인하세요.
          </p>
        </header>

        <div className="status-grid" style={{
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
              <div
                key={event.id}
                className="status-card"
                onClick={() => router.push(`/status/${event.id}`)}
                style={{
                  background: '#fff',
                  borderRadius: '32px',
                  padding: '32px',
                  border: '1.5px solid #eee',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  gap: '24px',
                  textDecoration: 'none',
                  color: 'inherit',
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{
                      alignSelf: 'flex-start',
                      padding: '6px 16px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: '800',
                      background: status.bg, color: status.color,
                    }}>
                      {status.label}
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', margin: 0, lineHeight: 1.3 }}>
                      {event.title}
                    </h3>
                  </div>

                  <div>
                    {(event as any).targetMaleAge && (
                      <div style={{ display: 'inline-flex', marginBottom: '12px', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 8px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>남성 연령 : {(event as any).targetMaleAge}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#666', fontSize: '0.9rem', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={16} /> {event.eventDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} {event.eventDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={16} /> {(event as any).venue ?? (event.region === 'busan' ? '부산' : '창원')}
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#999', textDecoration: 'line-through' }}>
                        {(event as any).originalPrice ? `${((event as any).originalPrice).toLocaleString()}원` : '39,000원'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61', background: 'rgba(255,111,97,0.1)', padding: '1px 6px', borderRadius: '4px' }}>26% OFF</span>
                    </div>
                    <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#FF6F61' }}>
                      {(event as any).price ? `${((event as any).price).toLocaleString()}원` : '29,000원'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <Link href={`/status/${event.id}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FF6F61', fontWeight: '800', fontSize: '0.9rem', textDecoration: 'none' }}>
                      라인업 상세보기 <ArrowRight size={16} />
                    </Link>
                    {(status.label === '모집 중' || status.label === '모집 마감') && (
                      <Link
                        href={`/events/${event.id}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          background: '#FF6F61', color: '#fff',
                          fontSize: '0.8rem', fontWeight: '800',
                          padding: '8px 16px', borderRadius: '100px',
                          textDecoration: 'none',
                        }}
                      >
                        {status.label === '모집 마감' ? '대기자 신청하기' : '신청하기'}
                      </Link>
                    )}
                  </div>
              </div>
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
        @media (max-width: 640px) {
          h1 { font-size: 1.8rem !important; }
          .kl-container { padding: 0 16px !important; padding-top: 100px !important; }
          .status-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .status-card { padding: 20px !important; border-radius: 20px !important; }
          .status-header { margin-bottom: 30px !important; }
        }
      `}</style>
    </div>
  );
}
