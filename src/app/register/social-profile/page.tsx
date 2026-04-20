'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, CheckCircle, CheckSquare, Square, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export default function SocialProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    thirdParty: false,
    location: false,
  });

  const isAllAgreed = Object.values(agreements).every(Boolean);

  const [form, setForm] = useState({
    name: '',
    gender: '',
    phone: '',
    birthDate: '',
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        toast.error('로그인이 필요합니다.');
        router.replace('/login');
        return;
      }
      
      // If user already registered, skip this page
      const userSnap = await getDoc(doc(db, 'users', u.uid));
      if (userSnap.exists()) {
        router.replace('/');
        return;
      }

      setUser(u);
      setForm(prev => ({ ...prev, name: u.displayName || '' }));
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
    let formattedValue = value;
    if (key === 'phone') formattedValue = formatPhone(value);
    if (key === 'birthDate') formattedValue = formatBirthDate(value);
    setForm(f => ({ ...f, [key]: formattedValue }));
  };

  const toggleAll = () => {
    const nextVal = !isAllAgreed;
    setAgreements({ terms: nextVal, privacy: nextVal, thirdParty: nextVal, location: nextVal });
  };

  const handleSubmit = async () => {
    if (!isAllAgreed) return toast.error('모든 필수 약관에 동의해 주세요.');
    if (!form.gender) return toast.error('성별을 선택해 주세요.');
    if (!form.name) return toast.error('실명을 입력해 주세요.');
    if (!form.birthDate) return toast.error('생년월일을 입력해 주세요.');
    if (!form.phone) return toast.error('연락처를 입력해 주세요.');
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Auto-generate username from email or UID part
      const emailPrefix = user.email?.split('@')[0] || '';
      const sanitizedPrefix = emailPrefix.replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = user.uid.slice(0, 4);
      const generatedUsername = sanitizedPrefix ? `${sanitizedPrefix}_${uniqueSuffix}` : `user_${uniqueSuffix}_${Date.now().toString().slice(-4)}`;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: generatedUsername,
        email: user.email,
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
      toast.error('저장 중 오류가 발생했습니다: ' + err.message);
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
              <span style={{ color: '#FF6F61', fontWeight: '800' }}>{user?.displayName || '회원'}</span>({user?.email})님,<br />
              원활한 매칭을 위해 필수 정보를 입력해 주세요.
            </p>
          </div>

          <div style={{ height: '1px', background: '#f0f0f0', margin: '32px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Gender */}
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

            {/* Name */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>이름 (실명)</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} placeholder="실명을 입력해 주세요" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>

            {/* BirthDate */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>생년월일</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="text" placeholder="ex. 1995-05-18" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} />
            </div>

            {/* Phone */}
            <div>
              <label className="kl-label" style={{ fontWeight: '800', marginBottom: '10px' }}>연락처</label>
              <input className="kl-input" style={{ borderRadius: '12px', height: '54px' }} type="tel" placeholder="ex. 010-1234-5678" value={form.phone} onChange={e => update('phone', e.target.value)} />
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
              className="kl-btn-primary" 
              style={{ width: '100%', padding: '20px', borderRadius: '100px', fontSize: '1.1rem', fontWeight: '900', boxShadow: '0 10px 20px rgba(255,111,97,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} 
              onClick={handleSubmit} 
              disabled={isSubmitting}
            >
              {isSubmitting ? '가입 정보 저장 중...' : <>가입 완료하기 <ArrowRight size={20} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
