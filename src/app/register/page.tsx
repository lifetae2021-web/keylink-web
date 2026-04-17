'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle, Heart, User, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSocial = searchParams?.get('social') === 'true';

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Rules
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    thirdParty: false,
    location: false,
  });

  const isAllAgreed = Object.values(agreements).every(Boolean);

  const toggleAllAgreements = () => {
    const nextVal = !isAllAgreed;
    setAgreements({ terms: nextVal, privacy: nextVal, thirdParty: nextVal, location: nextVal });
  };

  // Step 2 & 3 Form
  const [form, setForm] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
    name: '',
    gender: '',
    phone: '',
    birthDate: '',
  });

  const [idChecked, setIdChecked] = useState(false);
  
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const formatBirthDate = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const update = (key: string, value: string) => {
    let formattedValue = value;
    if (key === 'phone') formattedValue = formatPhone(value);
    if (key === 'birthDate') formattedValue = formatBirthDate(value);
    setForm(f => ({ ...f, [key]: formattedValue }));
  };

  // Steps Configuration
  const stepsConfig = [
    { num: 1, label: '약관 동의' },
    { num: 2, label: '계정 정보', hidden: isSocial },
    { num: 3, label: '상세 정보' },
    { num: 4, label: '완료' },
  ].filter(s => !s.hidden);

  const currentDisplayIndex = stepsConfig.findIndex(s => s.num === step);

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!isAllAgreed) {
        toast.error('모든 필수 약관에 동의해 주세요.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!form.username) { toast.error('아이디를 입력해 주세요.'); return false; }
      if (!idChecked) { toast.error('아이디 중복확인을 진행해 주세요.'); return false; }
      if (!form.password || form.password !== form.passwordConfirm) {
        toast.error('비밀번호가 일치하지 않거나 비어 있습니다.');
        return false;
      }
      if (!form.name) { toast.error('이름을 입력해 주세요.'); return false; }
      return true;
    }
    if (currentStep === 3) {
      if (!form.gender) { toast.error('성별을 선택해 주세요.'); return false; }
      if (!form.phone || !form.birthDate) { toast.error('연락처와 생년월일을 입력해 주세요.'); return false; }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    
    if (step === 1 && isSocial) {
      setStep(3); // 스킵 Step 2
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 3 && isSocial) {
      setStep(1);
    } else {
      setStep(step - 1);
    }
  };

  const handleIdCheck = () => {
    if (!form.username) return toast.error('아이디를 입력해주세요.');
    setIdChecked(true);
    toast.success('사용 가능한 아이디입니다.');
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    setStep(4);
  };

  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(255,111,97,0.07) 0%, transparent 70%)',
      padding: '90px 20px 60px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        {/* Back */}
        {step > 1 && step < 4 && (
          <button onClick={handleBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '24px', padding: 0 }}>
            <ArrowLeft size={16} /> 이전 단계
          </button>
        )}

        {/* Progress Tracker */}
        {step < 4 && (
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '16px', left: '20px', right: '20px', height: '2px', background: 'var(--color-surface-2)', zIndex: 0 }}>
                <div style={{
                  height: '100%', background: 'linear-gradient(90deg, #FF6F61, #FF8A71)',
                  width: `${(currentDisplayIndex / (stepsConfig.length - 2)) * 100}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              
              {stepsConfig.filter(s => s.num < 4).map((s, i) => {
                const isActive = i <= currentDisplayIndex;
                const isCurrent = i === currentDisplayIndex;
                return (
                  <div key={s.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, position: 'relative', background: 'transparent' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: isActive ? '#FF6F61' : 'var(--color-surface)',
                      border: isActive ? '2px solid #FF6F61' : '2px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: '800',
                      color: isActive ? '#FFF' : 'var(--color-text-muted)',
                      transition: 'all 0.3s ease',
                      boxShadow: isCurrent ? '0 0 0 4px rgba(255,111,97,0.15)' : 'none'
                    }}>
                      {i < currentDisplayIndex ? <CheckCircle size={16} /> : (i + 1)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: isCurrent ? '#FF6F61' : 'var(--color-text-muted)', fontWeight: isCurrent ? '800' : '600' }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--gradient-card)', border: '1px solid var(--color-border)',
          borderRadius: '24px', padding: '40px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.02)'
        }}>
          {/* Step 1: 약관 동의 */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#111' }}>서비스 가입을 위해<br/>이용 약관에 동의해 주세요.</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '32px' }}>원활한 서비스 제공을 위해 필수 약관 동의가 필요합니다.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button onClick={toggleAllAgreements} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: isAllAgreed ? 'rgba(255,111,97,0.08)' : 'var(--color-surface-2)',
                  border: isAllAgreed ? '1px solid rgba(255,111,97,0.3)' : '1px solid transparent', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', width: '100%'
                }}>
                  {isAllAgreed ? <CheckSquare color="#FF6F61" fill="rgba(255,111,97,0.2)" size={22}/> : <Square color="#999" size={22}/>}
                  <span style={{ fontWeight: '800', fontSize: '1.05rem', color: isAllAgreed ? '#FF6F61' : '#333' }}>전체 동의</span>
                </button>
                <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { key: 'terms', label: '서비스 이용약관 동의 (필수)' },
                    { key: 'privacy', label: '개인정보 수집/이용 동의 (필수)' },
                    { key: 'thirdParty', label: '개인정보 제 3자 정보제공 동의 (필수)' },
                    { key: 'location', label: '위치기반 서비스 이용약관 동의 (필수)' },
                  ].map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      onClick={() => setAgreements(a => ({ ...a, [key]: !a[key as keyof typeof agreements] }))}>
                      {agreements[key as keyof typeof agreements] ? <CheckCircle color="#FF6F61" size={18} fill="rgba(255,111,97,0.1)" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #ccc' }} />}
                      <span style={{ fontSize: '0.9rem', color: '#555', fontWeight: '500' }}>{label}</span>
                    </div>
                  ))}
                </div>
                
                <button className="kl-btn-primary" style={{ width: '100%', padding: '18px', marginTop: '20px', borderRadius: '100px', fontSize: '1.05rem', fontWeight: '800' }} onClick={handleNext}>
                  다음 단계
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 계정 정보 (Not Social) */}
          {step === 2 && !isSocial && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#111' }}>로그인에 사용할<br/>계정 정보를 입력해 주세요.</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '32px' }}>
                <div>
                  <label className="kl-label" style={{ fontWeight: '700' }}>아이디 <CheckCircle size={14} color={idChecked ? "#03C75A" : "#ccc"}/></label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="kl-input" style={{ flex: 1, borderRadius: '12px' }} placeholder="아이디" value={form.username} onChange={e => { update('username', e.target.value); setIdChecked(false); }} />
                    <button type="button" onClick={handleIdCheck} style={{ 
                      padding: '0 16px', background: idChecked ? '#F0F0F0' : '#333', color: idChecked ? '#999' : '#FFF', 
                      borderRadius: '12px', border: 'none', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' 
                    }}>
                      중복확인
                    </button>
                  </div>
                </div>
                <div>
                  <label className="kl-label" style={{ fontWeight: '700' }}>비밀번호 <CheckCircle size={14} color={form.password.length > 3 ? "#03C75A" : "#ccc"}/></label>
                  <input className="kl-input" style={{ borderRadius: '12px', marginBottom: '8px' }} type="password" placeholder="비밀번호" value={form.password} onChange={e => update('password', e.target.value)} />
                  <input className="kl-input" style={{ borderRadius: '12px' }} type="password" placeholder="비밀번호 확인" value={form.passwordConfirm} onChange={e => update('passwordConfirm', e.target.value)} />
                </div>
                <div>
                  <label className="kl-label" style={{ fontWeight: '700' }}>이름 (실명) <CheckCircle size={14} color={form.name ? "#03C75A" : "#ccc"}/></label>
                  <input className="kl-input" style={{ borderRadius: '12px' }} placeholder="이름을 입력해 주세요" value={form.name} onChange={e => update('name', e.target.value)} />
                </div>
                
                <button className="kl-btn-primary" style={{ width: '100%', padding: '18px', marginTop: '16px', borderRadius: '100px', fontSize: '1.05rem', fontWeight: '800' }} onClick={handleNext}>
                  다음 단계
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 상세 정보 */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#111' }}>{isSocial ? '마지막으로' : '조금만 더!'} <br/>상세 정보를 입력해 주세요.</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '32px' }}>
                <div>
                  <label className="kl-label" style={{ fontWeight: '700' }}>성별 <CheckCircle size={14} color={form.gender ? "#03C75A" : "#ccc"}/></label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[{ v: 'male', label: '남성' }, { v: 'female', label: '여성' }].map(({ v, label }) => (
                      <button key={v} type="button" onClick={() => update('gender', v)}
                        style={{
                          flex: 1, padding: '16px', borderRadius: '14px', border: form.gender === v ? '2px solid #FF6F61' : '1px solid #ddd',
                          background: form.gender === v ? '#FFF5F4' : '#FFFFFF', color: form.gender === v ? '#FF6F61' : '#333333',
                          cursor: 'pointer', fontWeight: '800', fontSize: '1rem', transition: 'all 0.2s', width: '100%'
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="kl-label" style={{ fontWeight: '700' }}>연락처 <CheckCircle size={14} color={form.phone ? "#03C75A" : "#ccc"}/></label>
                  <input className="kl-input" style={{ borderRadius: '12px', width: '100%' }} type="tel" placeholder="ex. 010-1234-5678" value={form.phone} onChange={e => update('phone', e.target.value)} />
                </div>
                <div>
                  <label className="kl-label" style={{ fontWeight: '700' }}>생년월일 <CheckCircle size={14} color={form.birthDate ? "#03C75A" : "#ccc"}/></label>
                  <input className="kl-input" style={{ borderRadius: '12px', width: '100%' }} type="text" placeholder="ex. 1995-05-18" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} />
                </div>

                <button className="kl-btn-primary" style={{ width: '100%', padding: '18px', marginTop: '16px', borderRadius: '100px', fontSize: '1.05rem', fontWeight: '800' }} onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? '가입 처리 중...' : '회원가입 완료'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: 완료 */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,111,97,0.25), transparent)',
                border: '2px solid rgba(255,111,97,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px', animation: 'float 4s ease-in-out infinite',
              }}>
                <Heart size={40} color="#FF6F61" fill="rgba(255,111,97,0.3)" />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '12px', color: '#111' }}>
                가입을 환영합니다!
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '40px' }}>
                이제 키링크의 모든 소개팅 일정을<br/>자유롭게 조회하고 신청하실 수 있습니다.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <Link href="/events" className="kl-btn-primary" style={{ width: '100%', padding: '18px', borderRadius: '100px', fontWeight: '800', fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  소개팅 일정 확인하기 <ArrowRight size={18} />
                </Link>
                <Link href="/" className="kl-btn-outline" style={{ width: '100%', padding: '18px', borderRadius: '100px', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  홈으로
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: '90px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
