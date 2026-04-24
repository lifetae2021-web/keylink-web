'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Heart, MapPin, ArrowRight, Star,
  CheckCircle, Sparkles, ChevronLeft, ChevronRight
} from 'lucide-react';
import { REVIEWS } from '@/lib/constants/reviews';
import { EventsSection } from '@/components/EventsSection';
import { Suspense } from 'react';

export default function HomePage() {
  const [currentReview, setCurrentReview] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Auto-advance reviews
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentReview((prev) => (prev + 1) % REVIEWS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { value: '120기+', label: '누적 진행 회차', icon: Sparkles },
    { value: '94%', label: '참가자 만족도', icon: Star },
    { value: '2', label: '운영 지역', icon: MapPin },
    { value: '6:6~8:8', label: '소규모 진행', icon: Heart },
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
        <div style={{
          position: 'absolute', width: '600px', height: '600px',
          borderRadius: '50%', background: 'rgba(255,111,97,0.1)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          animation: 'float 8s ease-in-out infinite',
        }} />
        
        <div style={{
          textAlign: 'center',
          padding: '100px 20px 60px',
          maxWidth: '900px',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s ease',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '100px',
            background: 'rgba(255,111,97,0.12)', border: '1px solid rgba(255,111,97,0.25)',
            marginBottom: '32px',
          }}>
            <Sparkles size={14} color="var(--color-accent)" />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-accent)', letterSpacing: '0.08em' }}>
              2025년 론칭 · 120기 돌파 🎉
            </span>
          </div>

          <h1 className="kl-heading-xl" style={{ marginBottom: '24px', lineHeight: 1.3, fontSize: 'clamp(1.8rem, 4.5vw, 3rem)', wordBreak: 'keep-all', color: 'var(--color-text-primary)' }}>
            당신의 이상형에 맞는 <br /> <span style={{ color: '#FF6F61' }}>키워드</span>를 <span style={{ color: '#FF6F61' }}>연결</span>해드립니다
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
            로테이션 소개팅 <strong style={{ color: 'var(--color-accent)' }}>키링크</strong>에서<br/>진짜 인연을 만나보세요.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/events" className="kl-btn-primary" style={{ fontSize: '1rem', padding: '16px 36px' }}>
              참여 신청하기 <ArrowRight size={18} />
            </Link>
            <Link href="/notices" className="kl-btn-outline" style={{ fontSize: '1rem', padding: '16px 36px' }}>
              서비스 알아보기
            </Link>
          </div>

          <div style={{
            display: 'flex', gap: '32px', justifyContent: 'center',
            marginTop: '64px', flexWrap: 'wrap',
          }}>
            {[
              { num: '120기+', label: '누적 진행' },
              { num: '부산 & 창원', label: '운영 지역' },
              { num: '6:6~8:8', label: '소규모 진행' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', color: '#FF6F61', whiteSpace: 'nowrap' }}>{s.num}</p>
                <p style={{ fontSize: '0.8rem', color: '#1A1A1A', fontWeight: '600', marginTop: '4px', whiteSpace: 'nowrap' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT STATS ── */}
      <section style={{ padding: '80px 20px', background: '#F9F9F9' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#FF6F61', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>ABOUT 키링크</p>
            <h2 className="kl-heading-lg" style={{ color: '#1A1A1A', marginBottom: '16px' }}>
              왜 <span style={{ color: '#FF6F61' }}>키링크</span>인가요?
            </h2>
            <p style={{ color: '#4A4A4A', fontSize: '1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.8 }}>
              2025년 2월 론칭 후 단 11개월 만에 120기 돌파.<br/>입소문만으로 성장한 부산의 신뢰받는 소개팅 서비스
            </p>
          </div>

          <div className="kl-stats-container">
            <div className="kl-stats-grid">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="kl-stat-card">
                    <div className="kl-stat-icon-box">
                      {Icon && <Icon size={20} />}
                    </div>
                    <p className="kl-stat-value">{stat.value}</p>
                    <p className="kl-stat-label">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── UPCOMING EVENTS ── */}
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '80px', color: '#999' }}>로딩 중...</div>}>
         <EventsSection />
      </Suspense>

      {/* ── SIMPLE PROCESS SUMMARY ── */}
      <section style={{ padding: '80px 20px', background: 'var(--color-surface)', textAlign: 'center' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ marginBottom: '48px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#FF6F61', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>SERVICE PROCESS</p>
            <h2 className="kl-heading-lg">
              세상의 모든 인연은<br/><span className="kl-gradient-text">세 단계</span>로 시작됩니다
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', marginBottom: '48px' }}>
            {[
              { icon: '📝', title: '참여 신청', desc: '검증된 신분의 분들을 대상으로 엄격하게 선별합니다.' },
              { icon: '🥂', title: '현장 미팅', desc: '자유롭고 편안한 분위기에서 1:1 대화를 나눕니다.' },
              { icon: '💖', title: '매칭 및 연결', desc: '상호 호감 시 카카오톡 오픈채팅으로 바로 연결해 드립니다.' },
            ].map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{p.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '10px' }}>{p.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>

          <Link href="/how-it-works" className="kl-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            전체 진행 과정 자세히 보기 <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── POLICY (차별화 정책) ── */}
      <section className="kl-section">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>키링크 프라미스</p>
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
                &ldquo;{REVIEWS[currentReview]?.text}&rdquo;
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
                    <p style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{REVIEWS[currentReview]?.couple}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {REVIEWS[currentReview]?.region} {REVIEWS[currentReview]?.episode}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setCurrentReview((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length)}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-text-secondary)', transition: 'all 0.2s',
                    }}>
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => setCurrentReview((prev) => (prev + 1) % REVIEWS.length)}
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

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
              {REVIEWS.map((_, i) => (
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
            <Link href="/events?region=busan" className="kl-btn-primary" style={{ fontSize: '0.95rem', padding: '16px 40px' }}>
              📍 지금 바로 신청하기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Missing variable restoration
const Users = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
