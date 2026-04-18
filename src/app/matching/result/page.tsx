'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight, Trophy, Sparkles, Calendar, Users, BarChart3 } from 'lucide-react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { mockMatchingResults } from '@/lib/mockData';

export default function ResultListPage() {
  const [totalCouples, setTotalCouples] = useState(0);
  
  // Cumulative counter animation
  useEffect(() => {
    const controls = animate(0, 1248, {
      duration: 2.5,
      delay: 0.5,
      ease: "easeOut",
      onUpdate(value) {
        setTotalCouples(Math.floor(value));
      }
    });
    return () => controls.stop();
  }, []);

  return (
    <div style={{ paddingTop: '85px', minHeight: '100vh', background: '#fcfcfc' }}>
      {/* Hero: Cumulative Counting Board */}
      <section style={{
        padding: '100px 20px 120px',
        background: 'linear-gradient(180deg, rgba(255,111,97,0.05) 0%, transparent 100%)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background Icons */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ position: 'absolute', top: '10%', left: '5%', color: '#FF6F61', opacity: 0.1 }}
        >
          <Heart size={120} fill="currentColor" />
        </motion.div>
        <motion.div 
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: 7, repeat: Infinity }}
          style={{ position: 'absolute', bottom: '15%', right: '8%', color: '#FF6F61', opacity: 0.1 }}
        >
          <Sparkles size={100} />
        </motion.div>

        <div className="kl-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p style={{ 
              fontSize: '1rem', fontWeight: '800', color: '#FF6F61', 
              letterSpacing: '0.2em', marginBottom: '20px', textTransform: 'uppercase' 
            }}>KEYLINK IMPACT</p>
            <h1 className="kl-heading-xl" style={{ marginBottom: '32px', fontSize: '3rem' }}>
              축하합니다!<br/>키링크를 통해 탄생한
            </h1>
            
            {/* Counting Board */}
            <div style={{ 
              display: 'inline-flex', alignItems: 'baseline', gap: '8px',
              padding: '30px 60px', background: '#fff', borderRadius: '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.06)', border: '1px solid rgba(255,111,97,0.1)',
              marginBottom: '32px'
            }}>
              <span style={{ 
                fontSize: '5rem', fontWeight: '900', color: '#FF6F61', 
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' 
              }}>
                {totalCouples.toLocaleString()}
              </span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: '#333' }}>커플</span>
            </div>

            <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: '600px', margin: '0 auto 48px', lineHeight: 1.6 }}>
              압도적인 매칭률로 증명하는 대화의 힘.<br/>
              오늘도 누군가는 키링크에서 새로운 시작을 꿈꿉니다.
            </p>

            <Link href="/matching/result/my" style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '12px',
              padding: '18px 36px', borderRadius: '100px', background: '#333',
              color: '#fff', textDecoration: 'none', fontWeight: '700',
              fontSize: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              transition: 'all 0.3s'
            }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.15)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)'; }}>
              로그인 후 내 결과 확인하기 <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Result Grid Section */}
      <section style={{ padding: '80px 20px', background: '#fff' }}>
        <div className="kl-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '12px' }}>역대 기수 매칭 현황</h2>
              <p style={{ color: '#888' }}>키링크는 매칭 데이터를 투명하게 공개하여 신뢰를 드립니다.</p>
            </div>
            <div style={{ padding: '10px 20px', background: '#f8f8f8', borderRadius: '12px', fontSize: '0.9rem', color: '#666', fontWeight: '600' }}>
              전체 목록 ({mockMatchingResults.length})
            </div>
          </div>

          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '24px' 
          }}>
            {mockMatchingResults.map((result, idx) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <Link href={`/matching/result/${result.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="status-card" style={{ 
                    padding: '32px', borderRadius: '24px', background: '#fff',
                    border: '1px solid #EDEDED', transition: 'all 0.3s ease',
                    height: '100%', display: 'flex', flexDirection: 'column'
                  }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF6F61'; e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(255,111,97,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDEDED'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    
                    {/* Badge Area */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                      {result.labels.map(label => (
                        <span key={label} style={{ 
                          padding: '6px 14px', borderRadius: '100px', background: 'rgba(255,111,97,0.1)',
                          color: '#FF6F61', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '-0.02em'
                        }}>
                          {label}
                        </span>
                      ))}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '4px', fontWeight: '600' }}>{result.episode}기</p>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '800', lineHeight: 1.3 }}>부산 로테이션 소개팅</h3>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666' }}>
                        <Calendar size={18} />
                        <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{result.date}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FF6F61' }}>
                        <Trophy size={18} />
                        <span style={{ fontSize: '1.1rem', fontWeight: '800' }}>{result.coupleCount}쌍 탄생!</span>
                      </div>
                    </div>

                    <div style={{ 
                      padding: '20px', background: '#fafafa', borderRadius: '16px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
                        <BarChart3 size={18} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>매칭률</span>
                      </div>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#333' }}>{result.matchingRate}%</span>
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.9rem', color: '#FF6F61', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        현황 상세 보기 <ArrowRight size={16} />
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
        .status-card:hover h3 { color: #FF6F61; }
      `}</style>
    </div>
  );
}
