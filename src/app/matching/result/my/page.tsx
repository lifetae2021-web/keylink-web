'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Phone, ArrowRight, Sparkles, Frown, Clock, Trophy, MapPin, ShieldCheck, Users, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CherryBlossoms from '@/components/CherryBlossoms';

// 데모 매칭 결과 상태: 'matched' | 'unmatched' | 'pending'
type DemoState = 'matched' | 'unmatched' | 'pending';

export default function MatchingResultPage() {
  const [demoState, setDemoState] = useState<DemoState>('matched');

  return (
    <div style={{ paddingBottom: '100px', background: 'var(--color-bg)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <CherryBlossoms />
      
      {/* Premium Sticky Header for v3.2.2 */}
      <div style={{ 
        position: 'sticky', top: '85px', zIndex: 100,
        background: 'rgba(255, 111, 97, 0.9)', backdropFilter: 'blur(10px)',
        color: '#fff', padding: '12px 20px', textAlign: 'center',
        fontWeight: '800', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
      }}>
        <div className="pulse-circle" />
        <span>실시간 매칭 결과가 업데이트되었습니다</span>
      </div>

      <div className="kl-container" style={{ paddingTop: '100px', position: 'relative', zIndex: 1 }}>
        {/* Navigation & Title */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,111,97,0.1)', color: '#FF6F61', padding: '6px 14px', borderRadius: '100px', fontWeight: '800', fontSize: '0.85rem', marginBottom: '16px' }}>
            <Sparkles size={14} /> 개인 매칭 리포트
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '900', marginBottom: '12px', letterSpacing: '-0.03em', color: '#111' }}>
            내 <span className="kl-gradient-text">매칭 결과</span> 확인하기
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>
            나를 선택한 상대방과의 소중한 인연을 확인해 보세요.
          </p>
        </div>

        {/* Demo toggle (개발용) */}
        <div style={{ marginBottom: '48px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {(['matched', 'unmatched', 'pending'] as DemoState[]).map((s) => (
            <button key={s} onClick={() => setDemoState(s)}
              style={{
                padding: '10px 20px', borderRadius: '100px', border: '1px solid var(--color-border)',
                background: demoState === s ? 'var(--color-primary)' : '#fff',
                color: demoState === s ? '#FFFFFF' : '#666666',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', transition: 'all 0.2s',
                boxShadow: demoState === s ? '0 4px 12px rgba(255,111,97,0.2)' : 'none'
              }}>
              {s.toUpperCase()} 상태 보기
            </button>
          ))}
        </div>

        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={demoState}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
            >
              {demoState === 'matched' && <MatchedResultView />}
              {demoState === 'unmatched' && <UnmatchedResultView />}
              {demoState === 'pending' && <PendingResultView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <style jsx>{`
        .pulse-circle { width: 8px; height: 8px; background-color: #fff; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); } }
      `}</style>
    </div>
  );
}

function MatchedResultView() {
  return (
    <div style={{ textAlign: 'center' }}>
      {/* Celebration Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{
          width: '120px', height: '120px', borderRadius: '40px',
          background: 'linear-gradient(135deg, #FF6F61, #FF8A71)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', margin: '0 auto 24px',
          boxShadow: '0 20px 40px rgba(255,111,97,0.3)',
          transform: 'rotate(-5deg)'
        }}>
          <Heart size={60} fill="white" />
        </div>
        <h2 style={{ fontSize: '2rem', fontWeight: '900', color: '#111', marginBottom: '16px' }}>
          축하합니다!<br/>소중한 <span style={{ color: '#FF6F61' }}>인연</span>이 닿았습니다.
        </h2>
        <p style={{ color: '#666', fontWeight: '500', lineHeight: '1.6' }}>
          상대방도 당신을 선택하셨습니다.<br/>
          아래 정보를 확인하고 대화를 시작해 보세요!
        </p>
      </div>

      {/* Opponent Info Card - Compact List Style */}
      <div style={{ 
        background: '#fff', 
        borderRadius: '32px', 
        padding: '32px', 
        border: '1.5px solid #eee',
        boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
        marginBottom: '32px'
      }}>
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
          padding: '12px 20px', background: 'rgba(0,0,0,0.03)', borderRadius: '16px',
          fontWeight: '800', color: '#666', fontSize: '0.8rem', marginBottom: '16px',
          textAlign: 'center'
        }}>
          <span>번호</span>
          <span>나이</span>
          <span>직업</span>
          <span>키</span>
        </div>

        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
          background: '#fff', border: '1px solid #f0f0f0', borderRadius: '24px',
          padding: '24px 20px', alignItems: 'center', textAlign: 'center'
        }}>
          <div style={{ fontWeight: '800', color: '#FF6F61', fontSize: '1.1rem' }}>M-12</div>
          <div style={{ fontWeight: '700', color: '#111' }}>94년생</div>
          <div style={{ fontWeight: '800', color: '#007AFF' }}>IT 대기업</div>
          <div style={{ color: '#666', fontWeight: '500' }}>181cm</div>
        </div>

        {/* Contact Links */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a
            href="https://open.kakao.com/o/sKeylinkMatch"
            target="_blank" rel="noopener noreferrer"
            style={{
              padding: '20px', borderRadius: '20px',
              background: '#FEE500', color: '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              textDecoration: 'none', fontWeight: '900', fontSize: '1.1rem',
              boxShadow: '0 10px 20px rgba(254,229,0,0.3)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <MessageCircle size={22} fill="#111" />
            카카오 오픈채팅방 입장하기
          </a>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, padding: '16px', background: '#f9f9f9', borderRadius: '16px', border: '1px solid #eee' }}>
              <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>연락처</p>
              <p style={{ fontWeight: '700', fontSize: '1rem' }}>010-****-5678</p>
            </div>
            <div style={{ flex: 1, padding: '16px', background: '#f9f9f9', borderRadius: '16px', border: '1px solid #eee' }}>
              <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>성함</p>
              <p style={{ fontWeight: '700', fontSize: '1rem' }}>오*연</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center',
        background: '#FFF8F7', padding: '16px 24px', borderRadius: '20px', border: '1px dashed #FF6F61'
      }}>
        <Trophy size={18} color="#FF6F61" />
        <span style={{ fontSize: '0.85rem', color: '#FF6F61', fontWeight: '600' }}>상대방의 개인정보는 매칭 당사자에게만 안전하게 공개됩니다.</span>
      </div>
    </div>
  );
}

