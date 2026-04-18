'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Users, ShieldCheck, RefreshCcw, ArrowRight, Heart, Timer, MapPin, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockLineup } from '@/lib/mockData';

export default function StatusPage() {
  const [activeTab, setActiveTab] = useState<'male' | 'female'>('male');
  const [watchers, setWatchers] = useState(24);
  
  useEffect(() => {
    // Randomize watchers slightly to simulate real-time activity
    const interval = setInterval(() => {
      setWatchers(prev => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(18, Math.min(42, prev + delta));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const maleCount = mockLineup.filter(p => p.gender === 'male').length;
  const femaleCount = mockLineup.filter(p => p.gender === 'female').length;
  const filteredLineup = mockLineup.filter(p => p.gender === activeTab);

  const progressMale = 7 / 8;
  const progressFemale = 8 / 8;

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)' }}>
      {/* Real-time Status Header */}
      <div style={{ 
        position: 'sticky', top: '85px', zIndex: 100,
        background: 'rgba(255, 111, 97, 0.9)', backdropFilter: 'blur(10px)',
        color: '#fff', padding: '12px 20px', textAlign: 'center',
        fontWeight: '800', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
      }}>
        <div className="pulse-circle" />
        <span>현재 {watchers}명이 이 기수를 같이 보고 있어요</span>
      </div>

      <div className="kl-container" style={{ paddingTop: '100px' }}>
        {/* Navigation & Back Button */}
        <div style={{ marginBottom: '40px' }}>
          <Link href="/status" style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            color: '#666', textDecoration: 'none', 
            fontWeight: '700', fontSize: '0.85rem',
            padding: '10px 20px', borderRadius: '12px', background: '#fff',
            border: '1.5px solid #eee', transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF6F61'; e.currentTarget.style.color = '#FF6F61'; e.currentTarget.style.transform = 'translateX(-4px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,111,97,0.15)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.color = '#666'; e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; }}>
            <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> 기수 목록으로 돌아가기
          </Link>
        </div>

        {/* Hero Section: Venue & Summary */}
        <section style={{ marginBottom: '60px' }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px',
            alignItems: 'center'
          }}>
            <div style={{ position: 'relative', borderRadius: '32px', overflow: 'hidden', height: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', background: '#f5f5f5' }}>
              <Image 
                src="/images/venue.png" 
                alt="Venue Interior" 
                fill 
                style={{ objectFit: 'cover' }}
              />
              <div style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, padding: '30px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', color: '#fff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <MapPin size={18} /> <span style={{ fontWeight: '600' }}>부산 서면역 인근 프리미엄 공간</span>
                </div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.02em' }}>120기 부산 로테이션 소개팅</h2>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFF5F4', color: '#FF6F61', padding: '6px 14px', borderRadius: '100px', fontWeight: '800', fontSize: '0.85rem', marginBottom: '16px' }}>
                <Timer size={14} /> 실시간 모집 진행률
              </div>
              <h1 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '24px', letterSpacing: '-0.03em' }}>
                곧 마감됩니다!<br/>현재 <span style={{ color: '#FF6F61' }}>최종 매칭</span> 조율 중
              </h1>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Male Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                    <span>남성 참가자 (7/8)</span>
                    <span style={{ color: '#FF6F61' }}>{Math.round(progressMale * 100)}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#EDEDED', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressMale * 100}%`, height: '100%', background: 'linear-gradient(90deg, #FF9A8B, #FF6F61)', borderRadius: '5px' }} />
                  </div>
                </div>
                {/* Female Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                    <span>여성 참가자 (8/8)</span>
                    <span style={{ color: '#FF6F61' }}>{Math.round(progressFemale * 100)}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#EDEDED', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressFemale * 100}%`, height: '100%', background: 'linear-gradient(90deg, #FF9A8B, #FF6F61)', borderRadius: '5px' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={16} /> 총 16명 정원</div>
                <div style={{ width: '1px', height: '12px', background: '#ddd' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={16} /> 신원 검증 완료</div>
              </div>
            </div>
          </div>
        </section>

        {/* Participant Lineup Grid */}
        <section style={{ marginBottom: '80px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '12px' }}>
              실시간 라인업 확인
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>
              나이, 직업, 가치관을 미리 확인해 보세요.
            </p>
          </div>

          {/* Gender Tabs */}
          <div style={{ 
            position: 'sticky', top: '133px', zIndex: 90,
            display: 'flex', justifyContent: 'center', gap: '12px', 
            marginBottom: '40px', padding: '10px',
            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
            borderRadius: '100px', width: 'fit-content', margin: '0 auto 40px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <button 
              onClick={() => setActiveTab('male')}
              style={{
                padding: '12px 24px', borderRadius: '100px', border: 'none',
                fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: activeTab === 'male' ? '#007AFF' : 'transparent',
                color: activeTab === 'male' ? '#fff' : '#666',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: activeTab === 'male' ? '0 8px 16px rgba(0,122,255,0.25)' : 'none'
              }}
            >
              키링남 라인업 <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{maleCount}명</span>
            </button>
            <button 
              onClick={() => setActiveTab('female')}
              style={{
                padding: '12px 24px', borderRadius: '100px', border: 'none',
                fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: activeTab === 'female' ? '#FF6F61' : 'transparent',
                color: activeTab === 'female' ? '#fff' : '#666',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: activeTab === 'female' ? '0 8px 16px rgba(255,111,97,0.25)' : 'none'
              }}
            >
              키링녀 라인업 <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{femaleCount}명</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                gap: '20px'
              }}
            >
              {filteredLineup.map((p) => (
                <motion.div 
                  layout
                  key={p.id}
                  style={{ 
                    background: p.status === 'recruiting' ? 'rgba(0,0,0,0.02)' : '#fff',
                    border: `1.5px solid ${p.status === 'recruiting' ? '#f0f0f0' : activeTab === 'male' ? 'rgba(0,122,255,0.1)' : 'rgba(255,111,97,0.1)'}`,
                    borderRadius: '24px',
                    padding: '24px',
                    position: 'relative',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                  onMouseEnter={e => {
                    if (p.status !== 'recruiting') {
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = activeTab === 'male' ? '0 15px 30px rgba(0,122,255,0.1)' : '0 15px 30px rgba(255,111,97,0.1)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', minHeight: '32px' }}>
                    {p.status === 'confirmed' && <Sparkles size={16} color="#FFD700" fill="#FFD700" />}
                  </div>

                {p.status === 'confirmed' ? (
                  <>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '4px' }}>
                        {p.year}년생 | {p.occupation}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#FF6F61' }}>
                        MBTI: {p.mbti}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {p.keywords.map(k => (
                        <span key={k} style={{ 
                          fontSize: '0.75rem', fontWeight: '600', color: '#666', 
                          background: '#f5f5f5', padding: '4px 8px', borderRadius: '6px'
                        }}>#{k}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ 
                    height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: '8px'
                  }}>
                    <Heart size={24} color="#ddd" strokeWidth={1} />
                    <span style={{ fontWeight: '700', color: '#bbb' }}>참여 대기 중</span>
                  </div>
                )}
                 </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Assurance Banners */}
        <section style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px',
          marginBottom: '60px'
        }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #FFF5F4 0%, #FFF0EF 100%)', 
            border: '1px solid rgba(255,111,97,0.15)',
            padding: '32px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px'
          }}>
            <div style={{ background: '#FF6F61', width: '56px', height: '56px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <RefreshCcw size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', marginBottom: '4px' }}>매칭 실패 시 100% 환불</h4>
              <p style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>단 한 명과도 매칭되지 않을 경우,<br/>참가비 전액을 포인트로 환불해 드립니다.</p>
            </div>
          </div>

          <div style={{ 
            background: 'linear-gradient(135deg, #F0F7FF 0%, #EBF3FF 100%)', 
            border: '1px solid rgba(0,122,255,0.1)',
            padding: '32px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px'
          }}>
            <div style={{ background: '#007AFF', width: '56px', height: '56px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', marginBottom: '4px' }}>지인/중복 만남 방지</h4>
              <p style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>과거 매칭되었던 분이나 지인을 만날까 봐<br/>걱정 마세요. 꼼꼼히 사전 필터링합니다.</p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={{ textAlign: 'center' }}>
          <Link href="/events" className="kl-btn-primary" style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            padding: '24px 60px', fontSize: '1.2rem', fontWeight: '900', borderRadius: '100px',
            boxShadow: '0 20px 40px rgba(255,111,97,0.3)', transition: 'transform 0.3s ease'
          }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            지금 참여 신청하기 <ArrowRight size={22} />
          </Link>
          <p style={{ marginTop: '20px', color: '#888', fontWeight: '500', fontSize: '0.9rem' }}>
            * 실시간 상황에 따라 인원이 빠르게 마감될 수 있습니다.
          </p>
        </section>
      </div>

      <style jsx>{`
        .pulse-circle {
          width: 8px;
          height: 8px;
          background-color: #fff;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }

        @media (max-width: 480px) {
          .kl-container { padding: 20px 15px; }
          h1 { fontSize: 1.8rem !important; }
        }
      `}</style>
    </div>
  );
}
