'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Users, ArrowRight, Timer, LayoutGrid, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getAllSessions } from '@/lib/firestore/sessions';
import { Session, Application } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function StatusListPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userApps, setUserApps] = useState<Record<string, Application>>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const rawData = await getAllSessions();
        const data = rawData.filter(s => !s.isTest); // v10.0.0: 테스트 기수는 일반 현황 목록에서 제외
        // v8.4.9: 스마트 정렬 로직 적용
        const now = new Date();
        const sorted = data.sort((a, b) => {
          const aFinished = now.getTime() >= (a.eventDate.getTime() + 2 * 60 * 60 * 1000);
          const bFinished = now.getTime() >= (b.eventDate.getTime() + 2 * 60 * 60 * 1000);

          // 1. 둘 다 진행 중인 경우: 날짜가 가까운 순 (오름차순)
          if (!aFinished && !bFinished) return a.eventDate.getTime() - b.eventDate.getTime();

          // 2. 둘 다 종료된 경우: 최근에 종료된 순 (내림차순)
          if (aFinished && bFinished) return b.eventDate.getTime() - a.eventDate.getTime();

          // 3. 하나만 종료된 경우: 진행 중인 것을 위로
          return aFinished ? 1 : -1;
        });
        setSessions(sorted);
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSessions();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const q = query(
            collection(db, 'applications'),
            where('userId', '==', currentUser.uid)
          );
          const snap = await getDocs(q);
          const apps: Record<string, Application> = {};
          snap.forEach(doc => {
            const data = doc.data() as Application;
            // v8.13.4: 동일 기수에 신청서가 여러 개일 경우 'confirmed' 상태를 최우선으로 저장
            const existingApp = apps[data.sessionId];
            if (!existingApp || (data.status === 'confirmed' && existingApp.status !== 'confirmed')) {
              apps[data.sessionId] = { ...data, id: doc.id };
            }
          });
          setUserApps(apps);
        } catch (error) {
          console.error("Error fetching user applications:", error);
        }
      } else {
        setUserApps({});
      }
    });

    return () => unsubscribe();
  }, []);

  const getStatusInfo = (event: Session) => {
    const currentMale = event.currentMale || 0;
    const currentFemale = event.currentFemale || 0;
    const totalFilled = currentMale + currentFemale;
    const now = new Date();
    const twoHoursAfter = new Date(event.eventDate.getTime() + 2 * 60 * 60 * 1000);
    const isFull = (event.maxMale > 0 && currentMale >= event.maxMale) && (event.maxFemale > 0 && currentFemale >= event.maxFemale);

    if (now >= twoHoursAfter) return { label: '종료', color: '#64748b', bg: '#f1f5f9' };
    if (now >= event.eventDate) return { label: '진행 중', color: '#1d4ed8', bg: '#dbeafe' };
    if (isFull) return { label: '모집 마감', color: '#dc2626', bg: '#fee2e2' };
    return { label: '모집 중', color: '#047857', bg: '#d1fae5' };
  };

  const confirmedSessions = sessions.filter(event => userApps[event.id]?.status === 'confirmed');
  const unconfirmedSessions = sessions.filter(event => userApps[event.id]?.status !== 'confirmed');

  const renderSessionCard = (event: Session, hideAlerts: boolean) => {
    const status = getStatusInfo(event);
    const isConfirmed = userApps[event.id]?.status === 'confirmed';
    const now = new Date();
    const openTime = new Date(event.eventDate.getTime() - 24 * 60 * 60 * 1000);
    const isOpen = now.getTime() >= openTime.getTime();

    return (
      <div key={event.id} style={{ position: 'relative' }}>
        <div
          className="status-card"
          onClick={() => isConfirmed && router.push(`/status/${event.id}`)}
          style={{
            background: '#fff',
            borderRadius: '32px',
            padding: '32px',
            border: '1.5px solid #eee',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
            cursor: isConfirmed ? 'pointer' : 'default',
            gap: '24px',
            color: 'inherit',
          }}
          onMouseEnter={e => {
            if (isConfirmed) {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.borderColor = '#FF6F61';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(255,111,97,0.12)';
            }
          }}
          onMouseLeave={e => {
            if (isConfirmed) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#eee';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                alignSelf: 'flex-start',
                padding: '6px 16px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: '800',
                background: status.bg, color: status.color,
              }}>
                {status.label}
              </div>
              {isConfirmed && !isOpen && (
                <div style={{
                  alignSelf: 'flex-start',
                  padding: '6px 16px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: '800',
                  background: '#FFF5F4', color: '#FF6F61', border: '1px solid rgba(255,111,97,0.2)'
                }}>
                  🔒 라인업 공개 대기
                </div>
              )}
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', margin: 0, lineHeight: 1.3 }}>
              {event.title}
            </h3>
          </div>

          <div>
            {(event as any).targetMaleAge && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>남성 연령 : {(event as any).targetMaleAge}</span>
                </div>
                <div style={{ paddingLeft: '4px' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', lineHeight: 1.4 }}>
                    • 여성분들은 남성 연령대 참고 후 신청해주세요.
                  </p>
                  <p style={{ fontSize: '0.68rem', fontWeight: '500', color: '#94a3b8', lineHeight: 1.4 }}>
                    • 선발 시 남녀간의 이상형과 나이대를<br/>
                    <span style={{ paddingLeft: '8px' }}>세밀하게 참고하여 최종 선정합니다.</span>
                  </p>
                </div>
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

          {(() => {
            if (hideAlerts) return null;

            const maleRemaining = Math.max(0, event.maxMale - (event.currentMale || 0));
            const femaleRemaining = Math.max(0, event.maxFemale - (event.currentFemale || 0));
            
            const showMaleAlert = maleRemaining <= 1;
            const showFemaleAlert = femaleRemaining <= 1;

            if (!showMaleAlert && !showFemaleAlert) return null;

            if (maleRemaining === 0 && femaleRemaining === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#6b7280', textAlign: 'center' }}>
                    남녀 마감 (대기 가능)
                  </div>
                </div>
              );
            }

            const getStatusText = (remaining: number, gender: 'male'|'female') => {
              const label = gender === 'male' ? '남성' : '여성';
              const defaultColor = gender === 'male' ? '#007AFF' : '#FF4D8D';
              if (remaining === 0) return { text: `${label} 마감 (대기 가능)`, color: '#6b7280' };
              if (remaining === 1) return { text: `${label} 마감 임박 (딱 1자리 남음!)`, color: '#e11d48' };
              return { text: `${label} 모집 중`, color: defaultColor };
            };

            const maleStatus = getStatusText(maleRemaining, 'male');
            const femaleStatus = getStatusText(femaleRemaining, 'female');

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff9f9', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ffe4e6' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: maleStatus.color }}>
                  {maleStatus.text}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: femaleStatus.color }}>
                  {femaleStatus.text}
                </div>
              </div>
            );
          })()}


        </div>
      </div>
    );
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
        </header>

        {/* 참가 확정된 기수 렌더링 (블러 없음) */}
        {confirmedSessions.length > 0 && (
          <div style={{ marginBottom: unconfirmedSessions.length > 0 ? '60px' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingLeft: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#333', margin: 0 }}>나의 참가 확정 기수</h2>
            </div>
            <div className="status-grid">
              {confirmedSessions.map(event => renderSessionCard(event, true))}
            </div>
          </div>
        )}

        {/* 미확정 기수 렌더링 (블러 + 원본 디자인 자물쇠) */}
        {unconfirmedSessions.length > 0 && (
          <div style={{ position: 'relative' }}>
            {confirmedSessions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingLeft: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF6F61' }}></div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#333', margin: 0 }}>진행 중인 다른 기수</h2>
              </div>
            )}
            
            <div className="status-grid" style={{
              filter: 'blur(8px)',
              opacity: 0.6,
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {unconfirmedSessions.map(event => renderSessionCard(event, false))}
            </div>

            {/* 원본 디자인 프라이빗 보드 덮개 */}
            <div style={{
              position: 'absolute', top: confirmedSessions.length > 0 ? 50 : 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
              zIndex: 10,
              padding: '20px',
              paddingTop: '80px',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.95)', 
                padding: '24px 20px', 
                borderRadius: '24px', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)', 
                border: '1px solid rgba(255,255,255,1)',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '12px', 
                width: '90%',
                maxWidth: '360px',
                backdropFilter: 'blur(10px)',
                pointerEvents: 'auto'
              }}>
                <div style={{ width: '48px', height: '48px', background: '#FFF5F4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6F61' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#111', marginBottom: '6px' }}>프라이빗 현황 보드 🔒</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                    참가 확정자만 라인업을 볼 수 있습니다.<br/>간편한 참여 신청 후,<br/>실시간 매칭 라인업을 확인해 보세요.
                  </p>
                </div>
                <Link href="/events" style={{
                  marginTop: '6px', background: '#111', color: '#fff', padding: '12px 24px', borderRadius: '100px', fontSize: '0.9rem', fontWeight: '800', textDecoration: 'none', transition: 'all 0.2s', width: '100%'
                }}>
                  지금 참여 신청하기 👉
                </Link>
              </div>
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div style={{ gridColumn: 'span 12', textAlign: 'center', padding: '100px 0', background: '#fff', borderRadius: '32px', border: '2px dashed #eee' }}>
            <Users size={48} color="#ddd" style={{ marginBottom: '16px' }} />
            <p style={{ color: '#999', fontWeight: '700' }}>현재 모집 중인 기수가 없습니다.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 30px;
        }
        @media (max-width: 640px) {
          h1 { font-size: 1.8rem !important; }
          .kl-container { padding: 0 16px !important; padding-top: 100px !important; }
          .status-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          .status-card {
            padding: 24px 20px !important;
            border-radius: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
