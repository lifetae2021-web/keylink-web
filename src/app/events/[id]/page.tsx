'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, MapPin, Users, ArrowLeft, AlertCircle,
  CheckCircle, Clock, Shield, Camera, X, CreditCard, ChevronRight, Upload, ShieldCheck
} from 'lucide-react';
import { getSession } from '@/lib/firestore/sessions';
import { Session } from '@/lib/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { auth, db, storage } from '@/lib/firebase';
import { compressImage } from '@/lib/utils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteField, addDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      if (!id || typeof id !== 'string') return;
      try {
        const data = await getSession(id);
        setEvent(data);
      } catch (e) {
        console.error("Error fetching session:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
  }, [id]);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleAccepted, setRuleAccepted] = useState(false);
  
  // 0: 상세페이지, 1: 신청 폼, 2: 결제 대기(모의)
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 얼리버드 카운트다운 타이머 (가상)
  const [timeLeft, setTimeLeft] = useState(3600 * 5 + 1200); // 5h 20m

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [form, setForm] = useState({
    name: '', gender: '', phone: '', // From Firebase
    instaId: '', birthDate: '', height: '', weight: '', residence: '',
    jobRole: '', workplace: '', avoidAcquaintance: '',
    idealType: '', nonIdealType: '',
    smoking: '', drinking: '', religion: '',
    drink: '', etc: '',
    agreeTerms: true, agreeRule: true, // Auto-checked on load
    maleOption: 'normal', // 'normal' | 'safe'
    verificationUrl: '',
  });

  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<string>('');
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // Photo upload state: up to 5 photos (consolidated v3.5.3)
  const [photos, setPhotos] = useState<any[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Firebase 사용자 인증 및 정보 불러오기
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Firestore에서 유저 데이터 가져오기
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setForm(prev => {
            return { ...prev, ...data };
          });
          
          // Consolidation migration for application form (v3.5.3)
          const savedPhotos = data.photos || data.profilePhotos || [];
          const legacyFace = data.facePhotos || [];
          const legacyBody = data.bodyPhotos || [];
          const merged = savedPhotos.length > 0 ? savedPhotos : [...legacyFace, ...legacyBody].slice(0, 5);
          setPhotos(merged);

          // v7.8.0: 재직 증명 미리보기 설정
          setVerificationPreview(data.verificationUrl || '');
          
          toast.success('기존 프로필 정보를 불러왔습니다. 수정이 필요한 부분만 고쳐주세요.', {
            icon: 'ℹ️',
            duration: 4000,
          });
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // LocalStorage 연동
  useEffect(() => {
    const saved = localStorage.getItem(`keylink_form_${id}`);
    if (saved) {
      try {
        setForm(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch(e) {}
    }
  }, [id]);

  useEffect(() => {
    localStorage.setItem(`keylink_form_${id}`, JSON.stringify(form));
  }, [form, id]);

  if (isLoading) {
    return (
      <div style={{ paddingTop: '120px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>기수 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ paddingTop: '120px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', marginBottom: '16px' }}>😢</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>행사를 찾을 수 없거나 이미 마감되었습니다.</p>
          <Link href="/events" className="kl-btn-primary" style={{ marginTop: '24px', display: 'inline-flex' }}>다른 일정 보기</Link>
        </div>
      </div>
    );
  }

  const soldOutM = event.currentMale >= event.maxMale;
  const soldOutF = event.currentFemale >= event.maxFemale;

  // 성별 및 옵션 기반 가격 로직
  let displayBasePrice = form.gender === 'female' ? 40000 : (form.maleOption === 'safe' ? 60000 : 49000);
  let finalPrice = form.gender === 'female' ? 29000 : displayBasePrice;
  let isDiscounted = form.gender === 'female';

  const handleStep1Entry = () => {
    if (!currentUser) {
      toast.error('로그인 후 신청이 가능합니다.');
      router.push('/login');
      return;
    }
    setStep(1);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreeTerms || !form.agreeRule) {
      toast.error('약관 및 운영 규정에 동의해주세요.');
      return;
    }
    
    const requiredFields = [
      { key: 'birthDate', name: '생년월일' },
      { key: 'height', name: '키' },
      { key: 'weight', name: '체중' },
      { key: 'workplace', name: '회사명 / 직무' },
      { key: 'phone', name: '연락처' },
      { key: 'residence', name: '거주 지역' },
      { key: 'smoking', name: '흡연 유무' },
      { key: 'drinking', name: '음주 빈도' },
      { key: 'religion', name: '종교' },
    ];
    
    for (const field of requiredFields) {
      if (!form[field.key as keyof typeof form]) {
        toast.error(`${field.name} 항목을 입력해주세요.`);
        return;
      }
    }

    if (photos.length === 0) {
      toast.error('본인 사진을 최소 1장 이상 업로드해주세요.');
      return;
    }

    if (!verificationFile && !form.verificationUrl) {
      toast.error('재직 증명 서류를 업로드해 주세요.');
      return;
    }

    if (!currentUser) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. 주의: 이 기수에 이미 신청한 경우 충돌 방지
      const sessionId = typeof id === 'string' ? id : '';
      const existingQ = query(
        collection(db, 'applications'),
        where('userId', '==', currentUser.uid),
        where('sessionId', '==', sessionId)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        toast.error('이미 이 기수에 신청하셨습니다.');
        setIsSubmitting(false);
        return;
      }

      // 2. 사진 업로드
      const uploadedUrls = await Promise.all(
        photos.map(async (photo, index) => {
          if (typeof photo === 'string' && photo.startsWith('data:')) {
            const photoRef = ref(storage, `profile_images/${currentUser.uid}/event_${id}_${Date.now()}_${index}.jpg`);
            await uploadString(photoRef, photo, 'data_url');
            return await getDownloadURL(photoRef);
          }
          return photo;
        })
      );

      // v7.8.0: 재직 증명 서류 업로드
      let finalVerificationUrl = form.verificationUrl;
      if (verificationFile) {
        const fileExt = verificationFile.name.split('.').pop();
        const verifyRef = ref(storage, `verification_proofs/${currentUser.uid}/${Date.now()}.${fileExt}`);
        await uploadString(verifyRef, verificationPreview, 'data_url');
        finalVerificationUrl = await getDownloadURL(verifyRef);
      }

      // 3. users 콜렉션 업데이트 (프로필 동기화)
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        name: form.name,
        gender: form.gender,
        phone: form.phone,
        birthDate: form.birthDate,
        height: form.height,
        weight: form.weight,
        residence: form.residence,
        workplace: form.workplace,
        jobRole: form.jobRole,
        instaId: form.instaId,
        idealType: form.idealType,
        nonIdealType: form.nonIdealType,
        smoking: form.smoking,
        drinking: form.drinking,
        religion: form.religion,
        photos: uploadedUrls,
        verificationUrl: finalVerificationUrl,
        profilePhotos: deleteField(),
        facePhotos: deleteField(),
        bodyPhotos: deleteField(),
      }, { merge: true });

      // 4. applications 콜렉션에 신규 신청서 저장 (v5.0.0 핵심 연결)
      const now = Timestamp.now();
      const birthYear = form.birthDate
        ? (() => {
            if (form.birthDate.includes('-')) return parseInt(form.birthDate.slice(0, 4));
            const yy = parseInt(form.birthDate.slice(0, 2));
            return yy > 30 ? 1900 + yy : 2000 + yy;
          })()
        : new Date().getFullYear();
      const age = new Date().getFullYear() - birthYear;

      await addDoc(collection(db, 'applications'), {
        userId: currentUser.uid,
        sessionId,
        name: form.name || '',
        age,
        gender: form.gender || '',
        job: form.workplace || '',
        residence: form.residence || '',
        phone: form.phone || '',
        status: 'applied',
        paymentConfirmed: false,
        appliedAt: now,
        updatedAt: now,
        // v5.1.0 추가 필드 통합 (관리자/매칭용 스냅샷)
        price: finalPrice,
        maleOption: form.gender === 'male' ? form.maleOption : null,
        instaId: form.instaId || '',
        smoking: form.smoking || '',
        drinking: form.drinking || '',
        religion: form.religion || '',
        drink: form.drink || '',
        idealType: form.idealType || '',
        nonIdealType: form.nonIdealType || '',
        avoidAcquaintance: form.avoidAcquaintance || '',
        etc: form.etc || '',
      });

      toast.success('신청서가 접수되었습니다. 검토 후 연락드리겠습니다.');
      localStorage.removeItem(`keylink_form_${id}`);
      setStep(2);
    } catch (err: any) {
      console.error('Submission Error:', err);
      let msg = '신청 중 오류가 발생했습니다.';
      if (err.code === 'storage/unauthorized') msg = '사진 업로드 권한이 없습니다.';
      else if (err.message) msg = `오류: ${err.message}`;
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    if (photos.length + files.length > 5) {
      toast.error('사진은 최대 5장까지만 등록 가능합니다.');
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const rawUrl = ev.target?.result as string;
        const compressedUrl = await compressImage(rawUrl);
        setPhotos(prev => [...prev, compressedUrl].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handlePayment = async () => {
    /* 결제 기능은 운영 방침에 따라 일시적으로 비활성화되었습니다.
    setIsSubmitting(true);
    // 모의 결제 연동
    await new Promise((r) => setTimeout(r, 2000));
    setIsSubmitting(false);
    toast.success('🎉 예약 및 결제가 완료되었습니다! 마이페이지에서 확인하세요.');
    router.push('/mypage');
    */
  };



  return (
    <div style={{ paddingTop: '90px', minHeight: '100vh', paddingBottom: '100px' }}>
      {/* 영구제명 규정 팝업 */}
      {showRuleModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(200,106,106,0.4)',
            borderRadius: 'var(--radius-xl)',
            padding: '40px 32px',
            maxWidth: '480px', width: '100%',
            position: 'relative',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(200,106,106,0.15)', border: '1px solid rgba(200,106,106,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <AlertCircle size={28} color="#C86A6A" />
            </div>
            <h2 style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: '800', color: '#C86A6A', marginBottom: '8px' }}>
              ⚠️ 중요 운영 규정
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '24px' }}>반드시 확인 후 동의해주세요</p>

            <div style={{
              background: 'rgba(200,106,106,0.08)', border: '1px solid rgba(200,106,106,0.2)',
              borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '24px',
            }}>
              {[
                '행사에서 얻은 개인정보 무단 공유 불가',
                '매칭 결과와 무관하게 상대방에게 불쾌감을 주는 접근 금지',
                '허위 정보(나이, 직업, 결혼 여부) 신청 금지',
              ].map((rule, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: i < 3 ? '12px' : 0 }}>
                  <span style={{ color: '#C86A6A', fontWeight: '700', flexShrink: 0 }}>{i + 1}.</span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{rule}</p>
                </div>
              ))}
            </div>
            <button
              className="kl-btn-primary"
              style={{ width: '100%' }}
              onClick={() => { setRuleAccepted(true); setShowRuleModal(false); setForm(f => ({ ...f, agreeRule: true })); }}
            >
              확인하고 동의합니다
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
        <Link href="/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: '32px', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> 일정 목록으로
        </Link>

        {/* 4단계 프로세스 진행 바 (상세페이지 아닐 때 표출) */}
        {step > 0 && (
            <div style={{ 
                marginBottom: '32px', background: 'var(--gradient-card)', border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-lg)', padding: '24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative'
            }}>
                {/* 배경 라인 */}
                <div style={{ position: 'absolute', top: '50%', left: '40px', right: '40px', height: '2px', background: 'var(--color-surface-2)', zIndex: 0 }} />
                
                {[
                    { state: 1, label: '신청서 작성' },
                    { state: 2, label: '결제/승인' },
                    { state: 3, label: '최종 확정' }
                ].map((s, i) => (
                    <div key={s.state} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--color-surface-1)', padding: '0 10px' }}>
                        <div style={{ 
                            width: '36px', height: '36px', borderRadius: '50%', 
                            background: step >= s.state ? '#FF6F61' : 'var(--color-surface-2)',
                            color: step >= s.state ? '#fff' : 'var(--color-text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700',
                            border: step >= s.state ? 'none' : '2px solid var(--color-border)',
                            transition: 'all 0.3s'
                        }}>
                            {step > s.state ? <CheckCircle size={20} color="#fff" /> : s.state}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: step >= s.state ? '700' : '500', color: step >= s.state ? '#111' : 'var(--color-text-muted)' }}>{s.label}</span>
                    </div>
                ))}
            </div>
        )}

        <div 
          className="event-detail-grid"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: step === 2 ? '1fr' : '1fr 400px', 
            gap: '32px',
            maxWidth: step === 2 ? '600px' : '1100px',
            margin: '0 auto'
          }}
        >
          {/* Left Column: Event Details, Form, or Success */}
          <div className="left-column">
            {step === 0 && (
              <>
                {/* Hero card */}
                <div style={{
                  height: '260px',
                  background: event.region === 'busan'
                    ? 'linear-gradient(135deg, #FFF0F5, #FFE4E1)'
                    : 'linear-gradient(135deg, #F8F8FF, #F0F0FF)',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '28px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ textAlign: 'center', position: 'relative' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.1em', color: event.region === 'busan' ? '#FF6F61' : '#A98FD5', textTransform: 'uppercase', marginBottom: '12px' }}>
                      {event.region === 'busan' ? 'BUSAN' : 'CHANGWON'}
                    </p>
                    <p style={{ fontSize: '4rem', fontWeight: '900', color: '#1A1A1A', lineHeight: 1 }}>
                      {event.episodeNumber}<span style={{ fontSize: '1.5rem' }}>기</span>
                    </p>
                    <p style={{ fontSize: '1rem', color: '#333333', marginTop: '8px' }}>{event.title}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="kl-card" style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '16px', color: '#1A1A1A' }}>행사 안내</h2>
                  <p style={{ color: '#333333', lineHeight: 1.8 }}>
                    {event.region === 'busan' ? '부산' : '창원'} {event.episodeNumber}기 로테이션 소개팅입니다. 매칭을 통해 설레는 첫 만남을 경험해 보세요.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                    {[
                      { Icon: Calendar, label: '일시', value: format(event.eventDate, 'M월 d일 (EEEE) HH:mm', { locale: ko }) },
                      { Icon: MapPin, label: '장소', value: event.location },
                      { Icon: Users, label: '정원', value: `남 ${event.maxMale}명 · 여 ${event.maxFemale}명` },
                      { Icon: Clock, label: '1회 대화', value: '약 15분' },
                    ].map(({ Icon, label, value }) => (
                      <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={16} color="#FF6F61" />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label}</p>
                          <p style={{ fontSize: '0.9rem', color: '#1A1A1A', fontWeight: '700' }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Policies */}
                <div className="kl-card">
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px', color: '#1A1A1A' }}>환불 & 보장 정책 (키링크의 약속)</h2>
                  {[
                    { icon: '💸', title: '중복 만남 100% 환불', desc: '과거 만났던 분과 재회 시 이유 불문 전액 환불', color: '#FF6F61' },
                    { icon: '🛡️', title: '안심 매칭 보장', desc: '남성 안심 패키지 선택 시, 미매칭 30% 환불', color: '#A98FD5' },
                    { icon: '💌', title: '매칭 성공 혜택', desc: '오픈채팅방 즉시 연결', color: '#6EAE7C' },
                    { icon: '⚠️', title: '취소 정책', desc: '결제 후 개인 사유 취소 불가', color: '#C86A6A' },
                  ].map((p) => (
                    <div key={p.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ width: '32px', height: '32px', flexShrink: 0, background: 'var(--color-surface-2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{p.icon}</div>
                      <div>
                        <p style={{ fontWeight: '800', color: p.color, marginBottom: '4px', fontSize: '0.95rem' }}>{p.title}</p>
                        <p style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.5 }}>{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#111' }}>신뢰 기반 상세 신청서</h2>
                  <p style={{ fontSize: '0.9rem', color: '#555' }}>건강한 호감과 신뢰를 위해 정확하게 기입해주세요.</p>
                </div>
                
                <form id="bookingForm" onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="kl-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                      <CheckCircle size={18} color="#6EAE7C" />
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: '#111' }}>연락처 정보</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface-2)', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.95rem' }}><span style={{ color: '#888', marginRight: '12px', fontWeight: '600' }}>이름</span><span style={{ fontWeight: '700' }}>{form.name}</span> <span style={{ fontSize: '0.8rem', color: '#aaa', marginLeft: '4px' }}>({form.gender === 'male' ? '남성' : '여성'})</span></div>
                        <div style={{ fontSize: '0.95rem' }}><span style={{ color: '#888', marginRight: '12px', fontWeight: '600' }}>연락처</span><span style={{ fontWeight: '700' }}>{form.phone}</span></div>
                      </div>
                      <div>
                        <input className="kl-input" placeholder="인스타 계정 입력 (ex. @keylink_official)" value={form.instaId} onChange={(e) => setForm(f => ({...f, instaId: e.target.value}))} />
                        <p style={{ fontSize: '0.8rem', color: '#FF6F61', marginTop: '8px' }}> 번호 오기입이나 카톡 친구 추가 안 될 시 인스타로 연락드림 (선택)</p>
                      </div>
                    </div>
                  </div>

                  <div className="kl-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#111', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>신체 및 거주 정보</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                      <div>
                        <label className="kl-label">생년월일 *</label>
                        <input className="kl-input" placeholder="ex. 940530" value={form.birthDate} onChange={(e) => setForm(f => ({...f, birthDate: e.target.value}))} />
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="kl-label">키 (cm) *</label>
                          <input className="kl-input" required placeholder="ex. 182" value={form.height} onChange={(e) => setForm(f => ({...f, height: e.target.value}))} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="kl-label">체중 (kg) *</label>
                          <input className="kl-input" required placeholder="ex. 75" value={form.weight} onChange={(e) => setForm(f => ({...f, weight: e.target.value}))} />
                          <p style={{ fontSize: '0.75rem', color: '#FF6F61', marginTop: '6px', fontWeight: '600' }}> 체중은 상대에게 공개되지 않습니다</p>
                        </div>
                      </div>
                      <div>
                        <label className="kl-label">거주 지역 *</label>
                        <select className="kl-input" value={form.residence} onChange={(e) => setForm(f => ({...f, residence: e.target.value}))}>
                          <option value="">지역을 선택해주세요</option>
                          {['부산진구', '해운대구', '수영구', '연제구', '동래구', '남구', '금정구', '사하구', '강서구', '북구', '사상구', '기타'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="kl-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#111', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>직장 및 신원</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                      <div>
                        <label className="kl-label">회사명 / 직무 *</label>
                        <textarea
                          className="kl-input"
                          rows={3}
                          placeholder={`ex. 수액병원, 간호사 / 링크은행, 은행원 / 프리랜서, 영상편집 / 개인사업, 네일아트 / 키링초등학교, 초등교사 / 네이버(대기업), 사무직`}
                          value={form.workplace}
                          onChange={(e) => setForm(f => ({...f, workplace: e.target.value}))}
                        />
                        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '6px' }}><i><u>* 같은 직장 동료 만남 방지 목적으로만 사용되며 비공개입니다</u></i></p>
                      </div>
                      <div>
                        <label className="kl-label">겹치고 싶지 않은 지인 (선택)</label>
                        <input className="kl-input" placeholder="이름 또는 연락처를 쉼표로 구분하여 입력" value={form.avoidAcquaintance} onChange={(e) => setForm(f => ({...f, avoidAcquaintance: e.target.value}))} />
                      </div>
                      
                    </div>
                  </div>

                  <div className="kl-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#111', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>나의 성향과 이상형</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                      <div>
                        <label className="kl-label">이상형 (중요도 순 최대 5가지)</label>
                        <textarea className="kl-input" rows={3} placeholder="1. 다정한 person&#10;2. 운동을 즐기는 person" value={form.idealType} onChange={(e) => setForm(f => ({...f, idealType: e.target.value}))} />
                      </div>
                      <div>
                        <label className="kl-label">비선호형 (중요도 순 최대 5가지)</label>
                        <textarea className="kl-input" rows={3} placeholder="1. 연락이 너무 안 되는 person&#10;2. 예의가 없는 person" value={form.nonIdealType} onChange={(e) => setForm(f => ({...f, nonIdealType: e.target.value}))} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {[
                          { key: 'smoking', label: '흡연 유무 *', options: ['비흡연', '전자담배', '연초'] },
                          { key: 'drinking', label: '음주 빈도 *', options: ['안 마심', '가끔 (월 1~2회)', '즐겨 마시는 편'] },
                          { key: 'religion', label: '종교 *', options: ['무교', '기독교', '천주교', '불교', '기타'] }
                        ].map(radioGroup => (
                          <div key={radioGroup.key}>
                            <p className="kl-label" style={{ marginBottom: '10px' }}>{radioGroup.label}</p>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {radioGroup.options.map(opt => (
                                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                  <input type="radio" style={{ accentColor: '#FF6F61' }}
                                    checked={form[radioGroup.key as keyof typeof form] === opt} 
                                    onChange={() => setForm(f => ({ ...f, [radioGroup.key]: opt }))} /> 
                                  {opt}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* v7.8.1 재직 증명 섹션 (최하단 이동) */}
                  <div className="kl-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                      <ShieldCheck size={18} color="#10B981" />
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: '#111' }}>재직 증명 (필수)</span>
                    </div>
                    <div style={{ background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)', borderRadius: '14px', padding: '20px' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                        신뢰할 수 있는 모임을 위해 아래 서류 중 하나를 반드시 업로드해 주세요.<br/>
                        (재직증명서, 급여명세서, 건강보험 자격득실, 사원증, 명함 등)
                      </p>
                      <p style={{ fontSize: '0.82rem', color: '#1A1A1A', fontWeight: '800', marginBottom: '16px' }}>
                        <strong>"업로드하신 모든 서류는 철저히 암호화되어 안전하게 보호됩니다."</strong>
                      </p>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button 
                          type="button"
                          onClick={() => verifyInputRef.current?.click()} 
                          style={{ padding: '10px 20px', borderRadius: '10px', background: '#fff', border: '1.5px solid #CBD5E1', color: '#475569', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Upload size={16} /> 서류 선택
                        </button>
                        {verificationPreview ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '0.82rem', fontWeight: '800' }}>
                            <CheckCircle size={16} /> 업로드 완료
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>선택된 파일 없음</span>
                        )}
                      </div>
                      <input 
                        ref={verifyInputRef} 
                        type="file" 
                        accept="image/*,.pdf" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) return toast.error('파일 크기는 5MB 이하여야 합니다.');
                            setVerificationFile(file);
                            const reader = new FileReader();
                            reader.onload = (ev) => setVerificationPreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </div>
                  </div>

                  <div className="kl-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#111', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>행사 간식 및 본인 인증</h3>
                    <div style={{ marginBottom: '24px' }}>
                      <label className="kl-label">행사 희망 음료 선택</label>
                      <select className="kl-input" value={form.drink} onChange={(e) => setForm(f => ({...f, drink: e.target.value}))}>
                        <option value="">음료를 선택해주세요</option>
                        {['아이스 아메리카노', '복숭아 아이스티', '얼그레이', '페퍼민트', '카라멜 블랙티', '물', '따뜻한 음료'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="kl-label" style={{ marginBottom: '12px' }}>본인 사진 업로드 ({photos.length}/5) *</label>
                      <div style={{ background: '#FFFDFD', border: '1.5px dashed #FFDBE9', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                         <p style={{ fontSize: '0.82rem', color: '#666', lineHeight: 1.6, marginBottom: '20px', fontWeight: '500' }}>
                          과도한 보정이나 마스크 착용 사진은 지양해주세요.<br/>
                          <strong style={{ color: '#FF6F61' }}>얼굴과 전신 사진이 포함되도록 자유롭게 총 5장까지 등록해 주세요.</strong>
                        </p>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                          {photos.map((src, i) => (
                            <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #FFDBE9', boxShadow: '0 4px 12px rgba(255,111,97,0.1)' }}>
                              <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="profile" />
                              <button type="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <X size={12} color="#fff" />
                              </button>
                            </div>
                          ))}
                          
                          {photos.length < 5 && (
                            <button 
                              type="button" 
                              onClick={() => photoInputRef.current?.click()}
                              style={{ width: '80px', height: '80px', borderRadius: '14px', border: '1.5px dashed #FFDBE9', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              <Upload size={20} color="#FFDBE9" />
                              <span style={{ fontSize: '0.75rem', color: '#FFDBE9', fontWeight: '700' }}>추가</span>
                            </button>
                          )}
                        </div>
                        <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" multiple style={{ display: 'none' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.agreeTerms} onChange={(e) => setForm(f => ({ ...f, agreeTerms: e.target.checked }))} style={{ marginTop: '3px' }} />
                      <span style={{ fontSize: '0.85rem' }}>[필수] 이용약관 및 개인정보 수집/활용 동의</span>
                    </label>
                    <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.agreeRule} onChange={(e) => setForm(f => ({ ...f, agreeRule: e.target.checked }))} style={{ marginTop: '3px' }} />
                      <span style={{ fontSize: '0.85rem' }}>[필수] 영구제명 규정 준수 동의</span>
                    </label>
                  </div>
                </form>
              </div>
            )}

            {step === 2 && (
              <div className="kl-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(110,174,124,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <CheckCircle size={32} color="#6EAE7C" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111', marginBottom: '10px' }}>신청서 제출 완료!</h2>
                <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '32px', lineHeight: 1.6 }}>신청서 및 인증 내역 검토하고 매주 월요일부터 순차적으로 연락드립니다.</p>
                <Link href="/mypage" className="kl-btn-primary" style={{ width: '100%', padding: '18px', fontSize: '1.1rem', textAlign: 'center', display: 'block' }}>
                  마이페이지에서 확인하기
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: Sidebar (Sticky) */}
          {step !== 2 && (
            <div style={{ position: 'sticky', top: '90px', alignSelf: 'start' }}>
              <div className="kl-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '20px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: '600' }}>최종 결제 금액</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <p style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1A1A1A' }}>
                      {finalPrice.toLocaleString()}<span style={{ fontSize: '1.2rem', fontWeight: '600', color: '#666', marginLeft: '4px' }}>원</span>
                    </p>
                    {isDiscounted && (
                      <p style={{ fontSize: '1rem', color: '#999', textDecoration: 'line-through' }}>{displayBasePrice.toLocaleString()}원</p>
                    )}
                  </div>
                </div>

                {step === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', marginBottom: '12px' }}>성별 선택</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['male', 'female'].map((g) => (
                          <button
                            key={g}
                            onClick={() => setForm(f => ({ ...f, gender: g as 'male' | 'female' }))}
                            style={{
                              flex: 1, padding: '12px', borderRadius: '10px', 
                              border: form.gender === g ? '2px solid #FF6F61' : '1px solid #ddd',
                              background: form.gender === g ? '#FFF5F4' : '#fff', color: form.gender === g ? '#FF6F61' : '#555',
                              fontWeight: '700', cursor: 'pointer'
                            }}
                          >
                            {g === 'male' ? '남성' : '여성'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.gender === 'male' && (
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#333', marginBottom: '12px' }}>매칭 옵션 선택</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {['normal', 'safe'].map(opt => (
                            <div
                              key={opt}
                              onClick={() => setForm(f => ({ ...f, maleOption: opt }))}
                              style={{
                                padding: '16px', borderRadius: '12px', 
                                border: form.maleOption === opt ? '2px solid #FF6F61' : '1px solid #ddd',
                                background: form.maleOption === opt ? '#FFF5F4' : '#fff', cursor: 'pointer'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{opt === 'normal' ? '일반 매칭' : '안심 매칭 패키지'}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '800' }}>{opt === 'normal' ? '49,000원' : '60,000원'}</span>
                              </div>
                              <p style={{ fontSize: '0.75rem', color: opt === 'normal' ? '#888' : '#FF6F61' }}>{opt === 'normal' ? '매칭 실패 시 환불 없음' : '미매칭 시 30% 환불 보장'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '24px' }}>
                  {step === 0 ? (
                    <button className="kl-btn-primary" style={{ width: '100%', padding: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={handleStep1Entry} disabled={soldOutM && soldOutF}>
                      {soldOutM && soldOutF ? '마감되었습니다' : <>신청서 작성하기 <ChevronRight size={18} /></>}
                    </button>
                  ) : (
                    <>
                      {step === 1 && (
                        <button
                          form="bookingForm"
                          type="submit"
                          className="kl-btn-primary"
                          style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: '800' }}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? '제출 중...' : '신청서 제출 완료'}
                        </button>
                      )}
                      {step > 0 && (
                        <button type="button" onClick={() => setStep(step - 1)} style={{ width: '100%', background: 'none', border: 'none', marginTop: '12px', color: '#888', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>이전으로 돌아가기</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
 {/* 모바일 Sticky Bottom CTA */}
      <div className="mobile-sticky-cta" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', zIndex: 1000, boxShadow: '0 -4px 16px rgba(0,0,0,0.05)' }}>
          {step === 0 && (
            <button className="kl-btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: '800' }} onClick={() => { handleStep1Entry(); window.scrollTo({top: 0}); }} disabled={soldOutM && soldOutF}>
              {soldOutM && soldOutF ? '마감되었습니다' : '지금 신청하기'}
            </button>
          )}
          {step === 1 && (
            <button form="bookingForm" type="submit" className="kl-btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: '800' }} disabled={isSubmitting}>
              {isSubmitting ? '제출 중...' : '신청서 제출하기'}
            </button>
          )}
           {step === 2 && (
            <Link href="/mypage" className="kl-btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: '800', textAlign: 'center', display: 'block' }}>
              마이페이지에서 확인하기
            </Link>
          )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .event-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .mobile-sticky-cta {
            display: block !important;
          }
        }
      `}</style>
      </div>
    </div>
  );
}
