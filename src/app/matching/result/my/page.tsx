'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Phone, Star, Trophy, Frown, Clock, ArrowRight, Sparkles } from 'lucide-react';

// 데모 매칭 결과 상태: 'matched' | 'unmatched' | 'pending'
type DemoState = 'matched' | 'unmatched' | 'pending';

export default function MatchingResultPage() {
  const [demoState, setDemoState] = useState<DemoState>('matched');

  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh' }}>
      {/* Header */}
      <section style={{
        padding: '60px 20px 40px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.08) 0%, transparent 70%)',
        borderBottom: '1px solid var(--color-border)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>MATCHING RESULT</p>
        <h1 className="kl-heading-lg" style={{ marginBottom: '12px' }}>
          <span className="kl-gradient-text">매칭 결과</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '16px' }}>
          로그인 후 본인의 매칭 결과를 확인하세요
        </p>
        <Link href="/matching/result" style={{ 
          fontSize: '0.85rem', color: '#888', textDecoration: 'none', 
          fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' 
        }}>
          <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> 전체 매칭 히스토리 보기
        </Link>

        {/* Demo toggle (개발용, 실제 배포시 제거) */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>데모 상태:</span>
          {(['matched', 'unmatched', 'pending'] as DemoState[]).map((s) => (
            <button key={s} onClick={() => setDemoState(s)}
              style={{
                padding: '6px 14px', borderRadius: '100px', border: '1px solid var(--color-border)',
                background: demoState === s ? 'var(--color-primary)' : 'transparent',
                color: demoState === s ? '#FFFFFF' : '#666666',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'all 0.2s',
              }}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 20px 80px' }}>
        {demoState === 'matched' && <MatchedResult />}
        {demoState === 'unmatched' && <UnmatchedResult />}
        {demoState === 'pending' && <PendingResult />}
      </div>
    </div>
  );
}

function MatchedResult() {
  return (
    <div style={{ textAlign: 'center' }}>
      {/* Celebration */}
      <div style={{ position: 'relative', marginBottom: '40px' }}>
        <div style={{
          width: '140px', height: '140px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,111,97,0.3), rgba(255,111,97,0.05))',
          border: '2px solid rgba(255,111,97,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto',
          animation: 'float 4s ease-in-out infinite',
          boxShadow: '0 0 60px rgba(255,111,97,0.2)',
        }}>
          <Heart size={64} color="#FF6F61" fill="rgba(255,111,97,0.4)" />
        </div>
        {/* Sparkles */}
        {[
          { top: '0px', right: '60px' }, { top: '20px', left: '40px' },
          { bottom: '10px', right: '30px' }, { bottom: '0px', left: '70px' },
        ].map((pos, i) => (
          <div key={i} style={{ position: 'absolute', ...pos, animation: `float ${3 + i * 0.5}s ease-in-out infinite ${i * 0.3}s` }}>
            <Sparkles size={18} color="var(--color-primary)" style={{ opacity: 0.6 }} />
          </div>
        ))}
      </div>

      <div style={{
        padding: '8px 24px', borderRadius: '100px',
        background: 'rgba(110,174,124,0.15)', border: '1px solid rgba(110,174,124,0.3)',
        display: 'inline-block', marginBottom: '20px',
      }}>
        <span style={{ fontSize: '0.85rem', color: '#6EAE7C', fontWeight: '700' }}>🎉 매칭 성공!</span>
      </div>

      <h2 className="kl-heading-md" style={{ marginBottom: '12px' }}>
        <span className="kl-gradient-text">인연이 연결되었습니다</span>
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '36px' }}>
        축하합니다! 상호 호감이 확인되었습니다.<br/>
        아래에서 상대방의 연락처를 확인하세요.
      </p>

      {/* Match card */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(255,250,240,0.9), rgba(253,248,250,0.95))',
        border: '1px solid rgba(255,111,97,0.3)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 0 40px rgba(255,111,97,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '28px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6A98C8, #98C8E8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px', fontSize: '1.5rem',
            }}>👤</div>
            <p style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>나</p>
          </div>
          <Heart size={28} color="#FF6F61" fill="rgba(255,111,97,0.3)" />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #C878A0, #E8A0C8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px', fontSize: '1.5rem',
            }}>👤</div>
            <p style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>오*연 님</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            padding: '16px 20px', borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,111,97,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Phone size={18} color="var(--color-primary)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '3px' }}>연락처</p>
              <p style={{ fontWeight: '700', color: 'var(--color-text-primary)', fontSize: '1rem', letterSpacing: '0.05em' }}>010-****-5678</p>
            </div>
          </div>

          <a
            href="https://open.kakao.com/o/keylink-demo"
            target="_blank" rel="noopener noreferrer"
            style={{
              padding: '16px 20px', borderRadius: 'var(--radius-md)',
              background: 'rgba(254,229,0,0.08)', border: '1px solid rgba(254,229,0,0.2)',
              display: 'flex', alignItems: 'center', gap: '14px',
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(254,229,0,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(254,229,0,0.08)')}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(254,229,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={18} color="#FEE500" />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ fontSize: '0.75rem', color: 'rgba(254,229,0,0.7)', marginBottom: '3px' }}>카카오 오픈채팅</p>
              <p style={{ fontWeight: '700', color: '#FEE500', fontSize: '0.95rem' }}>오픈채팅방 입장하기</p>
            </div>
            <ArrowRight size={16} color="#FEE500" />
          </a>
        </div>
      </div>

      <div style={{
        padding: '14px 20px', borderRadius: 'var(--radius-md)',
        background: 'rgba(110,174,124,0.08)', border: '1px solid rgba(110,174,124,0.2)',
        display: 'flex', gap: '10px', alignItems: 'center',
      }}>
        <Trophy size={16} color="#6EAE7C" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'left', lineHeight: 1.5 }}>
          상대방의 개인정보는 매칭된 당사자에게만 공개됩니다. 무단 공유 시 영구 제명됩니다.
        </p>
      </div>
    </div>
  );
}