function UnmatchedResultView() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '100px', height: '100px', borderRadius: '50%',
        background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px'
      }}>
        <Frown size={48} color="#ccc" />
      </div>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '16px' }}>
        아쉽지만 이번 기수에는<br/>인연이 닿지 않았습니다.
      </h2>
      <p style={{ color: '#666', fontWeight: '500', lineHeight: '1.6', marginBottom: '32px' }}>
        키링크는 당신의 소중한 시간을 존중합니다.<br/>
        매칭 실패 시 안내된 대로 <span style={{ color: '#FF6F61', fontWeight: '700' }}>30% 부분 환불</span>이 진행됩니다.
      </p>

      <div style={{ background: '#fff', borderRadius: '32px', padding: '40px', border: '1.5px solid #eee', marginBottom: '32px' }}>
        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px' }}>환불 예정 금액</p>
        <p style={{ fontSize: '2.4rem', fontWeight: '900', color: '#111' }}>11,700원</p>
        <p style={{ fontSize: '0.8rem', color: '#bbb', marginTop: '12px' }}>영업일 기준 1~3일 이내에 신청하신 계좌로 환불됩니다.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <Link href="/events" className="kl-btn-primary" style={{ padding: '18px 40px', borderRadius: '100px', fontWeight: '800', textDecoration: 'none' }}>
          다음 기수 신청하러 가기 <ArrowRight size={18} />
        </Link>
        <Link href="/" style={{ padding: '18px 30px', borderRadius: '100px', fontWeight: '700', color: '#666', background: '#eee', textDecoration: 'none' }}>
          홈으로
        </Link>
      </div>
    </div>
  );
}

function PendingResultView() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '100px', height: '100px', borderRadius: '50%',
        background: 'rgba(255,111,97,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px', animation: 'spin 10s linear infinite'
      }}>
        <Clock size={48} color="#FF6F61" />
      </div>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '16px' }}>
        현재 매칭 결과를 <br/>집계 중입니다 ✨
      </h2>
      <p style={{ color: '#666', fontWeight: '500', lineHeight: '1.6', marginBottom: '40px' }}>
        성비와 선호도를 바탕으로 최적의 매칭을 조율하고 있습니다.<br/>
        완료 시 카카오톡으로 개별 안내를 드립니다.
      </p>

      <div style={{ background: '#fff', borderRadius: '32px', padding: '32px', border: '1.5px solid #eee', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: '700', fontSize: '0.9rem' }}>
          <span>참여자 매칭률 데이터 분석</span>
          <span style={{ color: '#FF6F61' }}>85% 완료</span>
        </div>
        <div style={{ height: '12px', background: '#f5f5f5', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ width: '85%', height: '100%', background: 'linear-gradient(90deg, #FF9A8B, #FF6F61)', borderRadius: '6px' }} />
        </div>
      </div>

      <Link href="/" style={{ padding: '18px 40px', borderRadius: '100px', fontWeight: '700', color: '#666', background: '#f5f5f5', textDecoration: 'none', display: 'inline-block' }}>
        홈으로 돌아가기
      </Link>
      
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
