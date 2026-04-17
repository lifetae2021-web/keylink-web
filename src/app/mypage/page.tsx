'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  User as UserIcon, Mail, LogOut, ArrowLeft, Heart, Smartphone,
  Camera, Check, X, Calendar, MapPin, Briefcase, Star, Coffee,
  Cigarette, Wine, BookOpen, Edit3, ChevronLeft, ChevronRight, Image
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const EMPTY_LABEL = '미입력';

// Reusable info row
function InfoRow({ icon, label, value, isEditing, editNode }: { icon: React.ReactNode, label: string, value: string, isEditing?: boolean, editNode?: React.ReactNode }) {
  const isEmpty = !value;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '4px' }}>{label}</p>
        {isEditing && editNode ? editNode : (
          <p style={{ fontSize: '1rem', color: isEmpty ? '#ccc' : '#333', fontWeight: isEmpty ? '400' : '700', fontStyle: isEmpty ? 'italic' : 'normal' }}>
            {isEmpty ? EMPTY_LABEL : value}
          </p>
        )}
      </div>
    </div>
  );
}

// Section card header
function SectionCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '28px', boxShadow: '0 4px 20px rgba(255,111,97,0.05)', border: '1px solid rgba(255,219,233,0.4)' }}>
      <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#FF6F61', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #FFF0EE' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {children}
      </div>
    </div>
  );
}

