'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Calendar, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-react';

import { KeylinkEvent } from '@/types';
import { Session } from '@/lib/types';
import { subscribeAllSessions } from '@/lib/firestore/sessions';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

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

  // Firestore 실시간 구독
  useEffect(() => {
    const unsubscribe = subscribeAllSessions((sessions) => {
      // v1.9.8: 완료(completed) 상태를 제외한 모든 기수를 불러와 마감 기수 누락 방지
      const displayable = sessions.filter(
        (s) => s.status !== 'completed'
      );
      
      const mappedEvents = displayable.map(sessionToEvent);
      setLiveEvents(mappedEvents);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 카드 리스트용 필터링 및 정렬 (v1.9.8: 마감 기수 노출 24시간 유지)
  // v1.9.8: 날짜 기반 필터 제거 → status 기반으로만 처리
  // completed(종료) 기수는 구독 레벨에서 이미 제외됨
  // 따라서 여기서는 지역/날짜 필터만 적용하여 마감 기수도 정상 노출
  const filtered = liveEvents
    .filter((e) => {
      const dateMatch = selectedDate ? isSameDay(e.date, selectedDate) : true;
      const regionMatch = e.region === selectedRegion;
      return dateMatch && regionMatch;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // 달력용 필터링 (지역만 유지, 날짜 필터 제거하여 상시 노출)
  const calendarEvents = liveEvents.filter(e => e.region === selectedRegion);

  return (
    <div style={{ paddingTop: standalone ? '90px' : '60px', paddingBottom: standalone ? '0' : '40px', minHeight: standalone ? '100vh' : 'auto' }}>
      {/* Header */}
      <section style={{
        padding: standalone ? '60px 20px 40px' : '0 20px 40px',
        background: standalone ? 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.1) 0%, transparent 70%)' : 'transparent',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>UPCOMING EVENTS</p>
        <h2 className="kl-heading-lg" style={{ marginBottom: '16px' }}>
          <span className="kl-gradient-text">{selectedRegion === 'busan' ? '부산' : '창원'} 참여 신청</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '32px' }}>
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
                color: selectedRegion === r.id ? '#FF6F61' : '#888',
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
        <EventCalendar events={calendarEvents} onDateSelect={setSelectedDate} selectedDate={selectedDate} />
      </section>

      {/* Events Grid */}
      <section className="kl-section">
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: '380px', borderRadius: '20px', background: 'var(--color-surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '24px', opacity: 0.8 }}>🌸</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1A1A1A', marginBottom: '8px' }}>현재 준비 중인 기수가 없습니다.</p>
            <p style={{ fontSize: '0.9rem' }}>곧 새로운 기수로 찾아뵐게요!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filtered.map((event, idx) => (
              <div key={event.id} className="animate-fadeInUp" style={{ animationDelay: `${idx * 0.1}s` }}>
                <EventCard event={event} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventCalendar({ events, onDateSelect, selectedDate }: { events: KeylinkEvent[], onDateSelect: (d: Date | null) => void, selectedDate: Date | null }) {
  const [currentDate, setCurrentDate] = useState(new Date('2026-04-01T00:00:00'));

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
           <ChevronLeft color="#333" />
        </button>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1A1A1A' }}>{format(currentDate, 'yyyy년 M월')}</h3>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
           <ChevronRight color="#333" />
        </button>
      </div>

      {/* Days of week */}
      <div className="kl-calendar-grid" style={{ marginBottom: '12px' }}>
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
                  color: eventsOnDay.length > 0 ? '#fff' : (isSameMonth(day, monthStart) ? '#333' : '#aaa'),
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

function EventCard({ event }: { event: KeylinkEvent }) {
  // 남성 AND 여성 모두 정원이 찼을 때만 마감
  const soldOutM = event.currentMale >= event.maxMale;
  const soldOutF = event.currentFemale >= event.maxFemale;
  const isSoldOut = soldOutM && soldOutF;

  // 배지 상태 및 레이블 결정 (v1.9.7: Admin-UI Sync)
  const now = new Date();
  const twoHoursAfter = new Date(event.date.getTime() + 2 * 60 * 60 * 1000);
  const isFinished = now >= twoHoursAfter;
  
  let badgeStatus = 'open';
  let badgeLabel = '모집 중';

  if (isFinished) {
    badgeStatus = 'finished';
    badgeLabel = '종료';
  } else if (isSoldOut) {
    badgeStatus = 'closed';
    badgeLabel = '모집 마감';
  } else if (now >= event.date) {
    badgeStatus = 'upcoming'; // '진행 중' 스타일 (blue)
    badgeLabel = '진행 중';
  }

  return (
    <Link href={`/events/${event.id}`} className="event-card" style={{ 
      pointerEvents: isSoldOut ? 'none' : 'auto', 
      opacity: isSoldOut ? 0.6 : 1,
      filter: isSoldOut ? 'grayscale(0.5)' : 'none',
      cursor: isSoldOut ? 'not-allowed' : 'pointer'
    }}>
      <div style={{
        height: '180px',
        background: event.region === 'busan'
          ? 'linear-gradient(135deg, #FFF0F5, #FFE4E1)'
          : 'linear-gradient(135deg, #F8F8FF, #F0F0FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: event.region === 'busan'
            ? 'radial-gradient(circle at 50% 50%, rgba(255,111,97,0.15), transparent 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(169,143,213,0.15), transparent 70%)',
        }} />
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <p style={{
            fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.12em',
            color: event.region === 'busan' ? '#E6E6FA' : '#C9A0E8',
            textTransform: 'uppercase', marginBottom: '8px',
          }}>
            {event.region === 'busan' ? '📍 부산' : '📍 창원'}
          </p>
          <p style={{ fontSize: '3rem', fontWeight: '900', color: '#333333', lineHeight: 1 }}>
            {event.episode}<span style={{ fontSize: '1.1rem' }}>기</span>
          </p>
        </div>
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <span className={`kl-badge kl-badge-${badgeStatus}`}>
            {badgeLabel}
          </span>
        </div>
      </div>

      <div style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
          {event.title}
        </h3>
        {event.targetMaleAge && (
            <div style={{ display: 'inline-flex', marginBottom: '12px', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 8px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>🎯 타겟 남성 연령: {event.targetMaleAge}년생</span>
            </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {format(event.date, 'M월 d일 (EEEE) · HH:mm', { locale: ko })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={14} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{event.venue}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={14} color="var(--color-text-muted)" />
            <span style={{ fontSize: '0.85rem', color: isSoldOut ? '#C86A6A' : 'var(--color-text-secondary)', fontWeight: isSoldOut ? '700' : '400' }}>
              남 {event.currentMale}/{event.maxMale} · 여 {event.currentFemale}/{event.maxFemale}
              {isSoldOut && ' · 정원 마감'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.85rem', color: '#999999', textDecoration: 'line-through' }}>
                {event.originalPrice ? `${event.originalPrice.toLocaleString()}원` : '39,000원'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61', background: 'rgba(255,111,97,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                26% OFF
              </span>
            </div>
            <p style={{ fontSize: '1.4rem', fontWeight: '900', color: '#FF6F61', lineHeight: 1.2 }}>
              {(event.currentPrice || event.price).toLocaleString()}원
            </p>
          </div>
          {isSoldOut ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#999', fontSize: '0.85rem', fontWeight: '700', padding: '6px 12px', borderRadius: '8px', border: '1px solid #ddd' }}>
              모집 마감
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF6F61', fontSize: '0.85rem', fontWeight: '700', paddingBottom: '4px' }}>
              신청하기 <ArrowRight size={14} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

