'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, CheckCircle, CheckSquare, Square, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, updateEmail } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getAuthErrorMessage } from '@/lib/auth-errors';

export default function SocialProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    thirdParty: false,
    photoConsent: false,
  });

  const isAllAgreed = agreements.terms && agreements.privacy && agreements.thirdParty && agreements.photoConsent;

  const [form, setForm] = useState({
    email: '',
    name: '',
    gender: '',
    phone: '',
    birthDate: '',
  });

  // Validation: Enable button only when everything is filled
  const isValid = 
    isAllAgreed && 
    form.email.includes('@') && 
    form.name.length >= 2 && 
    form.gender && 
    form.birthDate.length === 10 && // 1994-05-30 format (hyphened)
    form.phone.length >= 12;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        toast.error('로그인이 필요합니다.');
        router.replace('/login');
        return;
      }
      
      const userSnap = await getDoc(doc(db, 'users', u.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const isComplete = data && data.gender && data.birthDate && data.phone;
        if (isComplete) {
          router.replace('/');
          return;
        }
      }

      setUser(u);
      setForm(prev => ({
        ...prev,
        email: u.email || ''
      }));
      setIsLoading(false);
    });
    return () => unsub();
  }, [router]);

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
    if (error) setError(null); // Clear error on any input
    if (key === 'email' && emailError) setEmailError(null); // Clear email-specific error
    let formattedValue = value;
    if (key === 'phone') formattedValue = formatPhone(value);
    if (key === 'birthDate') formattedValue = formatBirthDate(value);
    setForm(f => ({ ...f, [key]: formattedValue }));
  };

  const toggleAll = () => {
    if (error) setError(null);
    const nextVal = !isAllAgreed;
    setAgreements({ terms: nextVal, privacy: nextVal, thirdParty: nextVal, photoConsent: nextVal });
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    if (!user) return;

    setIsSubmitting(true);
    setEmailError(null);

    try {
      // 휴대폰 번호 중복 확인
      const phoneRes = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, excludeUid: user.uid }),
      });
      const phoneData = await phoneRes.json();
      if (!phoneData.available) {
        toast.error(phoneData.message || '이미 가입된 연락처입니다.');
        setIsSubmitting(false);
        return;
      }

      // 1. Setup Firestore Data
      const emailPrefix = form.email.split('@')[0] || '';
      const sanitizedPrefix = emailPrefix.replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = user.uid.slice(0, 4);
      const generatedUsername = sanitizedPrefix ? `${sanitizedPrefix}_${uniqueSuffix}` : `user_${uniqueSuffix}_${Date.now().toString().slice(-4)}`;

      const provider = user.uid.startsWith('kakao_') ? 'kakao' : 'google';
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: generatedUsername,
        email: form.email,
        name: form.name,
        gender: form.gender,
        phone: form.phone,
        birthDate: form.birthDate,
        role: 'user',
        provider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photoConsent: agreements.photoConsent,
        photoURL: user.photoURL || null,
      });

      toast.success('가입이 완료되었습니다! 🎉');
      router.push('/');
    } catch (err: any) {
      console.error('Registration Error:', err.code, err);
      toast.error('입력 정보를 다시 확인해 주세요!');
      setEmailError(getAuthErrorMessage(err.code));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #eee', borderTop: '3px solid #FF6F61', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#666', fontWeight: '600' }}>정보를 불러오는 중...</p>
        </div>
        <style>{`@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      paddingTop: '90px', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(255,111,97,0.07) 0%, transparent 70%)',
      padding: '90px 20px 80px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div style={{
          background: '#FFFFFF', border: '1px solid var(--color-border)',
          borderRadius: '24px', padding: '48px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.03)'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', letterSpacing: '-0.02em' }}>
              {user?.uid.startsWith('kakao_') ? '카카오 회원가입' : '구글 회원가입'}
            </h1>
          </div>

          <div style={{ height: '1px', background: '#f0f0f0', margin: '32px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* 1. Email */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>이메일</label>
              <input
                className="kl-input"
                style={{
                  borderRadius: '12px',
                  height: '54px',
                  border: '1px solid var(--color-border)',
                  background: '#F8F9FA',
                  color: '#888',
                  cursor: 'not-allowed',
                }}
                type="email"
                value={form.email}
                readOnly
              />
              <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '6px', marginLeft: '4px' }}>
                소셜 계정 이메일은 변경할 수 없습니다.
              </p>
              {emailError && (
                <p style={{ color: '#FF6F61', fontSize: '0.8rem', fontWeight: '700', marginTop: '8px', marginLeft: '4px' }}>
                  {emailError}
                </p>
              )}
              {!emailError && (
                <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '6px', marginLeft: '4px' }}>
                  계정 분실 시 찾기 및 주요 공지 수신용으로 사용
                </p>
              )}
            </div>

            {/* 2. Name */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>이름 (실명)</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} placeholder="실명을 입력해 주세요" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>

            {/* 3. Gender */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>성별</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[{ v: 'male', label: '남성' }, { v: 'female', label: '여성' }].map(({ v, label }) => (
                  <button key={v} type="button" onClick={() => update('gender', v)}
                    style={{
                      flex: 1, padding: '18px', borderRadius: '14px', border: form.gender === v ? '2px solid #FF6F61' : '1px solid #ddd',
                      background: form.gender === v ? '#FFF5F4' : '#FFFFFF', color: form.gender === v ? '#FF6F61' : '#333333',
                      cursor: 'pointer', fontWeight: '800', fontSize: '1.1rem', transition: 'all 0.2s'
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. BirthDate */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>생년월일</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="text" placeholder="ex. 1994-05-30" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} />
            </div>

            {/* 5. Phone */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>연락처</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="tel" placeholder="ex. 010-0000-0000" value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>

            {/* Agreements */}
            <div style={{ marginTop: '12px', padding: '20px', background: '#F9F9F9', borderRadius: '16px' }}>
              <button onClick={toggleAll} style={{
                display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px', padding: 0
              }}>
                {isAllAgreed ? <CheckSquare color="#FF6F61" fill="rgba(255,111,97,0.2)" size={20}/> : <Square color="#999" size={20}/>}
                <span style={{ fontWeight: '800', fontStyle: 'normal', fontSize: '0.9rem', color: isAllAgreed ? '#FF6F61' : '#333' }}>전체 필수 약관 동의</span>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'terms', label: '서비스 이용약관 동의 (필수)' },
                  { key: 'privacy', label: '개인정보 수집 및 이용 동의 (필수)' },
                  { key: 'thirdParty', label: '개인정보 제3자 제공 동의 (필수)' },
                  { key: 'photoConsent', label: '마케팅 활용 모자이크 촬영 동의 (필수)' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    onClick={() => setAgreements(a => ({ ...a, [key]: !a[key as keyof typeof agreements] }))}>
                    {agreements[key as keyof typeof agreements] ? <CheckCircle color="#FF6F61" size={16} fill="rgba(255,111,97,0.1)" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.2px solid #ccc' }} />}
                    <span style={{ fontSize: '0.8rem', color: '#777', fontWeight: '500' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              className={isValid ? "kl-btn-primary" : "kl-btn-disabled"}
              style={{ 
                width: '100%', padding: '20px', borderRadius: '100px', fontSize: '1.1rem', fontWeight: '900', 
                boxShadow: isValid ? '0 10px 20px rgba(255,111,97,0.2)' : 'none', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                opacity: isValid ? 1 : 0.5,
                background: isValid ? '#FF6F61' : '#ccc',
                color: '#fff',
                border: 'none',
                cursor: isValid ? 'pointer' : 'not-allowed'
              }} 
              onClick={handleSubmit} 
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? '가입 정보 저장 중...' : <>가입 완료하기 <ArrowRight size={20} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
