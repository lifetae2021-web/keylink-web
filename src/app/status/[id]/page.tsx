'use client';

import { useState, useEffect, useMemo } from 'react';
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

  const maleLineup = mockLineup.filter(p => p.gender === 'male');
  const femaleLineup = mockLineup.filter(p => p.gender === 'female');

  // Data Dissociation & Anonymization Logic
  const anonymizedRows = useMemo(() => {
    const confirmed = (activeTab === 'male' ? maleLineup : femaleLineup).filter(p => p.status === 'confirmed');
    
    // 1. Ages: Sort descending (99 -> 90) to show youngest first
    const ages = confirmed
      .map(p => `${p.year}년생`)
      .sort((a, b) => parseInt(b) - parseInt(a));
      
    // 2. Jobs: Shuffle
    const jobs = [...confirmed.map(p => p.occupation)].sort(() => Math.random() - 0.5);
      
    // 3. Heights: Shuffle
    const heights = [...confirmed.map(p => `${p.height}cm`)].sort(() => Math.random() - 0.5);
    
    // Combine into rows
    const rows = [];
    const maxSlots = 8; // Fixed display count for visual consistency
    for (let i = 0; i < maxSlots; i++) {
      if (i < confirmed.length) {
        rows.push({
          age: ages[i],
          job: jobs[i],
          height: heights[i],
          status: 'confirmed'
        });
      } else {
        rows.push({
          status: 'recruiting'
        });
      }
    }
    return rows;
  }, [activeTab, maleLineup, femaleLineup]);

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

        {/* Hero Section */}
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
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                    <span>남성 참가자 (7/8)</span>
                    <span style={{ color: '#FF6F61' }}>{Math.round(progressMale * 100)}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#EDEDED', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressMale * 100}%`, height: '100%', background: 'linear-gradient(90deg, #FF9A8B, #FF6F61)', borderRadius: '5px' }} />
                  </div>
                </div>
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

        {/* Anonymized Lineup Section */}
        <section style={{ marginBottom: '80px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '12px' }}>
              실시간 라인업
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: '500', maxWidth: '600px', margin: '0 auto' }}>
              참여자의 프라이버시 보호를 위해 나이, 직업, 키 정보를 <br className="desktop-br"/>각각 분리하여 랜덤하게 나열하였습니다.
            </p>
          </div>

          {/* Gender Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
            <button 
              onClick={() => setActiveTab('male')}
              style={{
                padding: '16px 36px', borderRadius: '100px', border: 'none',
                fontWeight: '900', fontSize: '1.05rem', cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                background: activeTab === 'male' ? 'linear-gradient(135deg, #007AFF, #0056B3)' : '#f5f5f5',
                color: activeTab === 'male' ? '#fff' : '#888',
                boxShadow: activeTab === 'male' ? '0 10px 20px rgba(0,122,255,0.3)' : 'none',
                transform: activeTab === 'male' ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              키링남 라인업
            </button>
            <button 
              onClick={() => setActiveTab('female')}
              style={{
                padding: '16px 36px', borderRadius: '100px', border: 'none',
                fontWeight: '900', fontSize: '1.05rem', cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                background: activeTab === 'female' ? 'linear-gradient(135deg, #FF6F61, #FF8A71)' : '#f5f5f5',
                color: activeTab === 'female' ? '#fff' : '#888',
                boxShadow: activeTab === 'female' ? '0 10px 20px rgba(255,111,97,0.3)' : 'none',
                transform: activeTab === 'female' ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              키링녀 라인업
            </button>
          </div>

          {/* Dissociated List View */}
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
              padding: '15px 30px', background: 'rgba(0,0,0,0.03)', borderRadius: '16px',
              fontWeight: '800', color: '#666', fontSize: '0.9rem', marginBottom: '12px',
              textAlign: 'center'
            }}>
              <span>나이 (정렬됨)</span>
              <span>직업 (랜덤)</span>
              <span>키 (랜덤)</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {anonymizedRows.map((row, idx) => (
                  <div key={idx} className="anon-row" style={{ 
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
                    background: '#fff', border: '1px solid #f0f0f0', borderRadius: '20px',
                    padding: '20px 30px', boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                    alignItems: 'center', textAlign: 'center'
                  }}>
                    {row.status === 'confirmed' ? (
                      <>
                        <div style={{ fontWeight: '700', color: '#111' }}>{row.age}</div>
                        <div style={{ fontWeight: '800', color: activeTab === 'male' ? '#007AFF' : '#FF6F61' }}>{row.job}</div>
                        <div style={{ color: '#666', fontWeight: '500' }}>{row.height}</div>
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 3', color: '#bbb', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Sparkles size={16} /> 멋진 인연을 기다려요
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Assurance Banner v3.5.1 */}
        <div style={{ 
          maxWidth: '800px', margin: '0 auto 80px auto',
          background: 'linear-gradient(135deg, #F0F7FF 0%, #EBF3FF 100%)', 
          border: '1px solid rgba(0,122,255,0.1)',
          padding: '40px', borderRadius: '32px', display: 'flex', alignItems: 'center', gap: '30px',
          boxShadow: '0 10px 30px rgba(0,122,255,0.05)'
        }}>
          <div style={{ 
            background: '#007AFF', width: '64px', height: '64px', borderRadius: '20px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 8px 16px rgba(0,122,255,0.2)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#111', marginBottom: '8px' }}>
              지인/중복 만남 시 <span style={{ color: '#007AFF' }}>100% 환불</span>
            </h4>
            <p style={{ fontSize: '1rem', color: '#666', fontWeight: '500', lineHeight: '1.5' }}>
              과거 매칭되었던 분이나 지인을 만날까 봐 걱정 마세요.<br className="desktop-br"/>
              키링크의 꼼꼼한 사전 필터링 시스템이 완벽하게 보호해 드립니다.
            </p>
          </div>
        </div>

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
        .pulse-circle { width: 8px; height: 8px; background-color: #fff; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); } }
        
        .anon-row:hover { transform: translateY(-2px); border-color: #ddd; box-shadow: 0 8px 24px rgba(0,0,0,0.04); }

        @media (max-width: 640px) {
          .desktop-br { display: none; }
          .anon-row { padding: 15px 10px !important; font-size: 0.85rem; }
          h1 { font-size: 1.8rem !important; }
        }
      `}</style>
    </div>
  );
}
