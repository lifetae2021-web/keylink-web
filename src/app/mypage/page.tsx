'use client';
import Link from 'next/link';
import { Calendar, Heart, Clock, ArrowRight, MapPin, CheckCircle, AlertCircle, User } from 'lucide-react';
import { mockEvents } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 더미 유저 데이터
const mockUser = {
  name: '김민준',
  gender: 'male',
  age: 28,
  job: '소프트웨어 엔지니어',
  phone: '010-****-1234',
};

const mockBookings = [
  {
    id: 'b1',
    eventId: 'event-busan-100',
    event: mockEvents[0],
    status: 'confirmed',
    hasRanked: true,
    matchStatus: 'matched',
    createdAt: new Date('2026-04-10'),
  },
  {
    id: 'b2',
    eventId: 'event-changwon-55',
    event: mockEvents[2],
    status: 'confirmed',
    hasRanked: false,
    matchStatus: 'pending',
    createdAt: new Date('2026-04-12'),
  },
  {
    id: 'b3',
    eventId: 'event-busan-101',
    event: mockEvents[1],
    status: 'pending_payment',
    hasRanked: false,
    matchStatus: 'pending',
    createdAt: new Date('2026-04-16'),
  },
  {
    id: 'b4',
    eventId: 'event-busan-102',
    event: mockEvents[0],
    status: 'pending_approval',
    hasRanked: false,
    matchStatus: 'pending',
    createdAt: new Date('2026-04-16'),
  },
];

export default function MyPage() {
  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh' }}>
      <section style={{
        padding: '60px 20px 40px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.08) 0%, transparent 70%)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF6F61, #FF8A71)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User size={36} color="#333333" />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>반갑습니다 👋</p>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                {mockUser.name} 님
              </h1>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  `${mockUser.gender === 'male' ? '남성' : '여성'}`,
                  `${mockUser.age}세`,
                  mockUser.job,
                ].map((tag) => (
                  <span key={tag} style={{
                    padding: '4px 12px', borderRadius: '100px',
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    fontSize: '0.8rem', color: 'var(--color-text-secondary)',
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px 80px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
          {[
            { label: '총 참가 횟수', value: `${mockBookings.length}회`, icon: Calendar },
            { label: '매칭 성공', value: '1회', icon: Heart },
            { label: '다음 행사', value: '4월 27일', icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={{
              background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center',
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,111,97,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Icon size={20} color="#FF6F61" />
              </div>
              <p style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1A1A1A' }}>{value}</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Bookings */}
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '20px', color: 'var(--color-text-primary)' }}>나의 예약 내역</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
          {mockBookings.map((booking) => (
            <div key={booking.id} style={{
              background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            }}>
              <div style={{
                height: '6px',
                background: booking.matchStatus === 'matched'
                  ? 'linear-gradient(90deg, #6EAE7C, #A0D5A8)'
                  : booking.matchStatus === 'pending'
                  ? 'linear-gradient(90deg, #FF6F61, #FF8A71)'
                  : 'linear-gradient(90deg, #9E8E7E, #7E6E64)',
              }} />
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                          {booking.event.title} {booking.event.episode}기
                        </h3>
                        
                        {/* 예약 상태 뱃지 */}
                        {booking.status === 'pending_approval' && <span className="kl-badge" style={{ background: 'rgba(255,111,97,0.1)', color: '#FF6F61', border: '1px solid rgba(255,111,97,0.3)' }}>⏳ 승인 대기중</span>}
                        {booking.status === 'pending_payment' && <span className="kl-badge" style={{ background: 'rgba(169,143,213,0.1)', color: '#A98FD5', border: '1px solid rgba(169,143,213,0.3)' }}>💳 결제 요망</span>}
                        {booking.status === 'confirmed' && (
                          <span className={`kl-badge ${booking.matchStatus === 'matched' ? 'kl-badge-open' : booking.matchStatus === 'pending' ? 'kl-badge-upcoming' : 'kl-badge-closed'}`}>
                            {booking.matchStatus === 'matched' ? '✅ 매칭 성공' : booking.matchStatus === 'pending' ? '⏳ 매칭 결과 대기' : '미매칭'}
                          </span>
                        )}
                      </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} color="var(--color-text-muted)" />
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                          {format(booking.event.date, 'M월 d일 (E) HH:mm', { locale: ko })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} color="var(--color-text-muted)" />
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{booking.event.venue}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
                    {booking.status === 'pending_approval' && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>운영진이 신청서와 사진을 검토 중입니다.</span>
                    )}
                    {booking.status === 'pending_payment' && (
                      <button className="kl-btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
                        결제하기
                      </button>
                    )}
                    {(booking.status === 'confirmed' && !booking.hasRanked) && (
                      <Link href="/matching" className="kl-btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
                        순위 입력하기
                      </Link>
                    )}
                    {(booking.status === 'confirmed' && booking.matchStatus === 'matched') && (
                      <Link href="/matching/result" className="kl-btn-outline" style={{ padding: '9px 18px', fontSize: '0.85rem' }}>
                        결과 확인 <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </div>

                {booking.hasRanked && (
                  <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,111,97,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={14} color="#FF6F61" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>순위 입력 완료 · 매칭 결과 대기 중</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <Link href="/events" style={{
            padding: '20px', borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,111,97,0.4)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,111,97,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={20} color="var(--color-primary)" />
            </div>
            <div>
              <p style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>다음 참여 신청</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>부산 일정 보기</p>
            </div>
          </Link>
          <Link href="/matching/result" style={{
            padding: '20px', borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,111,97,0.4)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(110,174,124,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Heart size={20} color="#6EAE7C" />
            </div>
            <div>
              <p style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>매칭 결과 확인</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>내 매칭 현황 보기</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
