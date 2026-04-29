'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

import { KeylinkEvent } from '@/types';
import { Session } from '@/lib/types';
import { subscribeAllSessions } from '@/lib/firestore/sessions';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Application } from '@/lib/types';

// Firestore Session → KeylinkEvent 어댑터
function sessionToEvent(session: Session): KeylinkEvent {
  return {
    id: session.id,
    title: session.title || '로테이션 소개팅',
    region: session.region,
    venue: (session as any).venue ?? '서면역 인근 (개별 안내)',
    venueAddress: (session as any).venueAddress ?? '',
    date: session.eventDate,
    time: format(session.eventDate, 'HH:mm'),
    maxMale: session.maxMale,
    maxFemale: session.maxFemale,
    currentMale: session.currentMale,
    currentFemale: session.currentFemale,
    price: (session as any).price ?? 29000,
    originalPrice: (session as any).originalPrice ?? 39000,
    currentPrice: (session as any).price ?? 29000,
    status: session.status === 'open' ? 'open' : 'closed',
    description: (session as any).description ?? '키링크 프리미엄 공간에서 진행되는 로테이션 소개팅입니다.',
    rankingOpen: false,
    matchingOpen: session.status === 'voting' || session.status === 'matching' || session.status === 'completed',
    episode: session.episodeNumber,
    targetMaleAge: (session as any).targetMaleAge ?? '',
    targetFemaleAge: (session as any).targetFemaleAge ?? '',
    createdAt: session.createdAt,
  };
}

