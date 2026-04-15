'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Heart, MapPin, Calendar, Users, ArrowRight, Star,
  Shield, RefreshCw, Gift, ChevronLeft, ChevronRight,
  CheckCircle, Clock, Sparkles
} from 'lucide-react';
import { mockEvents, mockReviews } from '@/lib/mockData';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function HomePage() {
  const [activeRegion, setActiveRegion] = useState<'all' | 'busan' | 'changwon'>('all');
  const [currentReview, setCurrentReview] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Auto-advance reviews
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentReview((prev) => (prev + 1) % mockReviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = activeRegion === 'all'
    ? mockEvents
    : mockEvents.filter((e) => e.region === activeRegion);

  const stats = [
    { value: '100기+', label: '누적 진행 회차', icon: Sparkles },
    { value: '94%', label: '참가자 만족도', icon: Star },
    { value: '2', label: '운영 지역', icon: MapPin },
    { value: '소규모', label: '8명 이하 프리미엄', icon: Users },
  ];

  const steps = [
    { num: '01', title: '회원가입 & 예약', desc: '본인인증 완료 후 원하는 지역·날짜 선택, 결제로 예약 완료' },
    { num: '02', title: '행사 당일 참석', desc: '신분증 지참 후 파티룸/카페 방문. 운영팀이 자리 안내' },
    { num: '03', title: '1:1 로테이션 대화', desc: '모든 이성과 9분 30초 집중 대화. 남성 참가자가 순서대로 이동' },
    { num: '04', title: '호감도 순위 입력', desc: '행사 종료 후 웹사이트에서 1~3순위 선택하여 제출' },
    { num: '05', title: '매칭 결과 확인', desc: '상호 호감 매칭 시 상대방 연락처·오픈채팅방 링크 공개' },
    { num: '06', title: '새로운 시작 ✨', desc: '매칭 성공 시 카카오 오픈채팅방을 통해 자연스러운 만남 시작' },
  ];

  const policies = [
    {
      icon: '💸',
      title: '중복 만남 100% 환불',
      subtitle: 'ZERO REPEAT GUARANTEE',
      desc: '이전에 매칭된 상대방과 같은 자리에서 재회할 경우 참가비 전액을 환불해 드립니다.',
      color: '#FF6F61',
    },
    {
      icon: '🔄',
      title: '미매칭 30% 환불',
      subtitle: 'MATCH FAIL REFUND',
      desc: '최종 매칭이 성사되지 않을 경우 참가비의 30%를 환불해 드립니다. 도전을 응원합니다.',
      color: '#A98FD5',
    },
    {
      icon: '💌',
      title: '매칭 성공 혜택',
      subtitle: 'MATCH SUCCESS BONUS',
      desc: '매칭 성공 시 오픈채팅방을 통해 즉시 연결. 어색함 없이 자연스러운 첫 대화를 시작하세요.',
      color: '#6EAE7C',
    },
  ];

  return (
    <div>
      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,219,233,0.3) 0%, rgba(253,253,253,1) 75%)',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', width: '600px', height: '600px',
          borderRadius: '50%', background: 'rgba(255,219,233,0.2)',
          border: '1px solid rgba(255,219,233,0.4)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          animation: 'float 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px',
          borderRadius: '50%', background: 'rgba(255,219,233,0.3)',
          border: '1px solid rgba(255,219,233,0.5)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          animation: 'float 6s ease-in-out infinite 1s',
        }} />

        <div style={{
          textAlign: 'center',
          padding: '100px 20px 60px',
          maxWidth: '900px',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s ease',
        }}>
          {/* Tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '100px',
            background: 'rgba(255,111,97,0.12)', border: '1px solid rgba(255,111,97,0.25)',
            marginBottom: '32px',
          }}>
            <Sparkles size={14} color="var(--color-accent)" />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-accent)', letterSpacing: '0.08em' }}>
              2025년 론칭 · 100기 돌파 🎉
            </span>
          </div>

          <h1 className="kl-heading-xl" style={{ marginBottom: '24px', lineHeight: 1.3, fontSize: 'clamp(1.8rem, 4.5vw, 3rem)', wordBreak: 'keep-all' }}>
            <span style={{ color: 'var(--color-text-primary)', display: 'block' }}>당신의 이상형에 맞는</span>
            <span className="kl-gradient-text">키워드를 연결해드립니다</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.8,
            marginBottom: '48px',
            maxWidth: '600px',
            margin: '0 auto 48px',
            wordBreak: 'keep-all',
          }}>
            로테이션 소개팅 <strong style={{ color: 'var(--color-accent)' }}>키링크(Keylink)</strong>에서<br/>진짜 인연을 만나보세요.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/events" className="kl-btn-primary" style={{ fontSize: '1rem', padding: '16px 36px' }}>
              일정 신청하기 <ArrowRight size={18} />
            </Link>
            <Link href="/notices" className="kl-btn-outline" style={{ fontSize: '1rem', padding: '16px 36px' }}>
              서비스 알아보기
            </Link>
          </div>

          {/* Quick stats */}
          <div style={{
            display: 'flex', gap: '32px', justifyContent: 'center',
            marginTop: '64px', flexWrap: 'wrap',
          }}>
            {[
              { num: '100기+', label: '누적 진행' },
              { num: '부산·창원', label: '운영 지역' },
              { num: '8명↓', label: '소규모 진행' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: '#FF6F61' }}>{s.num}</p>
                <p style={{ fontSize: '0.8rem', color: '#1A1A1A', fontWeight: '600', marginTop: '4px' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT STATS ── */}
      <section style={{ padding: '80px 20px', background: '#F9F9F9' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#FF6F61', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>ABOUT KEYLINK</p>
            <h2 className="kl-heading-lg" style={{ color: '#1A1A1A', marginBottom: '16px' }}>
              왜 <span style={{ color: '#FF6F61' }}>키링크</span>인가요?
            </h2>
            <p style={{ color: '#4A4A4A', fontSize: '1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.8 }}>
              2025년 2월 론칭 후 단 11개월 만에 100기 돌파.<br/>입소문만으로 성장한 부산·창원의 신뢰받는 소개팅 서비스
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="kl-card" style={{ textAlign: 'center', background: '#FFFFFF', border: '1px solid #F0E5DE' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'rgba(255,111,97,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    <Icon size={24} color="var(--color-primary-light)" />
                  </div>
                  <p style={{ fontSize: '2rem', fontWeight: '800', background: 'linear-gradient(135deg, #FF6F61, #E6E6FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' }}>{stat.value}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── UPCOMING EVENTS ── */}
      <section className="kl-section">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>UPCOMING EVENTS</p>
          <h2 className="kl-heading-lg" style={{ marginBottom: '32px' }}>
            <span className="kl-gradient-text">다가오는 일정</span>
          </h2>
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
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
          {filteredEvents.map((event) => {
            const spotsLeft = Math.min(event.maxMale - event.currentMale, event.maxFemale - event.currentFemale);
            const soldOutM = event.currentMale >= event.maxMale;
            const soldOutF = event.currentFemale >= event.maxFemale;

            return (
              <Link key={event.id} href={`/events/${event.id}`} className="event-card">
                {/* Card Header gradient */}
                <div style={{
                  height: '160px',
                  background: event.region === 'busan'
                    ? 'linear-gradient(135deg, #FFF0F5, #FFE4E1)'
                    : 'linear-gradient(135deg, #F8F8FF, #E6E6FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', width: '200px', height: '200px',
                    borderRadius: '50%',
                    background: event.region === 'busan'
                      ? 'radial-gradient(circle, rgba(255,111,97,0.2) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(230,230,250,0.5) 0%, transparent 70%)',
                    top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  }} />
                  <div style={{ textAlign: 'center', position: 'relative' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.1em', color: event.region === 'busan' ? '#FF6F61' : '#A98FD5', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {event.region === 'busan' ? '부산점' : '창원점'}
                    </p>
                    <p style={{ fontSize: '2.5rem', fontWeight: '800', color: '#333333', lineHeight: 1 }}>
                      {event.episode}<span style={{ fontSize: '1rem', fontWeight: '500' }}>기</span>
                    </p>
                  </div>
                  {/* Status badge */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <span className={`kl-badge kl-badge-${event.status === 'open' ? 'open' : event.status === 'upcoming' ? 'upcoming' : 'closed'}`}>
                      {event.status === 'open' ? '모집중' : event.status === 'upcoming' ? '오픈예정' : '마감'}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                    {event.title}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={14} color="var(--color-text-muted)" />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {format(event.date, 'M월 d일 (E) HH:mm', { locale: ko })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={14} color="var(--color-text-muted)" />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{event.venue}</span>
                    </div>
                  </div>

                  {/* Gender slots */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <div style={{
                      flex: 1, padding: '10px', borderRadius: '10px',
                      background: soldOutM ? 'rgba(200,106,106,0.1)' : 'rgba(100,150,200,0.1)',
                      border: `1px solid ${soldOutM ? 'rgba(200,106,106,0.2)' : 'rgba(100,150,200,0.2)'}`,
                      textAlign: 'center',
                    }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>남성</p>
                      <p style={{ fontSize: '0.95rem', fontWeight: '700', color: soldOutM ? '#C86A6A' : '#6A98C8' }}>
                        {soldOutM ? '마감' : `${event.currentMale}/${event.maxMale}`}
                      </p>
                    </div>
                    <div style={{
                      flex: 1, padding: '10px', borderRadius: '10px',
                      background: soldOutF ? 'rgba(200,106,106,0.1)' : 'rgba(200,120,160,0.1)',
                      border: `1px solid ${soldOutF ? 'rgba(200,106,106,0.2)' : 'rgba(200,120,160,0.2)'}`,
                      textAlign: 'center',
                    }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>여성</p>
                      <p style={{ fontSize: '0.95rem', fontWeight: '700', color: soldOutF ? '#C86A6A' : '#C878A0' }}>
                        {soldOutF ? '마감' : `${event.currentFemale}/${event.maxFemale}`}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: '800', background: 'linear-gradient(135deg, #FF6F61, #E6E6FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {event.price.toLocaleString()}원
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary-light)', fontSize: '0.85rem', fontWeight: '600' }}>
                      신청하기 <ArrowRight size={15} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link href="/events" className="kl-btn-outline">
            전체 일정 보기 <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '80px 20px', background: 'var(--color-surface)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>HOW IT WORKS</p>
            <h2 className="kl-heading-lg">
              <span className="kl-gradient-text">키링크</span>는 이렇게 진행됩니다
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {steps.map((step, idx) => (
              <div key={idx} style={{
                background: 'var(--gradient-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '28px 24px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,111,97,0.4)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{
                  position: 'absolute', top: '16px', right: '16px',
                  fontSize: '3rem', fontWeight: '900', color: 'rgba(255,111,97,0.06)',
                  lineHeight: 1, userSelect: 'none',
                }}>{step.num}</div>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #FFDBE9, #E6E6FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px', fontWeight: '800', color: '#333333', fontSize: '0.9rem',
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '10px', color: 'var(--color-text-primary)' }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POLICY (차별화 정책) ── */}
      <section className="kl-section">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>KEYLINK PROMISE</p>
          <h2 className="kl-heading-lg" style={{ marginBottom: '16px' }}>
            키링크만의 <span className="kl-gradient-text">차별화 보장</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.8 }}>
            참가자 여러분의 소중한 시간과 마음을 보호하기 위한<br/>키링크의 약속입니다.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {policies.map((policy) => (
            <div key={policy.title} className="policy-card">
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>{policy.icon}</div>
              <p style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{policy.subtitle}</p>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '16px' }}>{policy.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>{policy.desc}</p>
              <div style={{
                marginTop: '24px', padding: '12px 16px',
                background: `rgba(${policy.color === '#FF6F61' ? '255,111,97' : policy.color === '#A98FD5' ? '169,143,213' : '110,174,124'}, 0.08)`,
                borderRadius: '10px',
                border: `1px solid rgba(${policy.color === '#FF6F61' ? '255,111,97' : policy.color === '#A98FD5' ? '169,143,213' : '110,174,124'}, 0.2)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={15} color={policy.color} />
                  <span style={{ fontSize: '0.8rem', color: policy.color, fontWeight: '600' }}>
                    {policy.title.includes('100%') ? '전액 환불 보장' : policy.title.includes('30%') ? '부분 환불 보장' : '즉시 연결 지원'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section style={{ padding: '80px 20px', background: 'var(--color-surface)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>SUCCESS STORIES</p>
            <h2 className="kl-heading-lg">
              키링크에서 만난 <span className="kl-gradient-text">인연들</span>
            </h2>
          </div>

          {/* Review Carousel */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '40px 48px',
              minHeight: '220px',
              transition: 'all 0.5s ease',
            }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                {[1,2,3,4,5].map((s) => <Star key={s} size={18} fill="#FF6F61" color="#FF6F61" />)}
              </div>
              <p style={{
                fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.9,
                marginBottom: '28px',
                fontStyle: 'italic',
              }}>
                &ldquo;{mockReviews[currentReview].text}&rdquo;
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6F61, #FFDBE9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Heart size={18} fill="#FFFFFF" color="#FFFFFF" />
                  </div>
                  <div>
                    <p style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{mockReviews[currentReview].couple}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {mockReviews[currentReview].region} {mockReviews[currentReview].episode}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setCurrentReview((prev) => (prev - 1 + mockReviews.length) % mockReviews.length)}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-text-secondary)', transition: 'all 0.2s',
                    }}>
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => setCurrentReview((prev) => (prev + 1) % mockReviews.length)}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-text-secondary)', transition: 'all 0.2s',
                    }}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
              {mockReviews.map((_, i) => (
                <button key={i} onClick={() => setCurrentReview(i)}
                  style={{
                    width: i === currentReview ? '24px' : '8px',
                    height: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: i === currentReview ? 'var(--color-primary)' : 'var(--color-border)',
                    transition: 'all 0.3s',
                  }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{
        padding: '80px 20px',
        background: 'linear-gradient(135deg, rgba(255,219,233,0.3) 0%, rgba(253,248,250,1) 50%, rgba(255,219,233,0.3) 100%)',
        borderTop: '1px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="kl-heading-lg" style={{ marginBottom: '20px' }}>
            지금 바로 <span className="kl-gradient-text">신청하세요</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '40px' }}>
            자리는 매우 빠르게 마감됩니다.<br/>
            오늘 신청해서 다음 주말 새로운 인연을 만나보세요.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/events?region=busan" className="kl-btn-primary" style={{ fontSize: '0.95rem' }}>
              📍 부산 일정 보기
            </Link>
            <Link href="/events?region=changwon" className="kl-btn-primary" style={{ fontSize: '0.95rem', background: 'linear-gradient(135deg, #A98FD5, #D5A0E8)' }}>
              📍 창원 일정 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
