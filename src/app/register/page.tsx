'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle, Heart, User, CheckSquare, Square, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSocial = searchParams?.get('social') === 'true';

  const [formStep, setFormStep] = useState(1); // 1: Form, 2: Complete
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rules
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

  // Form State
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
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

  const validateAll = () => {
    if (!isAllAgreed) { toast.error('모든 필수 약관에 동의해 주세요.'); return false; }
    if (!form.username) { toast.error('아이디를 입력해 주세요.'); return false; }
    if (!idChecked) { toast.error('아이디 중복확인을 진행해 주세요.'); return false; }
    if (!form.password || form.password !== form.passwordConfirm) {
      toast.error('비밀번호가 일치하지 않거나 비어 있습니다.');
      return false;
    }
    if (!form.gender) { toast.error('성별을 선택해 주세요.'); return false; }
    if (!form.name) { toast.error('이름을 입력해 주세요.'); return false; }
    if (!form.birthDate) { toast.error('생년월일을 입력해 주세요.'); return false; }
    if (!form.phone) { toast.error('연락처를 입력해 주세요.'); return false; }
    return true;
  };

  const handleIdCheck = () => {
    if (!form.username) return toast.error('아이디를 입력해주세요.');
    setIdChecked(true);
    toast.success('사용 가능한 아이디입니다.');
  };

  const handleSubmit = async () => {
    if (!validateAll()) return;
    setIsSubmitting(true);
    
    try {
      // 1. Firebase Auth - Create account (Map username to dummy email)
      const userEmail = `${form.username}@keylink.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, userEmail, form.password);
      const user = userCredential.user;

      // 2. Firestore - Save user details
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: form.username,
        name: form.name,
        gender: form.gender,
        phone: form.phone,
        birthDate: form.birthDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('회원가입이 완료되었습니다!');
      setFormStep(2);
      window.scrollTo(0, 0);
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('이미 사용 중인 아이디입니다.');
      } else {
        toast.error('회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(255,111,97,0.07) 0%, transparent 70%)',
      padding: '90px 20px 80px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        
        {formStep === 1 ? (
          <div style={{
            background: '#FFFFFF', border: '1px solid var(--color-border)',
            borderRadius: '24px', padding: '48px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.03)'
          }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '32px', color: '#111', textAlign: 'center' }}>
              회원가입
            </h1>

            <div style={{ height: '1px', background: '#f0f0f0', margin: '0 0 40px 0' }} />

            {/* Form Fields Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* ID */}
              {!isSocial && (
                <div>
                  <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>아이디</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="kl-input" style={{ flex: 1, borderRadius: '12px', height: '54px' }} placeholder="아이디를 입력해 주세요" value={form.username} onChange={e => { update('username', e.target.value); setIdChecked(false); }} />
                    <button type="button" onClick={handleIdCheck} style={{ 
                      padding: '0 20px', background: idChecked ? '#F0F0F0' : '#333', color: idChecked ? '#999' : '#FFF', 
                      borderRadius: '12px', border: 'none', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                    }}>
                      중복확인
                    </button>
                  </div>
                </div>
              )}

              {/* Password */}
              {!isSocial && (
                <div>
                  <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>비밀번호</label>
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <input
                      className="kl-input"
                      style={{ borderRadius: '12px', height: '54px', paddingRight: '48px' }}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호"
                      value={form.password}
                      onChange={e => update('password', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="kl-input"
                      style={{ borderRadius: '12px', height: '54px', paddingRight: '48px' }}
                      type={showPasswordConfirm ? 'text' : 'password'}
                      placeholder="비밀번호 확인"
                      value={form.passwordConfirm}
                      onChange={e => update('passwordConfirm', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                    >
                      {showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {form.password && form.passwordConfirm && (
                    <div style={{ 
                      fontSize: '0.8rem', 
                      marginTop: '8px', 
                      fontWeight: '600',
                      color: form.password === form.passwordConfirm ? '#22C55E' : '#EF4444'
                    }}>
                      {form.password === form.passwordConfirm ? '✓ 비밀번호가 일치합니다' : '✕ 비밀번호가 일치하지 않습니다'}
                    </div>
                  )}
                </div>
              )}

              {/* Gender */}
              <div>
                <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>성별</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {[{ v: 'male', label: '남성' }, { v: 'female', label: '여성' }].map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => update('gender', v)}
                      style={{
                        flex: 1, padding: '18px', borderRadius: '14px', border: form.gender === v ? '2px solid #FF6F61' : '1px solid #ddd',
                        background: form.gender === v ? '#FFF5F4' : '#FFFFFF', color: form.gender === v ? '#FF6F61' : '#333333',
                        cursor: 'pointer', fontWeight: '800', fontSize: '1rem', transition: 'all 0.2s'
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>이름 (실명)</label>
                <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} placeholder="이름을 입력해 주세요" value={form.name} onChange={e => update('name', e.target.value)} />
              </div>

              {/* Birthdate */}
              <div>
                <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>생년월일</label>
                <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="text" placeholder="ex. 1995-05-18" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} />
              </div>

              {/* Phone */}
              <div>
                <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>연락처</label>
                <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="tel" placeholder="ex. 010-1234-5678" value={form.phone} onChange={e => update('phone', e.target.value)} />
              </div>

              {/* Terms Section (Relocated) */}
              <div style={{ marginTop: '12px', padding: '20px', background: 'var(--color-surface-2)', borderRadius: '16px' }}>
                <button onClick={toggleAllAgreements} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px', padding: 0
                }}>
                  {isAllAgreed ? <CheckSquare color="#FF6F61" fill="rgba(255,111,97,0.2)" size={20}/> : <Square color="#999" size={20}/>}
                  <span style={{ fontWeight: '800', fontSize: '0.9rem', color: isAllAgreed ? '#FF6F61' : '#333' }}>전체 동의하기</span>
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: 'terms', label: '서비스 이용약관 동의 (필수)' },
                    { key: 'privacy', label: '개인정보 수집 및 이용 동의 (필수)' },
                    { key: 'thirdParty', label: '개인정보 제3자 소유 제공 동의 (필수)' },
                    { key: 'location', label: '위치 기반 서비스 이용약관 동의 (필수)' },
                  ].map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      onClick={() => setAgreements(a => ({ ...a, [key]: !a[key as keyof typeof agreements] }))}>
                      {agreements[key as keyof typeof agreements] ? <CheckCircle color="#FF6F61" size={16} fill="rgba(255,111,97,0.1)" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.2px solid #ccc' }} />}
                      <span style={{ fontSize: '0.8rem', color: '#777', fontWeight: '500' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="kl-btn-primary" 
                style={{ width: '100%', padding: '20px', marginTop: '8px', borderRadius: '100px', fontSize: '1.1rem', fontWeight: '900', boxShadow: '0 10px 20px rgba(255,111,97,0.2)' }} 
                onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? '가입 처리 중...' : '회원가입 완료'}
              </button>
            </div>
          </div>
        ) : (
          /* Step: 완료 */
          <div style={{
            background: '#FFFFFF', border: '1px solid var(--color-border)',
            borderRadius: '24px', padding: '60px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,111,97,0.25), transparent)',
              border: '2px solid rgba(255,111,97,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 32px', animation: 'float 4s ease-in-out infinite',
            }}>
              <Heart size={48} color="#FF6F61" fill="rgba(255,111,97,0.3)" />
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '16px', color: '#111' }}>
              가입을 축하합니다!
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '48px', fontSize: '1.05rem' }}>
              이제 키링크의 모든 소개팅 일정을<br/>자유롭게 조회하고 신청하실 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexDirection: 'column' }}>
              <Link href="/events" className="kl-btn-primary" style={{ width: '100%', padding: '20px', borderRadius: '100px', fontWeight: '800', fontSize: '1.05rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                소개팅 일정 확인하기 <ArrowRight size={18} />
              </Link>
              <Link href="/" className="kl-btn-outline" style={{ width: '100%', padding: '20px', borderRadius: '100px', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                홈으로 가기
              </Link>
            </div>
          </div>
        )}
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
