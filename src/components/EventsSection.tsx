'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Calendar, MapPin, Users, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockEvents } from '@/lib/mockData';
import { KeylinkEvent } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

export function EventsSection({ standalone = false }: { standalone?: boolean }) {
  const searchParams = useSearchParams();
  const regionParam = searchParams ? searchParams.get('region') : null;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const filtered = mockEvents.filter((e) => {
    return selectedDate ? isSameDay(e.date, selectedDate) : true;
  });

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
          <span className="kl-gradient-text">참여 신청</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>
          부산 로테이션 소개팅 일정을 확인하고 신청하세요
        </p>


      </section>

      {/* Calendar View */}
      <section className="kl-calendar-wrapper">
        <EventCalendar events={filtered} onDateSelect={setSelectedDate} selectedDate={selectedDate} />
      </section>

      {/* Events Grid */}
      <section className="kl-section">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '3rem', marginBottom: '16px' }}>😢</p>
            <p>해당 조건의 일정이 없습니다.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
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
  const soldOutM = event.currentMale >= event.maxMale;
  const soldOutF = event.currentFemale >= event.maxFemale;
  const isSoldOut = soldOutM || soldOutF;

  return (
    <Link href={`/events/${event.id}`} className="event-card">
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
          <span className={`kl-badge kl-badge-${isSoldOut ? 'closed' : event.status === 'open' ? 'open' : 'upcoming'}`}>
            {isSoldOut ? '마감' : event.status === 'open' ? '모집중' : '오픈예정'}
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
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              남 {event.currentMale}/{event.maxMale} · 여 {event.currentFemale}/{event.maxFemale}
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
          {!isSoldOut && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF6F61', fontSize: '0.85rem', fontWeight: '700', paddingBottom: '4px' }}>
              신청하기 <ArrowRight size={14} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
