'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Calendar, MapPin, Users, Search, Filter } from 'lucide-react';
import { mockEvents } from '@/lib/mockData';
import { KeylinkEvent } from '@/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Suspense } from 'react';

function EventsContent() {
  const searchParams = useSearchParams();
  const regionParam = searchParams.get('region');
  const [activeRegion, setActiveRegion] = useState<'all' | 'busan' | 'changwon'>(
    (regionParam as 'busan' | 'changwon') || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = mockEvents.filter((e) => {
    const matchRegion = activeRegion === 'all' || e.region === activeRegion;
    const matchSearch = e.title.includes(searchQuery) || e.venue.includes(searchQuery);
    return matchRegion && matchSearch;
  });

  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh' }}>
      {/* Header */}
      <section style={{
        padding: '60px 20px 40px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.1) 0%, transparent 70%)',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>EVENTS</p>
        <h1 className="kl-heading-lg" style={{ marginBottom: '16px' }}>
          <span className="kl-gradient-text">일정 신청</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '32px' }}>
          부산·창원 로테이션 소개팅 일정을 확인하고 신청하세요
        </p>

        {/* Search */}
        <div style={{ maxWidth: '400px', margin: '0 auto 24px', position: 'relative' }}>
          <Search size={17} color="var(--color-text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="kl-input" placeholder="지역, 장소로 검색..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '44px' }}
          />
        </div>

        {/* Region tabs */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: '전체' },
            { key: 'busan', label: '📍 부산점' },
            { key: 'changwon', label: '📍 창원점' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`region-tab ${activeRegion === tab.key ? 'active' : ''}`}
              onClick={() => setActiveRegion(tab.key as 'all' | 'busan' | 'changwon')}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
            {event.region === 'busan' ? '📍 BUSAN' : '📍 CHANGWON'}
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '1.3rem', fontWeight: '800', color: '#FF6F61' }}>
            {event.price.toLocaleString()}원
          </p>
          {!isSoldOut && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#FF6F61', fontSize: '0.85rem', fontWeight: '600' }}>
              신청하기 <ArrowRight size={14} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: '90px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--color-text-muted)' }}>로딩 중...</p></div>}>
      <EventsContent />
    </Suspense>
  );
}
