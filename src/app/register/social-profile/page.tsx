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

  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    thirdParty: false,
    location: false,
  });

  const isAllAgreed = Object.values(agreements).every(Boolean);

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
        name: u.displayName || '',
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
    let formattedValue = value;
    if (key === 'phone') formattedValue = formatPhone(value);
    if (key === 'birthDate') formattedValue = formatBirthDate(value);
    setForm(f => ({ ...f, [key]: formattedValue }));
  };

  const toggleAll = () => {
    if (error) setError(null);
    const nextVal = !isAllAgreed;
    setAgreements({ terms: nextVal, privacy: nextVal, thirdParty: nextVal, location: nextVal });
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Sync Email to Auth System
      if (form.email !== user.email) {
        try {
          await updateEmail(user, form.email);
        } catch (authErr: any) {
          const msg = getAuthErrorMessage(authErr.code);
          setError(msg);
          throw new Error(msg); // Localized error
        }
      }

      // 2. Setup Firestore Data
      const emailPrefix = form.email.split('@')[0] || '';
      const sanitizedPrefix = emailPrefix.replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = user.uid.slice(0, 4);
      const generatedUsername = sanitizedPrefix ? `${sanitizedPrefix}_${uniqueSuffix}` : `user_${uniqueSuffix}_${Date.now().toString().slice(-4)}`;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: generatedUsername,
        email: form.email,
        name: form.name,
        gender: form.gender,
        phone: form.phone,
        birthDate: form.birthDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        socialLogin: true,
        photoURL: user.photoURL || null,
      });

      toast.success('프로필 설정이 완료되었습니다!');
      router.push('/');
    } catch (err: any) {
      console.error('Submit Error:', err);
      // Error state is already set if it was an Auth error
      if (!error) setError(getAuthErrorMessage(err.code));
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
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FFF5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Heart size={30} color="#FF6F61" fill="#FF6F61" />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#111', letterSpacing: '-0.02em' }}>반갑습니다!</h1>
            <p style={{ fontSize: '0.95rem', color: '#666', marginTop: '8px', lineHeight: 1.5 }}>
              원활한 매칭을 위해 필수 정보를 입력해 주세요.
            </p>
          </div>

          <div style={{ height: '1px', background: '#f0f0f0', margin: '32px 0' }} />

          {/* Error Message Display */}
          {error && (
            <div style={{ 
              marginBottom: '32px', 
              padding: '16px', 
              background: '#FFF5F4', 
              border: '1px solid #FFEBE9', 
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'shake 0.4s ease-in-out'
            }}>
              <AlertCircle size={20} color="#FF6F61" />
              <p style={{ fontSize: '0.9rem', color: '#FF6F61', fontWeight: '600', lineHeight: 1.4 }}>
                {error}
              </p>
              <style>{`
                @keyframes shake {
                  0%, 100% { transform: translateX(0); }
                  25% { transform: translateX(-4px); }
                  75% { transform: translateX(4px); }
                }
              `}</style>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* 1. Email */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>이메일</label>
              <input 
                className="kl-input" 
                style={{ borderRadius: '12px', height: '54px' }} 
                type="email"
                placeholder="example@gmail.com"
                value={form.email} 
                onChange={e => update('email', e.target.value)} 
              />
              <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '6px', marginLeft: '4px' }}>
                비밀번호 분실 시 찾기 및 주요 공지 수신용으로 사용됩니다.
              </p>
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
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="text" placeholder="예: 19940530" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} />
            </div>

            {/* 5. Phone */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>연락처</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="tel" placeholder="010-1234-5678" value={form.phone} onChange={e => update('phone', e.target.value)} />
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
                  { key: 'location', label: '위치 기반 서비스 약관 동의 (필수)' },
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
