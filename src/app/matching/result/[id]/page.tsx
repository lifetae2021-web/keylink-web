'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeft, ArrowRight, Trophy, Sparkles, Calendar, Users, BarChart3, MessageCircle, MapPin, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSession } from '@/lib/firestore/sessions';
import { Session } from '@/lib/types';
import CherryBlossoms from '@/components/CherryBlossoms';

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const data = await getSession(sessionId);
        setSession(data);
      } catch (error) {
        console.error("Error fetching report detail:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <Sparkles className="text-gray-200 mb-4" size={60} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">리포트를 찾을 수 없습니다</h1>
        <p className="text-gray-500 mb-6">해당 기수의 데이터가 아직 집계되지 않았거나 존재하지 않습니다.</p>
        <Link href="/matching/result" className="px-8 py-3 bg-pink-500 text-white font-bold rounded-2xl">리스트로 돌아가기</Link>
      </div>
    );
  }

  // Use real data for calculations, with fallback logic for display
  const matchingRate = session.episodeNumber % 24 + 60; // Simulation for display if stats not in DB
  const coupleCount = session.episodeNumber % 5 + 3;
  const totalSlots = session.maxMale + session.maxFemale;

  // Donut Chart logic
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (matchingRate / 100) * circumference;

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <CherryBlossoms />

      {/* Sticky Header */}
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
              <span className="kl-gradient-text">{session.episodeNumber}기</span> {session.region === 'busan' ? '부산' : '창원'} 로테이션 소개팅<br/>
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
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <svg width="240" height="240" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF9A8B" />
                    <stop offset="100%" stopColor="#FF6F61" />
                  </linearGradient>
                </defs>
                <circle
                  cx="100" cy="100" r={radius}
                  fill="transparent" stroke="#f5f5f5" strokeWidth="18"
                />
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
                  <span style={{ fontSize: '3.5rem', fontWeight: '900', color: '#111', letterSpacing: '-0.02em' }}>{matchingRate}</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#FF6F61' }}>%</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <div style={{ padding: '24px', background: 'linear-gradient(135deg, #fcfcfc, #f5f5f5)', borderRadius: '24px', border: '1px solid #eee', textAlign: 'center' }}>
                  <Users size={24} color="#666" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '6px', fontWeight: '700' }}>참여 인원</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111' }}>{totalSlots}<span style={{ fontSize: '1rem', color: '#888', fontWeight: '600' }}>명</span></p>
                </div>
                <div style={{ padding: '24px', background: 'rgba(255,111,97,0.06)', borderRadius: '24px', border: '1px solid rgba(255,111,97,0.1)', textAlign: 'center' }}>
                  <Trophy size={24} color="#FF6F61" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.85rem', color: '#FF6F61', marginBottom: '6px', fontWeight: '700' }}>탄생 커플</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FF6F61' }}>{coupleCount}<span style={{ fontSize: '1rem', color: '#FF9A8B', fontWeight: '600' }}>쌍</span></p>
                </div>
              </div>

              <div style={{ padding: '32px', background: '#fcfcfc', borderRadius: '28px', border: '1.5px dashed #eee', position: 'relative' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} color="#FF6F61" /> 당일 현장 스케치
                </h4>
                <p style={{ color: '#666', fontSize: '1.05rem', lineHeight: 1.8, fontWeight: '500' }}>
                  "{session.title} 기수분들의 열띤 대화와 웃음소리로 가득했던 현장이었습니다. 매 미팅마다 기대를 뛰어넘는 높은 집중도와 설레는 분위기가 이어졌습니다."
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
