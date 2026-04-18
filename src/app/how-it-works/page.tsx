'use client';
import { Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const steps = [
    { num: '01', title: '신청하기', desc: '원하는 날짜 선택 후 신청' },
    { num: '02', title: '참가자 선발 및 입금', desc: '선발된 분들께 안내 문자 발송, 입금 확인 후 최종 참여 확정' },
    { num: '03', title: '행사 당일 참석', desc: '신분증 지참 후 안내 된 장소에 방문' },
    { num: '04', title: '신원 확인', desc: '신분증 확인 후 자리 안내' },
    { num: '05', title: '1:1 로테이션 대화', desc: '모든 이성과 약 15분 집중 대화' },
    { num: '06', title: '호감도 순위 입력', desc: '행사 종료 후 웹사이트에서 1~3순위 선택하여 제출' },
    { num: '07', title: '매칭 결과 확인', desc: '상호 호감 매칭 시 오픈채팅방 초대' },
    { num: '08', title: '새로운 시작 ✨', desc: '매칭 성공 시 카카오 오픈채팅방을 통해 자연스러운 만남 시작' },
  ];

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* ── Header Spacer ── */}
      <div style={{ height: '85px' }} />

      {/* ── Hero Section ── */}
      <section style={{ 
        padding: '100px 20px 60px', 
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255,219,233,0.3) 0%, rgba(253,253,253,1) 100%)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '100px',
            background: 'rgba(255,111,97,0.1)', border: '1px solid rgba(255,111,97,0.2)',
            marginBottom: '24px',
          }}>
            <Sparkles size={14} color="var(--color-accent)" />
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-accent)', letterSpacing: '0.1em' }}>
              SERVICE PROCESS
            </span>
          </div>
          <h1 className="kl-heading-xl" style={{ marginBottom: '24px' }}>
            키링크 <span className="kl-gradient-text">진행 방식</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', lineHeight: 1.8, wordBreak: 'keep-all' }}>
            신청부터 매칭까지, 키링크의 체계적이고 투명한 프로세스를 안내해 드립니다.<br/>
            여러분의 소중한 만남을 위해 정성을 다해 준비합니다.
          </p>
        </div>
      </section>

      {/* ── Main Process Grid ── */}
      <section style={{ padding: '80px 20px 120px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '24px', 
            justifyContent: 'center' 
          }}>
            {steps.map((step, idx) => (
              <div key={idx} style={{
                background: 'var(--gradient-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
                onMouseEnter={(e) => { 
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,111,97,0.4)'; 
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; 
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => { 
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; 
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; 
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{
                  position: 'absolute', top: '16px', right: '16px',
                  fontSize: '3.5rem', fontWeight: '900', color: 'rgba(255,111,97,0.06)',
                  lineHeight: 1, userSelect: 'none',
                }}>{step.num}</div>
                
                <div style={{
                  width: '50px', height: '50px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #FFDBE9, #E6E6FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '900', color: '#1A1A1A', fontSize: '1rem',
                  boxShadow: 'inset 0 0 10px rgba(255,255,255,0.5)'
                }}>
                  {step.num}
                </div>
                
                <h3 style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--color-text-primary)', marginTop: '8px' }}>
                  {step.title}
                </h3>
                
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, wordBreak: 'keep-all' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* ── Call to Action ── */}
          <div style={{ 
            marginTop: '80px', 
            textAlign: 'center',
            padding: '60px',
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)'
          }}>
            <h2 className="kl-heading-md" style={{ marginBottom: '16px' }}>궁금한 점이 해결되셨나요?</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px' }}>지금 바로 다음 기회에 도전해 보세요.</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/events" className="kl-btn-primary" style={{ padding: '16px 48px' }}>
                로테이션 소개팅 신청하기 <ArrowRight size={18} />
              </Link>
              <Link href="/notices" className="kl-btn-outline" style={{ padding: '16px 48px' }}>
                자주 묻는 질문 확인
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
