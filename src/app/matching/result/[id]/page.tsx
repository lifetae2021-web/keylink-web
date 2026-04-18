'use client';
import { use } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeft, Trophy, Sparkles, Calendar, Users, BarChart3, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { mockMatchingResults } from '@/lib/mockData';
import { notFound } from 'next/navigation';

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const result = mockMatchingResults.find(r => r.id === id);

  if (!result) return notFound();

  // Donut Chart logic
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.matchingRate / 100) * circumference;

  return (
    <div style={{ paddingTop: '85px', minHeight: '100vh', background: '#fff' }}>
      {/* Celebration Header */}
      <section style={{
        padding: '80px 20px 60px',
        background: 'linear-gradient(180deg, rgba(255,111,97,0.08) 0%, transparent 100%)',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Heart Particles Animation */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                opacity: 0, 
                scale: 0, 
                x: '50vw', 
                y: '100vh' 
              }}
              animate={{ 
                opacity: [0, 1, 0], 
                scale: [0.5, 1.5, 0.5],
                x: `${Math.random() * 100}vw`,
                y: `${Math.random() * 60}vh`
              }}
              transition={{ 
                duration: 3 + Math.random() * 2, 
                repeat: Infinity,
                delay: Math.random() * 5
              }}
              style={{ position: 'absolute', color: '#FFDBE9' }}
            >
              <Heart size={20 + Math.random() * 40} fill="currentColor" />
            </motion.div>
          ))}
        </div>

        <div className="kl-container">
          <Link href="/matching/result" style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            color: '#666', textDecoration: 'none', fontWeight: '700',
            fontSize: '0.9rem', marginBottom: '32px', padding: '10px 20px',
            background: '#fff', borderRadius: '100px', border: '1px solid #eee'
          }}>
            <ArrowLeft size={18} /> 기수 목록으로
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div style={{ display: 'inline-block', padding: '10px 24px', background: 'rgba(255,111,97,0.1)', color: '#FF6F61', borderRadius: '100px', fontWeight: '800', fontSize: '0.9rem', marginBottom: '20px' }}>
              CONGRATULATIONS! 🎉
            </div>
            <h1 className="kl-heading-lg" style={{ marginBottom: '16px' }}>
              축하합니다! <span style={{ color: '#FF6F61' }}>{result.episode}기</span>에서<br/>
              총 {result.coupleCount}쌍의 인연이 시작되었습니다.
            </h1>
            <p style={{ color: '#666', fontSize: '1.1rem' }}>
              설레는 첫 만남의 순간, 그 뜨거운 매칭 현황을 공개합니다.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Stats Section */}
      <section style={{ padding: '60px 20px 100px' }}>
        <div className="kl-container" style={{ maxWidth: '900px' }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '40px', alignItems: 'center',
            background: '#fff', padding: '60px 40px', borderRadius: '40px',
            boxShadow: '0 20px 80px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0'
          }}>
            {/* Donut Chart */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Circle */}
                <circle
                  cx="100" cy="100" r={radius}
                  fill="transparent" stroke="#f0f0f0" strokeWidth="16"
                />
                {/* Progress Circle */}
                <motion.circle
                  cx="100" cy="100" r={radius}
                  fill="transparent" stroke="#FF6F61" strokeWidth="16"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: '#999', fontWeight: '700', marginBottom: '4px' }}>매칭률</p>
                <p style={{ fontSize: '2.5rem', fontWeight: '900', color: '#333' }}>{result.matchingRate}<span style={{ fontSize: '1rem' }}>%</span></p>
              </div>
            </div>

            {/* Stats Info */}
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <div style={{ flex: 1, padding: '24px', background: 'rgba(255,111,97,0.05)', borderRadius: '20px', textAlign: 'center' }}>
                  <Users size={24} color="#FF6F61" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>참여 인원</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '800' }}>{result.totalParticipants}명</p>
                </div>
                <div style={{ flex: 1, padding: '24px', background: 'rgba(255,111,97,0.05)', borderRadius: '20px', textAlign: 'center' }}>
                  <Trophy size={24} color="#FF6F61" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>탄생 커플</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '800' }}>{result.coupleCount}쌍</p>
                </div>
              </div>

              <div style={{ padding: '24px', background: '#fcfcfc', borderRadius: '20px', border: '1px solid #f0f0f0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#FF6F61" /> 당일 현장 스케치
                </h4>
                <p style={{ color: '#666', fontSize: '0.95rem', lineHeight: 1.7 }}>
                  {result.atmosphere}
                </p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div style={{ 
            marginTop: '40px', padding: '24px', background: 'rgba(110,174,124,0.08)', 
            borderRadius: '20px', border: '1px solid rgba(110,174,124,0.2)',
            display: 'flex', gap: '12px', alignItems: 'center'
          }}>
            <MessageCircle size={24} color="#6EAE7C" />
            <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.5 }}>
              공지: 매칭된 분들에게는 행사 종료 직후 카카오톡을 통해 개별적으로 연락처가 전달되었습니다. 첫 인사를 건네며 두근거리는 만남을 이어가 보세요!
            </p>
          </div>

          {/* Conversion Footer */}
          <div style={{ marginTop: '80px', textAlign: 'center' }}>
            <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '24px' }}>
              아쉽게 매칭이 안 되셨나요? 다음 기수에서 주인공이 되어보세요!
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <Link href="/events" style={{ 
                padding: '18px 40px', borderRadius: '100px', background: '#FF6F61',
                color: '#fff', textDecoration: 'none', fontWeight: '800',
                fontSize: '1.1rem', boxShadow: '0 10px 30px rgba(255,111,97,0.3)',
                transition: 'all 0.3s'
              }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 15px 40px rgba(255,111,97,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(255,111,97,0.3)'; }}>
                다음 기수 참여 신청하기
              </Link>
            </div>
            <Link href="/matching/result" style={{ 
              display: 'inline-block', marginTop: '32px', color: '#999', 
              textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' 
            }}>
              전체 결과 목록으로 돌아가기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