function UnmatchedResult() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '120px', height: '120px', borderRadius: '50%',
        background: 'rgba(158,142,126,0.1)', border: '1px solid rgba(158,142,126,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 32px',
      }}>
        <Frown size={52} color="var(--color-text-secondary)" />
      </div>

      <div style={{
        padding: '8px 20px', borderRadius: '100px',
        background: 'rgba(158,142,126,0.1)', border: '1px solid rgba(158,142,126,0.2)',
        display: 'inline-block', marginBottom: '20px',
      }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>이번엔 매칭이 되지 않았습니다</span>
      </div>

      <h2 className="kl-heading-md" style={{ marginBottom: '12px' }}>
        다음 기회가 있을 거예요 💙
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '36px' }}>
        아쉽지만 이번 행사에서는 상호 매칭이 이루어지지 않았습니다.<br/>
        30% 환불 혜택을 제공해 드립니다.
      </p>

      <div style={{
        background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)', padding: '28px', marginBottom: '24px',
      }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>30% 환불 예정</p>
        <p style={{ fontSize: '2rem', fontWeight: '800', color: '#FF6F61' }}>
          11,700원
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
          참가비 39,000원 × 30% = 환불 예정
        </p>
        <div style={{
          marginTop: '16px', padding: '12px', borderRadius: '10px',
          background: 'rgba(255,111,97,0.08)', border: '1px solid rgba(255,111,97,0.15)',
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-primary-light)' }}>
            📅 환불은 영업일 기준 1~3일 이내 처리됩니다
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/events" className="kl-btn-primary">다음 일정 보러가기 <ArrowRight size={16} /></Link>
        <Link href="/" className="kl-btn-outline">홈으로</Link>
      </div>
    </div>
  );
}

function PendingResult() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '120px', height: '120px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,111,97,0.15), transparent)',
        border: '2px solid rgba(255,111,97,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 32px',
        animation: 'float 5s ease-in-out infinite',
      }}>
        <Clock size={52} color="#FF6F61" />
      </div>

      <div style={{
        padding: '8px 20px', borderRadius: '100px',
        background: 'rgba(255,111,97,0.1)', border: '1px solid rgba(255,111,97,0.2)',
        display: 'inline-block', marginBottom: '20px',
      }}>
        <span style={{ fontSize: '0.85rem', color: '#FF6F61', fontWeight: '600' }}>매칭 결과 집계 중...</span>
      </div>

      <h2 className="kl-heading-md" style={{ marginBottom: '12px' }}>
        잠시만 기다려 주세요 ✨
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '36px' }}>
        현재 모든 순위 입력이 완료되면 운영팀이 매칭을 확정합니다.<br/>
        결과 공개까지 최대 24시간이 소요됩니다.
      </p>

      {/* Progress visual */}
      <div style={{
        background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)', padding: '28px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>순위 입력 현황</span>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#FF6F61' }}>11 / 14명</span>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'var(--color-surface-2)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${(11/14)*100}%`, borderRadius: '4px',
            background: '#FF6F61',
            transition: 'width 1s ease',
          }} />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '10px' }}>
          모든 참여자가 입력을 완료하면 자동으로 매칭이 진행됩니다
        </p>
      </div>

      <Link href="/" className="kl-btn-outline">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
