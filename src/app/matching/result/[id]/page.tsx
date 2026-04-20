'use client';

import { use } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeft, ArrowRight, Trophy, Sparkles, Calendar, Users, BarChart3, MessageCircle, MapPin, ShieldCheck, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { mockMatchingResults } from '@/lib/mockData';
import { notFound } from 'next/navigation';
import CherryBlossoms from '@/components/CherryBlossoms';

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const result = mockMatchingResults.find(r => r.id === id);

  if (!result) return notFound();

  // Donut Chart logic
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.matchingRate / 100) * circumference;

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <CherryBlossoms />

      {/* Hero: Celebration Header (v3.2.2 Redesign) */}
      <section style={{
        padding: '120px 20px 80px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="kl-container">
          <div style={{ marginBottom: '40px' }}>
            <Link href="/matching/result" style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              color: '#666', textDecoration: 'none', fontWeight: '700',
              fontSize: '0.9rem', padding: '12px 24px',
              background: '#fff', borderRadius: '100px', border: '1px solid #eee',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }} onMouseEnter={e => e.currentTarget.style.transform = 'translateX(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
              <ArrowLeft size={18} /> 기수 목록으로 돌아가기
            </Link>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,111,97,0.1)', color: '#FF6F61', padding: '8px 20px', borderRadius: '100px', fontWeight: '800', fontSize: '0.9rem', marginBottom: '24px', letterSpacing: '0.1em' }}>
              <Sparkles size={16} /> EPISODE MATCHING REPORT
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '-0.03em', lineHeight: 1.2, color: '#111' }}>
              <span className="kl-gradient-text">{result.episode}기</span> 부산 로테이션 소개팅<br/>
              성공적으로 마무리되었습니다!
            </h1>
            <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: '500' }}>
              설레는 첫 만남의 순간, 그 뜨거운 매칭 현황을 공개합니다.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Stats Section */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 20px' }}>
        <div className="kl-container" style={{ maxWidth: '1000px' }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
            gap: '40px', alignItems: 'center',
            background: '#fff', padding: '60px 40px', borderRadius: '48px',
            boxShadow: '0 30px 90px rgba(0,0,0,0.06)', border: '1.5px solid #eee'
          }}>
            {/* Donut Chart with Gradient */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <svg width="240" height="240" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF9A8B" />
                    <stop offset="100%" stopColor="#FF6F61" />
                  </linearGradient>
                </defs>
                {/* Background Circle */}
                <circle
                  cx="100" cy="100" r={radius}
                  fill="transparent" stroke="#f5f5f5" strokeWidth="18"
                />
                {/* Progress Circle */}
                <motion.circle
                  cx="100" cy="100" r={radius}
                  fill="transparent" stroke="url(#progressGradient)" strokeWidth="18"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 2.5, ease: "easeOut", delay: 0.5 }}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <p style={{ fontSize: '1rem', color: '#888', fontWeight: '800', marginBottom: '4px' }}>최종 매칭률</p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
                  <span style={{ fontSize: '3.5rem', fontWeight: '900', color: '#111', letterSpacing: '-0.02em' }}>{result.matchingRate}</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#FF6F61' }}>%</span>
                </div>
              </div>
            </div>

            {/* Stats Info Cards */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <div style={{ padding: '24px', background: 'linear-gradient(135deg, #fcfcfc, #f5f5f5)', borderRadius: '24px', border: '1px solid #eee', textAlign: 'center' }}>
                  <Users size={24} color="#666" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '6px', fontWeight: '700' }}>참여 인원</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111' }}>{result.totalParticipants}<span style={{ fontSize: '1rem', color: '#888', fontWeight: '600' }}>명</span></p>
                </div>
                <div style={{ padding: '24px', background: 'rgba(255,111,97,0.06)', borderRadius: '24px', border: '1px solid rgba(255,111,97,0.1)', textAlign: 'center' }}>
                  <Trophy size={24} color="#FF6F61" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem', color: '#FF6F61', marginBottom: '6px', fontWeight: '700' }}>탄생 커플</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FF6F61' }}>{result.coupleCount}<span style={{ fontSize: '1rem', color: '#FF9A8B', fontWeight: '600' }}>쌍</span></p>
                </div>
              </div>

              <div style={{ padding: '32px', background: '#fcfcfc', borderRadius: '28px', border: '1.5px dashed #eee', position: 'relative' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} color="#FF6F61" /> 당일 현장 스케치
                </h4>
                <p style={{ color: '#666', fontSize: '1.05rem', lineHeight: 1.8, fontWeight: '500' }}>
                  "{result.atmosphere}"
                </p>
              </div>
            </div>
          </div>

          {/* Verification Banner */}
          <div style={{ 
            marginTop: '40px', padding: '32px 40px', background: 'linear-gradient(135deg, #F0F7FF 0%, #EBF3FF 100%)', 
            borderRadius: '32px', border: '1px solid rgba(0,122,255,0.1)',
            display: 'flex', gap: '24px', alignItems: 'center',
            boxShadow: '0 10px 40px rgba(0,122,255,0.05)'
          }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '18px', background: '#007AFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 10px 20px rgba(0,122,255,0.2)'
            }}>
              <ShieldCheck size={28} />
            </div>
            <div>
              <p style={{ fontSize: '1.05rem', color: '#111', fontWeight: '800', marginBottom: '4px' }}>신원 검증 및 개인정보 매칭 시스템</p>
              <p style={{ fontSize: '0.95rem', color: '#666', lineHeight: 1.6, fontWeight: '500' }}>
                매칭된 분들에게는 카카오톡을 통해 안전하게 연락처가 전달되었습니다. <br className="desktop-br"/>
                무단 정보 공유 시 정책에 따라 엄격히 제한됩니다.
              </p>
            </div>
          </div>

          {/* CTA Footer */}
          <div style={{ marginTop: '100px', textAlign: 'center' }}>
            <h4 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '32px', letterSpacing: '-0.02em' }}>
              다음 기수의 주인공이 되어보시겠어요?
            </h4>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/events" className="kl-btn-primary" style={{ padding: '22px 60px', borderRadius: '100px', fontWeight: '900', fontSize: '1.15rem', boxShadow: '0 20px 40px rgba(255,111,97,0.3)', textDecoration: 'none' }}>
                지금 참여 신청하기 <ArrowRight size={22} />
              </Link>
            </div>
            <Link href="/matching/result" style={{ 
              display: 'inline-block', marginTop: '40px', color: '#aaa', 
              textDecoration: 'none', fontWeight: '700', fontSize: '0.95rem',
              transition: 'color 0.2s ease'
            }} onMouseEnter={e => e.currentTarget.style.color = '#FF6F61'} onMouseLeave={e => e.currentTarget.style.color = '#aaa'}>
              전체 매칭 결과 목록 보기
            </Link>
          </div>
        </div>
      </section>
      
      <style jsx>{`
        @media (max-width: 640px) {
          .desktop-br { display: none; }
          h1 { font-size: 2.2rem !important; }
        }
      `}</style>
    </div>
  );
}
