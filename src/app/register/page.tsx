'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle, User, Briefcase, Phone, Calendar, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const steps = ['카카오 인증', '기본 정보', '추가 정보', '완료'];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    gender: '',
    birthYear: '',
    name: '',
    job: '',
    phone: '',
    kakaoId: '',
    agreeTerms: false,
    agreePrivacy: false,
    agreePhoto: false,
  });

  const update = (key: string, value: string | boolean) => setForm(f => ({ ...f, [key]: value }));

  const handleKakaoAuth = async () => {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!form.agreeTerms || !form.agreePrivacy) { toast.error('필수 약관에 동의해주세요.'); return; }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsSubmitting(false);
    setStep(3);
  };

  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(255,111,97,0.07) 0%, transparent 70%)',
      padding: '90px 20px 60px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>
        {/* Back */}
        {step > 0 && step < 3 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '24px', padding: 0 }}>
            <ArrowLeft size={16} /> 이전 단계
          </button>
        )}

        {/* Progress */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            {steps.map((s, i) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: i <= step ? 'linear-gradient(135deg, #FF6F61, #E6E6FA)' : 'var(--color-surface-2)',
                  border: i <= step ? 'none' : '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: '700',
                  color: i <= step ? '#333333' : 'var(--color-text-muted)',
                  transition: 'all 0.3s',
                }}>
                  {i < step ? <CheckCircle size={16} /> : i + 1}
                </div>
                <span style={{ fontSize: '0.7rem', color: i === step ? '#FF6F61' : 'var(--color-text-muted)', fontWeight: i === step ? '800' : '500', whiteSpace: 'nowrap' }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
          <div style={{ height: '3px', background: 'var(--color-surface-2)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'linear-gradient(90deg, #FF6F61, #FF8A71)',
              width: `${(step / (steps.length - 1)) * 100}%`,
              transition: 'width 0.5s ease', borderRadius: '2px',
            }} />
          </div>
        </div>

        <div style={{
          background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)', padding: '36px 32px',
        }}>
          {/* Step 0: Kakao Auth */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '18px',
                background: '#FEE500', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#191919">
                  <path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '10px', color: 'var(--color-text-primary)' }}>카카오 본인 인증</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '28px' }}>
                신뢰도 높은 소개팅 환경을 위해<br/>카카오 계정으로 본인 인증을 진행합니다.
              </p>
              <button
                onClick={handleKakaoAuth} disabled={isSubmitting}
                style={{
                  width: '100%', padding: '16px', background: '#FEE500',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', fontWeight: '700', fontSize: '1rem', color: '#191919',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                }}
              >
                {isSubmitting ? '인증 중...' : '카카오로 본인 인증'}
              </button>
            </div>
          )}

          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px' }}>기본 정보 입력</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '28px' }}>매칭에 활용되는 기본 프로필입니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 성별 */}
                <div>
                  <label className="kl-label">성별 *</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[{ v: 'male', label: '👨 남성' }, { v: 'female', label: '👩 여성' }].map(({ v, label }) => (
                      <button key={v} type="button" onClick={() => update('gender', v)}
                        style={{
                          flex: 1, padding: '14px',
                          borderRadius: 'var(--radius-md)', border: '1.5px solid',
                          borderColor: form.gender === v ? '#FF6F61' : 'var(--color-border)',
                          background: form.gender === v ? 'rgba(255,111,97,0.12)' : '#FFFFFF',
                          color: form.gender === v ? '#FF6F61' : '#333333',
                          cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem', transition: 'all 0.2s',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="kl-label">이름 (실명) *</label>
                  <input className="kl-input" placeholder="주민등록상 이름을 입력하세요" value={form.name} onChange={e => update('name', e.target.value)} required />
                </div>
                <div>
                  <label className="kl-label">출생연도 *</label>
                  <input className="kl-input" type="number" placeholder="예: 1997" min="1965" max="2006" value={form.birthYear} onChange={e => update('birthYear', e.target.value)} required />
                  {form.birthYear && (
                    <p style={{ fontSize: '0.8rem', color: '#FF6F61', marginTop: '6px' }}>
                      만 {new Date().getFullYear() - parseInt(form.birthYear)}세
                    </p>
                  )}
                </div>
                <button className="kl-btn-primary" style={{ width: '100%', padding: '16px' }}
                  onClick={() => {
                    if (!form.gender || !form.name || !form.birthYear) { toast.error('모든 항목을 입력해주세요.'); return; }
                    setStep(2);
                  }}>
                  다음 단계 <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 추가 정보 */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px' }}>추가 정보 입력</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '28px' }}>매칭 품질 향상을 위한 정보입니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="kl-label">직업 *</label>
                  <input className="kl-input" placeholder="예: 간호사, 회사원, 대학원생, 자영업" value={form.job} onChange={e => update('job', e.target.value)} required />
                </div>
                <div>
                  <label className="kl-label">연락처 *</label>
                  <input className="kl-input" type="tel" placeholder="010-0000-0000" value={form.phone} onChange={e => update('phone', e.target.value)} required />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>매칭 성공 시 상대방에게 공개될 연락처입니다.</p>
                </div>
                <div>
                  <label className="kl-label">카카오 ID (선택)</label>
                  <input className="kl-input" placeholder="카카오톡 ID" value={form.kakaoId} onChange={e => update('kakaoId', e.target.value)} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>입력 시 매칭 결과에서 카카오 친구추가가 가능합니다.</p>
                </div>

                {/* 약관 동의 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                  {[
                    { key: 'agreeTerms', label: '[필수] 이용약관에 동의합니다', required: true },
                    { key: 'agreePrivacy', label: '[필수] 개인정보 수집·이용에 동의합니다', required: true },
                    { key: 'agreePhoto', label: '[선택] 촬영물 마케팅 활용에 동의합니다', required: false },
                  ].map(({ key, label, required }) => (
                    <label key={key} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form[key as keyof typeof form] as boolean}
                        onChange={e => update(key, e.target.checked)}
                        style={{ marginTop: '2px', accentColor: '#FF6F61', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.85rem', color: required ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', lineHeight: 1.5 }}>{label}</span>
                    </label>
                  ))}
                </div>

                <button className="kl-btn-primary" style={{ width: '100%', padding: '16px' }}
                  onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? '가입 처리 중...' : '회원가입 완료'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 완료 */}
          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,111,97,0.25), transparent)',
                border: '2px solid rgba(255,111,97,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px', animation: 'float 4s ease-in-out infinite',
              }}>
                <Heart size={40} color="#FF6F61" fill="rgba(255,111,97,0.3)" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>
                키링크 <span style={{ background: 'linear-gradient(135deg, #FF6F61, #FF8A71)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>가입 완료!</span>
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '32px' }}>
                어서오세요! 이제 부산·창원 소개팅 일정을<br/>신청하고 매칭 결과를 확인할 수 있습니다.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <Link href="/events" className="kl-btn-primary" style={{ width: '100%', padding: '16px' }}>
                  일정 신청하러 가기 <ArrowRight size={17} />
                </Link>
                <Link href="/" className="kl-btn-outline" style={{ width: '100%', padding: '14px' }}>
                  홈으로
                </Link>
              </div>
            </div>
          )}
        </div>

        {step === 0 && (
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            이미 계정이 있으신가요?{' '}
            <Link href="/login" style={{ color: '#FF6F61', fontWeight: '700', textDecoration: 'none' }}>로그인</Link>
          </p>
        )}
      </div>

      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
    </div>
  );
}