export function EventsSection({ standalone = false }: { standalone?: boolean }) {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<'busan' | 'changwon'>('busan');
  const [liveEvents, setLiveEvents] = useState<KeylinkEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userApps, setUserApps] = useState<Record<string, Application>>({});
  const [user, setUser] = useState<any>(null);

  // Firestore 실시간 구독
  useEffect(() => {
    const unsubscribe = subscribeAllSessions((sessions) => {
      // v1.9.8: 완료(completed) 상태를 제외한 모든 기수를 불러와 마감 기수 누락 방지
      const displayable = sessions.filter((s) => {
        const twoHoursAfter = new Date(s.eventDate.getTime() + 2 * 60 * 60 * 1000);
        const isFinished = new Date() >= twoHoursAfter;
        if (isFinished) return false;
        // 종료 전이면: completed는 isSoldOut인 경우만, 나머지 status는 모두 표시
        if (s.status === 'completed') {
          return (s.maxMale > 0 && (s.currentMale || 0) >= s.maxMale) && (s.maxFemale > 0 && (s.currentFemale || 0) >= s.maxFemale);
        }
        return true;
      });
      
      const mappedEvents = displayable.map(sessionToEvent);
      setLiveEvents(mappedEvents);
      setIsLoading(false);
    });

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
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
            apps[data.sessionId] = { ...data, id: doc.id };
          });
          setUserApps(apps);
        } catch (error) {
          console.error("Error fetching user applications:", error);
        }
      } else {
        setUserApps({});
      }
    });

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  // 카드 리스트용 필터링 및 정렬 (v1.9.8: 마감 기수 노출 24시간 유지)
  // v1.9.8: 날짜 기반 필터 제거 → status 기반으로만 처리
  // completed(종료) 기수는 구독 레벨에서 이미 제외됨
  // 따라서 여기서는 지역/날짜 필터만 적용하여 마감 기수도 정상 노출
  const now = new Date();
  const filtered = liveEvents
    .filter((e) => e.region === selectedRegion)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      // 선택한 날짜의 첫 번째 이벤트 찾기
      const targetEvent = filtered.find(e => isSameDay(e.date, date));
      if (targetEvent) {
        // DOM 업데이트(필요 시) 반영을 위해 약간의 딜레이
        setTimeout(() => {
          const el = document.getElementById(`event-${targetEvent.id}`);
          if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 100; // 상단 여백 100px 확보
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }, 50);
      }
    }
  };

  // 달력용 필터링 (지역만 유지, 날짜 필터 제거하여 상시 노출)
  const calendarEvents = liveEvents.filter(e => e.region === selectedRegion);

  return (
    <div style={{ paddingTop: standalone ? '40px' : '30px', paddingBottom: standalone ? '0' : '40px', minHeight: standalone ? '100vh' : 'auto' }}>
      {/* Header */}
      <section style={{
        padding: standalone ? '40px 20px 30px' : '0 20px 20px',
        background: standalone ? 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.1) 0%, transparent 70%)' : 'transparent',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>UPCOMING EVENTS</p>
        <h2 className="kl-heading-lg" style={{ marginBottom: '16px' }}>
          <span className="kl-gradient-text">{selectedRegion === 'busan' ? '부산' : '창원'} 참여 신청</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '20px' }}>
          {selectedRegion === 'busan' ? '부산' : '창원'} 로테이션 소개팅 일정을 확인하고 신청하세요.
        </p>

        {/* Region Filter */}
        <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '14px', gap: '4px', marginBottom: '12px' }}>
          {[
            { id: 'busan', label: '📍 부산점' },
            { id: 'changwon', label: '📍 창원점' }
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRegion(r.id as 'busan' | 'changwon')}
              style={{
                padding: '10px 24px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '800', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: selectedRegion === r.id ? '#FFF' : 'transparent',
                color: selectedRegion === r.id ? '#FF6F61' : 'var(--color-text-muted)',
                boxShadow: selectedRegion === r.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* Calendar View */}
      <section className="kl-calendar-wrapper">
        <EventCalendar events={calendarEvents} onDateSelect={handleDateSelect} selectedDate={selectedDate} />
      </section>

      {/* Events Grid */}
      <section className="kl-section" style={{ paddingTop: '20px' }}>
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: '380px', borderRadius: '20px', background: 'var(--color-surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '24px', opacity: 0.8 }}>🌸</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '8px' }}>현재 준비 중인 기수가 없습니다.</p>
            <p style={{ fontSize: '0.9rem' }}>곧 새로운 기수로 찾아뵐게요!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filtered.map((event, idx) => {
              const isSelected = selectedDate ? isSameDay(event.date, selectedDate) : false;
              return (
                <div key={event.id} id={`event-${event.id}`} className="animate-fadeInUp" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <EventCard event={event} isSelected={isSelected} userApp={userApps[event.id]} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EventCalendar({ events, onDateSelect, selectedDate }: { events: KeylinkEvent[], onDateSelect: (d: Date | null) => void, selectedDate: Date | null }) {
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [autoMoved, setAutoMoved] = useState(false);

  // 현재 달에 이벤트가 없으면 가장 빠른 이벤트가 있는 달로 자동 이동
  useEffect(() => {
    if (autoMoved || events.length === 0) return;
    const thisMonth = startOfMonth(new Date());
    const hasEventThisMonth = events.some(e => isSameMonth(e.date, thisMonth));
    if (!hasEventThisMonth) {
      const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
      setCurrentDate(startOfMonth(sorted[0].date));
    }
    setAutoMoved(true);
  }, [events, autoMoved]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="kl-calendar-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
           <ChevronLeft color="var(--color-text-secondary)" />
        </button>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-text-primary)' }}>{format(currentDate, 'yyyy년 M월')}</h3>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
           <ChevronRight color="var(--color-text-secondary)" />
        </button>
      </div>

      {/* Calendar Notice */}
      <div style={{ textAlign: 'center', marginBottom: '20px', padding: '12px', background: 'rgba(255,111,97,0.04)', borderRadius: '12px', border: '1px dashed rgba(255,111,97,0.2)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#FF6F61', marginBottom: '4px' }}>
          ✨ 여성분들은 남성 연령대를 참고하여 신청해주세요!
        </p>
        <p style={{ fontSize: '0.7rem', fontWeight: '500', color: 'var(--color-text-muted)', letterSpacing: '-0.01em' }}>
          선발 시 남녀간의 이상형과 나이대를 세밀하게 참고하여 최종 선정합니다.
        </p>
      </div>

      {/* Days of week */}
      <div className="kl-calendar-grid" style={{ marginBottom: '4px' }}>
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="kl-calendar-day-header">{day}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="kl-calendar-grid">
        {days.map((day, idx) => {
          const eventsOnDay = events.filter(e => isSameDay(e.date, day));
          const isSelected = selectedDate && isSameDay(selectedDate, day);

          return (
            <div 
              key={day.toString()} 
              onClick={() => {
                  if (eventsOnDay.length > 0) {
                      onDateSelect(isSelected ? null : day);
                  }
              }}
              className="kl-calendar-cell"
              style={{ 
                border: isSelected ? '2px solid #FF6F61' : '1px solid rgba(0,0,0,0.05)',
                background: isSameMonth(day, monthStart) ? (eventsOnDay.length > 0 ? '#FFF5F4' : '#fff') : '#FAFAFA',
                cursor: eventsOnDay.length > 0 ? 'pointer' : 'default',
                opacity: isSameMonth(day, monthStart) ? 1 : 0.5,
                boxShadow: isSelected ? '0 4px 12px rgba(255,111,97,0.15)' : 'none'
              }}>
              <span 
                className="kl-calendar-date-badge"
                style={{ 
                  background: eventsOnDay.length > 0 ? '#FF6F61' : 'transparent',
                  color: eventsOnDay.length > 0 ? '#fff' : (isSameMonth(day, monthStart) ? 'var(--color-text-secondary)' : '#aaa'),
              }}>
                {format(day, 'd')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                {eventsOnDay.map((e, i) => (
                  <div key={i} className="kl-event-tag">
                    <p className="kl-event-tag-age">
                      남성 {e.targetMaleAge}
                    </p>
                    <p className="kl-event-tag-time">
                      {format(e.date, 'HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventCard({ event, isSelected = false, userApp }: { event: KeylinkEvent, isSelected?: boolean, userApp?: Application }) {
  const router = useRouter();
  const isSoldOut = (event.maxMale > 0 && event.currentMale >= event.maxMale) && (event.maxFemale > 0 && event.currentFemale >= event.maxFemale);

  // 배지 상태 및 레이블 결정 (v1.9.7: Admin-UI Sync)
  const now = new Date();
  const twoHoursAfter = new Date(event.date.getTime() + 2 * 60 * 60 * 1000);
  const isFinished = now >= twoHoursAfter;
  
  let badgeStatus = 'open';
  let badgeLabel = '모집 중';

  if (isSoldOut) {
    badgeStatus = 'closed';
    badgeLabel = '모집 마감';
  } else if (isFinished) {
    badgeStatus = 'finished';
    badgeLabel = '종료';
  } else if (now >= event.date) {
    badgeStatus = 'upcoming'; // '진행 중' 스타일 (blue)
    badgeLabel = '진행 중';
  }

  const badgeColor = isSoldOut
    ? { color: '#dc2626', bg: '#fee2e2' }
    : isFinished
    ? { color: '#64748b', bg: '#f1f5f9' }
    : now >= event.date
    ? { color: '#1d4ed8', bg: '#dbeafe' }
    : { color: '#047857', bg: '#d1fae5' };

  const progressMale = event.maxMale > 0 ? event.currentMale / event.maxMale : 0;
  const progressFemale = event.maxFemale > 0 ? event.currentFemale / event.maxFemale : 0;

  return (
    <Link
      href={`/events/${event.id}`}
      style={{
        background: isSelected ? '#FFF5F4' : '#fff',
        borderRadius: '32px',
        padding: '32px',
        border: isSelected ? '2px solid #FF6F61' : '1.5px solid #eee',
        boxShadow: isSelected ? '0 10px 30px rgba(255,111,97,0.15)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        cursor: 'pointer',
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
        e.currentTarget.style.borderColor = isSelected ? '#FF6F61' : '#eee';
        e.currentTarget.style.boxShadow = isSelected ? '0 10px 30px rgba(255,111,97,0.15)' : 'none';
        e.currentTarget.style.background = isSelected ? '#FFF5F4' : '#fff';
      }}
    >
      {/* 배지 + 타이틀 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{
          alignSelf: 'flex-start',
          padding: '6px 16px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: '800',
          background: badgeColor.bg, color: badgeColor.color,
        }}>
          {badgeLabel}
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>
          {event.title}
        </h3>
      </div>

      {/* 남성 연령 + 날짜/장소 */}
      <div>
        {event.targetMaleAge && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>남성 연령 : {event.targetMaleAge}</span>
            </div>
            <div style={{ paddingLeft: '4px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                • 여성분들은 남성 연령대 참고 후 신청해주세요.
              </p>
              <p style={{ fontSize: '0.68rem', fontWeight: '500', color: '#94a3b8', lineHeight: 1.4 }}>
                • 선발 시 남녀간 이상형과 나이대를 참고하여 선발합니다.
              </p>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} /> {format(event.date, 'M월 d일 (EEEE) · HH:mm', { locale: ko })}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', whiteSpace: 'pre-wrap' }}>
            <MapPin size={16} style={{ marginTop: '2px', flexShrink: 0 }} /> {event.venue}
          </div>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fcfcfc', padding: '16px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--color-text-muted)', width: '30px' }}>남성</span>
          <div style={{ flex: 1, height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(progressMale * 100, 100)}%`, height: '100%', background: '#007AFF', borderRadius: '3px' }} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: progressMale >= 1 ? '#007AFF' : 'var(--color-text-muted)' }}>{event.currentMale}/{event.maxMale}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--color-text-muted)', width: '30px' }}>여성</span>
          <div style={{ flex: 1, height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(progressFemale * 100, 100)}%`, height: '100%', background: '#FF4D8D', borderRadius: '3px' }} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: progressFemale >= 1 ? '#FF4D8D' : 'var(--color-text-muted)' }}>{event.currentFemale}/{event.maxFemale}</span>
        </div>
      </div>

      {/* 가격 + 신청 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#999', textDecoration: 'line-through' }}>40,000원</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61', background: 'rgba(255,111,97,0.1)', padding: '1px 6px', borderRadius: '4px' }}>28% OFF</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#FF6F61' }}>
              {(event.currentPrice || event.price).toLocaleString()}원
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#888888', marginLeft: '5px' }}>
              여성
            </span>
          </div>
        </div>
        {!isFinished && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/events/${event.id}`); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: userApp?.status === 'confirmed' ? '#10b981' : (userApp ? '#94a3b8' : '#FF6F61'),
              color: '#fff',
              fontSize: '0.8rem', fontWeight: '800',
              padding: '8px 16px', borderRadius: '100px',
              border: 'none', cursor: 'pointer',
            }}
          >
            {userApp?.status === 'confirmed' 
              ? '참가 확정' 
              : (userApp ? '신청완료' : (isSoldOut ? '대기자 신청하기' : '신청하기'))}
          </button>
        )}
      </div>
    </Link>
  );
}

