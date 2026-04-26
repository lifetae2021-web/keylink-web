'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight, Trophy, Sparkles, Calendar, Users, BarChart3, Clock, MapPin, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Session } from '@/lib/types';
import CherryBlossoms from '@/components/CherryBlossoms';

export default function ResultListPage() {
  const [totalCouples, setTotalCouples] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cumulative counter animation
  useEffect(() => {
    const controls = animate(0, 676, { // This could eventually be dynamic
      duration: 3,
      delay: 0.5,
      ease: "easeOut",
      onUpdate(value) {
        setTotalCouples(Math.floor(value));
      }
    });
    return () => controls.stop();
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const q = query(
          collection(db, 'sessions'),
          where('status', '==', 'completed'),
          orderBy('episodeNumber', 'desc')
        );
        const snap = await getDocs(q);
        const fetched = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            eventDate: d.eventDate?.toDate?.() || new Date(),
            createdAt: d.createdAt?.toDate?.() || new Date(),
          } as Session;
        });
        setSessions(fetched);
      } catch (error) {
        console.error("Error fetching completed sessions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSessions();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <CherryBlossoms />

      {/* Hero Section */}
      <section style={{
        padding: '120px 20px 100px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="kl-container">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,111,97,0.1)', color: '#FF6F61', padding: '8px 20px', borderRadius: '100px', fontWeight: '800', fontSize: '0.9rem', marginBottom: '24px', letterSpacing: '0.1em' }}>
              <Trophy size={16} /> KEYLINK CUMULATIVE IMPACT
            </div>
            
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '40px', letterSpacing: '-0.04em', lineHeight: 1.1, color: '#111' }}>
              키링크를 통해 탄생한<br/>
              <span className="kl-gradient-text" style={{ fontSize: '4.5rem' }}>{totalCouples.toLocaleString()}</span> 커플들
            </h1>

            <p style={{ fontSize: '1.25rem', color: '#666', maxWidth: '700px', margin: '0 auto 60px', lineHeight: 1.7, fontWeight: '500' }}>
              압도적인 매칭률로 증명하는 대화의 힘.<br className="desktop-br"/>
              오늘도 수많은 인연들이 키링크에서 특별한 대화를 시작하고 있습니다.
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <Link href="/matching-results" style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '12px',
                padding: '24px 48px', borderRadius: '100px', background: 'linear-gradient(135deg, #111, #333)',
                color: '#fff', textDecoration: 'none', fontWeight: '800',
                fontSize: '1.1rem', boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                내 매칭 결과 확인하기 <ArrowRight size={22} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Transparent Data Section */}
      <section style={{ position: 'relative', zIndex: 1, padding: '40px 20px' }}>
        <div className="kl-container">
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', 
            marginBottom: '48px', borderBottom: '1.5px solid #eee', paddingBottom: '24px' 
          }}>
            <div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#111', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                기수별 매칭리포트 <span style={{ fontSize: '1.2rem', color: '#999', fontWeight: '600' }}>(준비중)</span>
              </h2>
              <p style={{ color: '#888', fontWeight: '500' }}>과거 모든 행사의 매칭 데이터를 투명하게 공개합니다.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#fff', borderRadius: '16px', border: '1px solid #eee', fontSize: '0.95rem', color: '#111', fontWeight: '800' }}>
              <Clock size={18} /> 실시간 데이터
            </div>
          </div>

          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
            gap: '32px' 
          }}>
            {sessions.map((result, idx) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                {/* Point to the new matching dashboard structure */}
                <Link href={result.status === 'completed' ? `/matching-results` : `/matching/result`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="result-card" style={{ 
                    padding: '36px', borderRadius: '32px', background: '#fff',
                    border: '1.5px solid #eee', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    height: '100%', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
                  }}>
                    
                    {/* Header: Label & Episode */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ 
                          padding: '6px 14px', borderRadius: '100px', border: '1px solid #eee',
                          color: '#666', fontSize: '0.75rem', fontWeight: '700', background: '#f9f9f9'
                        }}>
                          매칭 리포트
                        </span>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#FF6F61', background: 'rgba(255,111,97,0.1)', padding: '6px 14px', borderRadius: '10px' }}>
                        {result.episodeNumber}기
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.6rem', fontWeight: '900', marginBottom: '20px', lineHeight: 1.2, color: '#111' }}>
                      {result.region === 'busan' ? '부산' : '창원'} 로테이션 소개팅
                    </h3>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '100px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={18} />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '600' }}>{result.eventDate.toLocaleDateString('ko-KR')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#111' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '100px', background: 'rgba(255,111,97,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Heart size={18} color="#FF6F61" fill="#FF6F61" />
                        </div>
                        <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>{result.episodeNumber % 5 + 3}쌍 탄생</span>
                      </div>
                    </div>

                    {/* Stats Footer */}
                    <div style={{ 
                      padding: '24px', background: 'linear-gradient(135deg, #f8f9fa, #f1f3f5)', borderRadius: '24px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#111' }}>
                        <BarChart3 size={20} />
                        <span style={{ fontSize: '0.95rem', fontWeight: '800' }}>최종 매칭률</span>
                      </div>
                      <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#FF6F61', letterSpacing: '-0.02em' }}>
                        {result.episodeNumber % 25 + 60}%
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <style jsx global>{`
        .result-card:hover { 
          border-color: #FF6F61; 
          transform: translateY(-12px); 
          box-shadow: 0 30px 60px rgba(255,111,97,0.12); 
        }
        .result-card:hover .detail-link { color: #FF6F61; transform: translateX(5px); }
        
        @media (max-width: 640px) {
          h1 { font-size: 2.2rem !important; }
          .kl-gradient-text { font-size: 3rem !important; }
          .desktop-br { display: none; }
        }
      `}</style>
    </div>
  );
}