// Tag chip
function TagChip({ label, color = '#FF6F61' }: { label: string, color?: string }) {
  return (
    <span style={{ padding: '5px 14px', borderRadius: '100px', background: `${color}15`, color, fontWeight: '700', fontSize: '0.82rem', border: `1px solid ${color}30` }}>
      {label}
    </span>
  );
}

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    name: '', phone: '', birthDate: '', height: '', weight: '',
    residence: '', workplace: '', idealType: '', nonIdealType: '',
    smoking: '', drinking: '', religion: '', etc: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Photo gallery state
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      setUser(currentUser);
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setEditForm({
            name: data.name || '', phone: data.phone || '', birthDate: data.birthDate || '',
            height: data.height || '', weight: data.weight || '', residence: data.residence || '',
            workplace: data.workplace || '', idealType: data.idealType || '',
            nonIdealType: data.nonIdealType || '', smoking: data.smoking || '',
            drinking: data.drinking || '', religion: data.religion || '', etc: data.etc || '',
          });
          // Load saved gallery photos from Firestore if any
          if (data.galleryPhotos) setGalleryPhotos(data.galleryPhotos);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
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

  const handleEditChange = (key: string, value: string) => {
    let v = value;
    if (key === 'phone') v = formatPhone(value);
    if (key === 'birthDate') v = formatBirthDate(value);
    setEditForm((prev: any) => ({ ...prev, [key]: v }));
  };

  const handleSave = async () => {
    if (!editForm.name) return toast.error('이름을 입력해주세요.');
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user!.uid);
      await updateDoc(userRef, { ...editForm, updatedAt: new Date() });
      setUserData((prev: any) => ({ ...prev, ...editForm }));
      setIsEditing(false);
      toast.success('프로필 정보가 수정되었습니다.');
    } catch (error) {
      toast.error('정보 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (galleryPhotos.length >= 5) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setGalleryPhotos(prev => {
          const updated = [...prev, url].slice(0, 5);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const editInputStyle = { padding: '10px 14px', fontSize: '1rem', fontWeight: '600', borderRadius: '12px', height: 'auto', border: '1.5px solid #FFDBE9', background: '#FFFAFA' };
  const editTextAreaStyle = { ...editInputStyle, resize: 'vertical' as const, minHeight: '80px' };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFAF9' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid #FFDBE9', borderTop: '3px solid #FF6F61', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
        <p style={{ color: '#FF6F61', fontWeight: '700', fontSize: '1.1rem' }}>정보를 불러오는 중...</p>
        <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #FFF5F4 0%, #FFFFFF 60%)', padding: '100px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: '640px', width: '100%' }}>

        {/* Back */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', textDecoration: 'none', marginBottom: '28px', fontSize: '0.9rem', fontWeight: '600' }}>
          <ArrowLeft size={18} /> 홈으로 돌아가기
        </Link>

        {/* === HERO CARD === */}
        <div style={{ background: '#FFFFFF', borderRadius: '32px', padding: '48px 32px 40px', boxShadow: '0 16px 60px rgba(255,111,97,0.07)', border: '1px solid rgba(255,219,233,0.5)', position: 'relative', marginBottom: '20px' }}>
          <div style={{ position: 'absolute', top: '24px', right: '24px', width: '40px', height: '40px', borderRadius: '12px', background: '#FFF5F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={20} color="#FF6F61" fill="#FF6F61" />
          </div>

          {/* Profile Image */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
            <div style={{ width: '140px', height: '140px', borderRadius: '28px', background: '#FDFDFD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1.5px dashed #FFDBE9', marginBottom: '20px', cursor: 'pointer' }}
              onClick={() => photoInputRef.current?.click()}>
              <Camera size={28} color="#FFDBE9" />
              <span style={{ fontSize: '0.72rem', color: '#FFDBE9', fontWeight: '700', textAlign: 'center', lineHeight: 1.4 }}>이미지를<br/>첨부해주세요</span>
            </div>

            {isEditing ? (
              <input type="text" className="kl-input" style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '900', ...editInputStyle, width: '200px' }} value={editForm.name} onChange={e => handleEditChange('name', e.target.value)} placeholder="이름 입력" />
            ) : (
              <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '8px' }}>{userData?.name || '사용자'} 님</h1>
            )}
            <div style={{ padding: '6px 18px', background: '#FFF5F4', color: '#FF6F61', borderRadius: '100px', fontSize: '0.83rem', fontWeight: '800', marginTop: '10px' }}>
              {userData?.gender === 'male' ? 'PREMIUM GENTLEMAN' : 'PREMIUM LADY'}
            </div>
          </div>

          {/* Basic Info */}
          <SectionCard title="기본 정보">
            <InfoRow icon={<UserIcon size={20} color="#FF6F61" />} label="아이디" value={userData?.username || ''} />
            <InfoRow icon={<Mail size={20} color="#FF6F61" />} label="이메일" value={userData?.email || user?.email || ''} />
            <InfoRow
              icon={<Calendar size={20} color="#FF6F61" />} label="생년월일"
              value={userData?.birthDate || ''}
              isEditing={isEditing}
              editNode={<input type="text" className="kl-input" style={editInputStyle} value={editForm.birthDate} onChange={e => handleEditChange('birthDate', e.target.value)} placeholder="YYYY-MM-DD" />}
            />
            <InfoRow
              icon={<Smartphone size={20} color="#FF6F61" />} label="연락처"
              value={userData?.phone || ''}
              isEditing={isEditing}
              editNode={<input type="tel" className="kl-input" style={editInputStyle} value={editForm.phone} onChange={e => handleEditChange('phone', e.target.value)} placeholder="010-0000-0000" />}
            />
          </SectionCard>
        </div>

        {/* === SECTION 1: 신체 및 거주 === */}
        <div style={{ marginBottom: '20px' }}>
          <SectionCard title="📏 신체 및 거주 정보">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '4px' }}>키 (cm)</p>
                {isEditing ? (
                  <input type="text" className="kl-input" style={editInputStyle} value={editForm.height} onChange={e => handleEditChange('height', e.target.value)} placeholder="ex. 170" />
                ) : (
                  <p style={{ fontSize: '1rem', color: editForm.height ? '#333' : '#ccc', fontWeight: '700' }}>{userData?.height ? `${userData.height} cm` : EMPTY_LABEL}</p>
                )}
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '4px' }}>체중 (kg) <span style={{ color: '#FFDBE9', fontSize: '0.7rem' }}>비공개</span></p>
                {isEditing ? (
                  <input type="text" className="kl-input" style={editInputStyle} value={editForm.weight} onChange={e => handleEditChange('weight', e.target.value)} placeholder="ex. 55" />
                ) : (
                  <p style={{ fontSize: '1rem', color: userData?.weight ? '#333' : '#ccc', fontWeight: '700' }}>{userData?.weight ? `${userData.weight} kg` : EMPTY_LABEL}</p>
                )}
              </div>
            </div>
            <InfoRow
              icon={<MapPin size={20} color="#FF6F61" />} label="거주 지역"
              value={userData?.residence || ''}
              isEditing={isEditing}
              editNode={<input type="text" className="kl-input" style={editInputStyle} value={editForm.residence} onChange={e => handleEditChange('residence', e.target.value)} placeholder="ex. 부산 수영구" />}
            />
          </SectionCard>
        </div>

        {/* === SECTION 2: 직장 및 신원 === */}
        <div style={{ marginBottom: '20px' }}>
          <SectionCard title="💼 직장 및 신원">
            <InfoRow
              icon={<Briefcase size={20} color="#FF6F61" />} label="회사명 / 직무"
              value={userData?.workplace || ''}
              isEditing={isEditing}
              editNode={<textarea className="kl-input" style={editTextAreaStyle} value={editForm.workplace} onChange={e => handleEditChange('workplace', e.target.value)} placeholder="ex. 수액병원, 간호사" rows={2} />}
            />
          </SectionCard>
        </div>

        {/* === SECTION 3: 이상형 === */}
        <div style={{ marginBottom: '20px' }}>
          <SectionCard title="💕 나의 성향과 이상형">
            <div>
              <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '8px' }}>이상형 (중요도 순 최대 5가지)</p>
              {isEditing ? (
                <textarea className="kl-input" style={editTextAreaStyle} value={editForm.idealType} onChange={e => handleEditChange('idealType', e.target.value)} placeholder={'1. 다정한 사람\n2. 운동을 즐기는 사람'} rows={4} />
              ) : userData?.idealType ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {userData.idealType.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <TagChip key={i} label={line.trim()} color="#FF6F61" />
                  ))}
                </div>
              ) : (
                <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: '0.9rem' }}>{EMPTY_LABEL}</p>
              )}
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '8px' }}>비선호형 (중요도 순 최대 5가지)</p>
              {isEditing ? (
                <textarea className="kl-input" style={editTextAreaStyle} value={editForm.nonIdealType} onChange={e => handleEditChange('nonIdealType', e.target.value)} placeholder={'1. 연락이 너무 안 되는 사람\n2. 예의가 없는 사람'} rows={4} />
              ) : userData?.nonIdealType ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {userData.nonIdealType.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <TagChip key={i} label={line.trim()} color="#A98FD5" />
                  ))}
                </div>
              ) : (
                <p style={{ color: '#ccc', fontStyle: 'italic', fontSize: '0.9rem' }}>{EMPTY_LABEL}</p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* === SECTION 4: 생활 습관 === */}
        <div style={{ marginBottom: '20px' }}>
          <SectionCard title="🌿 생활 습관">
            {[
              { key: 'smoking', label: '흡연', icon: <Cigarette size={20} color="#FF6F61" />, options: ['비흡연', '전자담배', '연초'] },
              { key: 'drinking', label: '음주', icon: <Wine size={20} color="#FF6F61" />, options: ['안 마심', '가끔 (월 1~2회)', '즐겨 마시는 편'] },
              { key: 'religion', label: '종교', icon: <BookOpen size={20} color="#FF6F61" />, options: ['무교', '기독교', '천주교', '불교', '기타'] },
            ].map(({ key, label, icon, options }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F8F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '8px' }}>{label}</p>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {options.map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="radio" style={{ accentColor: '#FF6F61' }} checked={editForm[key] === opt} onChange={() => setEditForm((p: any) => ({ ...p, [key]: opt }))} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '1rem', color: userData?.[key] ? '#333' : '#ccc', fontWeight: '700', fontStyle: !userData?.[key] ? 'italic' : 'normal' }}>
                      {userData?.[key] || EMPTY_LABEL}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div>
              <p style={{ fontSize: '0.75rem', color: '#999', fontWeight: '600', marginBottom: '8px' }}>특이사항 / 키링크에게 바라는 점</p>
              {isEditing ? (
                <textarea className="kl-input" style={editTextAreaStyle} value={editForm.etc} onChange={e => handleEditChange('etc', e.target.value)} placeholder="자유롭게 기재해주세요" rows={3} />
              ) : (
                <p style={{ fontSize: '0.95rem', color: userData?.etc ? '#333' : '#ccc', fontWeight: '500', fontStyle: !userData?.etc ? 'italic' : 'normal', lineHeight: 1.7 }}>
                  {userData?.etc || EMPTY_LABEL}
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* === SECTION 5: 사진 갤러리 === */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '28px', boxShadow: '0 4px 20px rgba(255,111,97,0.05)', border: '1px solid rgba(255,219,233,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #FFF0EE' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#FF6F61', letterSpacing: '0.08em', textTransform: 'uppercase' }}>📷 나의 사진</h3>
              {galleryPhotos.length < 5 && (
                <button onClick={() => photoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFF5F4', border: 'none', borderRadius: '100px', padding: '6px 14px', color: '#FF6F61', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <Camera size={14} /> 사진 추가 ({galleryPhotos.length}/5)
                </button>
              )}
            </div>

            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />

            {galleryPhotos.length === 0 ? (
              <div onClick={() => photoInputRef.current?.click()} style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', border: '1.5px dashed #FFDBE9', borderRadius: '18px', cursor: 'pointer', background: '#FFFAF9' }}>
                <Image size={36} color="#FFDBE9" />
                <p style={{ color: '#ccc', fontWeight: '600', fontSize: '0.9rem' }}>사진을 업로드해주세요 (최대 5장)</p>
              </div>
            ) : (
              <div>
                {/* Main viewer */}
                <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', marginBottom: '12px', background: '#f5f5f5', aspectRatio: '4/3' }}>
                  <img src={galleryPhotos[galleryIndex]} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {galleryPhotos.length > 1 && (
                    <>
                      <button onClick={() => setGalleryIndex(i => (i - 1 + galleryPhotos.length) % galleryPhotos.length)} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronLeft size={20} color="#333" />
                      </button>
                      <button onClick={() => setGalleryIndex(i => (i + 1) % galleryPhotos.length)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronRight size={20} color="#333" />
                      </button>
                    </>
                  )}
                  <button onClick={() => { const filtered = galleryPhotos.filter((_, i) => i !== galleryIndex); setGalleryPhotos(filtered); setGalleryIndex(Math.min(galleryIndex, filtered.length - 1)); }} style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={14} color="#fff" />
                  </button>
                  <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                    {galleryPhotos.map((_, i) => (
                      <button key={i} onClick={() => setGalleryIndex(i)} style={{ width: i === galleryIndex ? '20px' : '8px', height: '8px', borderRadius: '100px', background: i === galleryIndex ? '#FF6F61' : 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
                    ))}
                  </div>
                </div>
                {/* Thumbnail strip */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  {galleryPhotos.map((src, i) => (
                    <div key={i} onClick={() => setGalleryIndex(i)} style={{ width: '60px', height: '60px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: i === galleryIndex ? '2px solid #FF6F61' : '2px solid transparent', opacity: i === galleryIndex ? 1 : 0.6, transition: 'all 0.2s' }}>
                      <img src={src} alt={`photo-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === ACTION BUTTONS === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setIsEditing(false); setEditForm({ name: userData?.name || '', phone: userData?.phone || '', birthDate: userData?.birthDate || '', height: userData?.height || '', weight: userData?.weight || '', residence: userData?.residence || '', workplace: userData?.workplace || '', idealType: userData?.idealType || '', nonIdealType: userData?.nonIdealType || '', smoking: userData?.smoking || '', drinking: userData?.drinking || '', religion: userData?.religion || '', etc: userData?.etc || '' }); }} className="kl-btn-outline" disabled={isSaving} style={{ flex: 1, padding: '18px', borderRadius: '100px', fontWeight: '700', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <X size={18} /> 취소
              </button>
              <button onClick={handleSave} className="kl-btn-primary" disabled={isSaving} style={{ flex: 1.5, padding: '18px', borderRadius: '100px', fontWeight: '800', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                {isSaving ? '저장 중...' : <><Check size={18} /> 저장하기</>}
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="kl-btn-primary" style={{ width: '100%', padding: '18px', borderRadius: '100px', fontWeight: '800', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} /> 프로필 수정하기
              </button>
              <button onClick={async () => { await auth.signOut(); router.push('/'); }} className="kl-btn-outline" style={{ width: '100%', padding: '18px', borderRadius: '100px', fontWeight: '700', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                로그아웃 <LogOut size={18} />
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '32px', color: '#CCC', fontSize: '0.8rem' }}>
          매칭을 위한 소중한 개인정보는 최고 수준의 보안으로 보호됩니다.
        </p>
      </div>
    </div>
  );
}
