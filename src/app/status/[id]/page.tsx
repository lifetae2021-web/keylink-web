'use client';

import { use, useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, doc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Users, ShieldCheck, RefreshCcw, ArrowRight, Heart, Timer, MapPin, Sparkles, Loader2, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, getAllSessions } from '@/lib/firestore/sessions';
import { getApplicationsBySession } from '@/lib/firestore/applications';
import { Session, Application } from '@/lib/types';

export default function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [activeTab, setActiveTab] = useState<'male' | 'female'>('male');
  const [watchers, setWatchers] = useState(24);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [userMap, setUserMap] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        let sessionData = await getSession(sessionId);
        
        // v8.5.0: 레거시 경로 대응 - ID로 조회 실패 시 기수 번호(episodeNumber)로 재시도
        if (!sessionData && !isNaN(parseInt(sessionId))) {
           const all = await getAllSessions();
           sessionData = all.find(s => s.episodeNumber === parseInt(sessionId)) || null;
        }
        
        if (!sessionData) {
          setIsLoading(false);
          return;
        }

        const appData = await getApplicationsBySession(sessionData.id);
        const confirmedApps = appData.filter(a => a.status === 'confirmed');

        setSession(sessionData);
        setApplicants(appData);

        // v8.4.8+: 사용자 상세 정보(키, MBTI 등) 가져오기
        const userPromises = confirmedApps.map(a => getDoc(doc(db, 'users', a.userId)));
        const userSnaps = await Promise.all(userPromises);
        
        const map: Record<string, any> = {};
        userSnaps.forEach(snap => {
          if (snap.exists()) {
            map[snap.id] = snap.data();
          }
        });
        setUserMap(map);

      } catch (error) {
        console.error("Error fetching status detail:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();

    const interval = setInterval(() => {
      setWatchers(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(18, Math.min(42, prev + delta));
      });
      setShuffleSeed(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const maleApplicants = applicants.filter(p => p.gender === 'male' && p.status === 'confirmed');
  const femaleApplicants = applicants.filter(p => p.gender === 'female' && p.status === 'confirmed');

  // v8.4.8: 라인업 데이터 바인딩 (이름/연락처 완전 배제)
  const confirmedRows = useMemo(() => {
    const currentList = activeTab === 'male' ? maleApplicants : femaleApplicants;
    
    const baseData = currentList.map(p => {
      const u = userMap[p.userId] || {};
      const birth = u.birthDate || '';
      const year = birth.includes('-') ? birth.split('-')[0].slice(2, 4) : (birth.length >= 2 ? birth.slice(0, 2) : '??');
      
      return {
        birthYear: `${year}년생`,
        job: u.admin_job || u.job || '검토 중',
        height: u.height ? `${u.height}cm` : '160cm대',
      };
    }).sort((a, b) => b.birthYear.localeCompare(a.birthYear));

    if (baseData.length === 0) return [];

    const shuffle = <T,>(arr: T[], seed: number): T[] => {
      const result = [...arr];
      let s = seed;
      for (let i = result.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };

    const jobs = shuffle(baseData.map(r => r.job), shuffleSeed);
    const heights = shuffle(baseData.map(r => r.height), shuffleSeed + 999);

    return baseData.map((r, i) => ({
      birthYear: r.birthYear,
      job: jobs[i],
      height: heights[i],
    }));
  }, [activeTab, maleApplicants, femaleApplicants, userMap, shuffleSeed]);

  const progressMale = session ? (session.currentMale / session.maxMale) : 0;
  const progressFemale = session ? (session.currentFemale / session.maxFemale) : 0;

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">기수 정보를 찾을 수 없습니다</h1>
        <p className="text-gray-500 mb-6">이미 종료되었거나 잘못된 접근입니다.</p>
        <Link href="/status" className="px-8 py-3 bg-pink-500 text-white font-bold rounded-2xl shadow-lg">목록으로 돌아가기</Link>
      </div>
    );
  }

  const currentMale = session.currentMale || 0;
  const currentFemale = session.currentFemale || 0;

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)' }}>
      <div style={{ 
        position: 'sticky', top: '85px', zIndex: 100,
        background: 'rgba(255, 111, 97, 0.9)', backdropFilter: 'blur(10px)',
        color: '#fff', padding: '12px 20px', textAlign: 'center',
        fontWeight: '800', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
      }}>
        <div className="pulse-circle" />
        <span>현재 {watchers}명이 이 기수를 같이 보고 있어요</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '10px' }}>v8.8.4</span>
      </div>

      <div className="kl-container" style={{ paddingTop: '100px' }}>
        <div style={{ marginBottom: '40px' }}>
          <Link href="/status" style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            color: '#666', textDecoration: 'none', 
            fontWeight: '700', fontSize: '0.85rem',
            padding: '10px 20px', borderRadius: '12px', background: '#fff',
            border: '1.5px solid #eee', transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> 기수 목록으로 돌아가기
          </Link>
        </div>

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
                  <MapPin size={18} /> <span style={{ fontWeight: '600' }}>{session.region === 'busan' ? '부산' : '창원'} {session.location}</span>
                </div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.02em' }}>{session.episodeNumber}기 {session.title}</h2>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFF5F4', color: '#FF6F61', padding: '6px 14px', borderRadius: '100px', fontWeight: '800', fontSize: '0.85rem', marginBottom: '16px' }}>
                <Timer size={14} /> 실시간 모집 진행률
              </div>
              <h1 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '24px', letterSpacing: '-0.03em' }}>
                {progressMale >= 1 && progressFemale >= 1 ? '남녀 마감 완료!' : '곧 마감됩니다!'} <br/>현재 <span style={{ color: '#FF6F61' }}>참가 확정</span> 명단
              </h1>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                    <span>남성 참가자 ({currentMale}/{session.maxMale})</span>
                    <span style={{ color: '#FF6F61' }}>{Math.round(progressMale * 100)}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#EDEDED', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressMale * 100}%`, height: '100%', background: 'linear-gradient(90deg, #FF9A8B, #FF6F61)', borderRadius: '5px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem' }}>
                    <span>여성 참가자 ({currentFemale}/{session.maxFemale})</span>
                    <span style={{ color: '#FF6F61' }}>{Math.round(progressFemale * 100)}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#EDEDED', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressFemale * 100}%`, height: '100%', background: 'linear-gradient(90deg, #FF9A8B, #FF6F61)', borderRadius: '5px' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={16} /> 총 {session.maxMale + session.maxFemale}명 정원</div>
                <div style={{ width: '1px', height: '12px', background: '#ddd' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={16} /> 신원 검증 완료</div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '80px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '12px' }}>
              참가 확정 라인업
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: '500', maxWidth: '600px', margin: '0 auto' }}>
              개인정보 보호를 위해 성함과 연락처를 제외한 <br className="desktop-br"/>
              나이, 직업, 키 정보만 투명하게 공개합니다.
            </p>
          </div>

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

          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Header for Lineup List (v8.8.3 Optimized) */}
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'minmax(60px, 80px) 120px 1fr 120px', gap: '15px',
              padding: '15px 40px', background: 'rgba(0,0,0,0.02)', borderRadius: '16px',
              fontWeight: '800', color: '#888', fontSize: '0.85rem', marginBottom: '16px',
              textAlign: 'center'
            }}>
              <span>번호</span>
              <span>출생연도</span>
              <span>직업 <small style={{ fontSize: '0.65rem', color: '#bbb', fontWeight: '500' }}>(랜덤)</small></span>
              <span>키 <small style={{ fontSize: '0.65rem', color: '#bbb', fontWeight: '500' }}>(랜덤)</small></span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                {Array.from({ length: activeTab === 'male' ? (session.maxMale || 8) : (session.maxFemale || 8) }).map((_, idx) => {
                  const row = confirmedRows[idx];
                  const isFilled = !!row;

                  return (
                    <div key={idx} className={`status-row ${isFilled ? 'v850-card' : 'empty-slot'}`} style={{ 
                      display: 'grid', gridTemplateColumns: 'minmax(60px, 80px) 120px 1fr 120px', gap: '15px',
                      background: isFilled ? '#fff' : 'rgba(255,255,255,0.4)', 
                      border: isFilled ? '1.5px solid #f2f2f2' : '1.5px dashed #eee', 
                      borderRadius: '24px',
                      padding: '24px 40px', 
                      boxShadow: isFilled ? '0 8px 24px rgba(0,0,0,0.02)' : 'none',
                      alignItems: 'center', textAlign: 'center',
                      transition: 'all 0.3s ease',
                      opacity: isFilled ? 1 : 0.6
                    }}>
                      <div style={{ fontWeight: '900', color: isFilled ? '#CCC' : '#EEE', fontSize: '1.2rem' }}>{idx + 1}</div>
                      
                      {isFilled ? (
                        <>
                          <div style={{ fontWeight: '800', color: '#111', fontSize: '1rem' }}>{row.birthYear}</div>
                          <div style={{ fontWeight: '900', color: activeTab === 'male' ? '#3B82F6' : '#FF6F61', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <AnimatePresence mode="wait">
                              <motion.span 
                                key={row.job}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                              >
                                {row.job}
                              </motion.span>
                            </AnimatePresence>
                            <span style={{ fontSize: '0.65rem', color: '#bbb', fontWeight: '500' }}>(랜덤)</span>
                          </div>
                          <div style={{ color: '#666', fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <AnimatePresence mode="wait">
                              <motion.span 
                                key={row.height}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                              >
                                {row.height}
                              </motion.span>
                            </AnimatePresence>
                            <span style={{ fontSize: '0.65rem', color: '#bbb', fontWeight: '500' }}>(랜덤)</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ gridColumn: 'span 3', color: '#bbb', fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <Sparkles size={16} className="text-gray-200" /> 모집 중 / 새로운 인연을 기다리고 있어요!
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Assurance Banner v3.5.3 */}
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
            {progressMale >= 1 && progressFemale >= 1 ? '대기자로 신청하기' : '지금 참여 신청하기'} <ArrowRight size={22} />
          </Link>
          <p style={{ marginTop: '20px', color: '#888', fontWeight: '500', fontSize: '0.9rem' }}>
            * 실시간 상황에 따라 인원이 빠르게 마감될 수 있습니다.
          </p>
        </section>
      </div>

      <style jsx>{`
        .pulse-circle { width: 8px; height: 8px; background-color: #fff; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); } }
        
        .status-row:hover { transform: translateY(-4px); border-color: #eee; box-shadow: 0 12px 32px rgba(0,0,0,0.06); }
        .v850-card { border-left: 6px solid #f0f0f0; }

        @media (max-width: 768px) {
          .desktop-br { display: none; }
          .status-row { grid-template-columns: 50px 1fr !important; padding: 15px 20px !important; gap: 8px !important; }
          .status-row > div:nth-child(3), .status-row > div:nth-child(4) { display: none; }
          h1 { font-size: 1.8rem !important; }
        }
      `}</style>
    </div>
  );
}
