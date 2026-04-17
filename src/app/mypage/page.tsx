'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  LogOut, ArrowLeft, Camera, ChevronDown, ChevronUp, X, Check, Edit3, Package
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const EMPTY = '미입력';

// Calculate age from birthDate string e.g. "1994-05-30" or "940530"
function calcAge(birthDate: string): string {
  if (!birthDate) return '-';
  let year: number;
  if (birthDate.includes('-')) {
    year = parseInt(birthDate.slice(0, 4));
  } else if (birthDate.length >= 6) {
    const yy = parseInt(birthDate.slice(0, 2));
    year = yy > 30 ? 1900 + yy : 2000 + yy;
  } else return '-';
  const age = new Date().getFullYear() - year;
  return `${year}년생 (${age}세)`;
}

// Simple label-value row used in both summary and detail
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const isEmpty = !value;
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #FFF0EE', padding: '14px 0', gap: '12px' }}>
      <span style={{ minWidth: '90px', fontSize: '0.85rem', color: '#AAA', fontWeight: '600', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', color: isEmpty ? '#CCC' : '#222', fontWeight: isEmpty ? '400' : '600', fontStyle: isEmpty ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {isEmpty ? EMPTY : value}
      </span>
    </div>
  );
}

// Editable row shown in edit modal
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', color: '#FF6F61', fontWeight: '700', marginBottom: '6px', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { borderRadius: '10px', border: '1.5px solid #FFDBE9', padding: '10px 14px', fontSize: '0.95rem', fontWeight: '600', width: '100%', boxSizing: 'border-box', background: '#FFFAFA', outline: 'none' };
const textAreaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: '72px' };

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      setUser(currentUser);
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserData(d);
          if (d.galleryPhotos) setGalleryPhotos(d.galleryPhotos);
          setEditForm({
            name: d.name || '', phone: d.phone || '', birthDate: d.birthDate || '',
            height: d.height || '', weight: d.weight || '', residence: d.residence || '',
            workplace: d.workplace || '', idealType: d.idealType || '',
            nonIdealType: d.nonIdealType || '', smoking: d.smoking || '',
            drinking: d.drinking || '', religion: d.religion || '',
            instaId: d.instaId || '', etc: d.etc || '',
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSave = async () => {
    if (!editForm.name) return toast.error('이름은 필수입니다.');
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user!.uid), { ...editForm, updatedAt: new Date() });
      setUserData((p: any) => ({ ...p, ...editForm }));
      setIsEditing(false);
      toast.success('프로필이 수정되었습니다.');
    } catch { toast.error('저장 중 오류가 발생했습니다.'); }
    finally { setIsSaving(false); }
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
      if (galleryPhotos.length >= 5) return;
      const reader = new FileReader();
      reader.onload = ev => setGalleryPhotos(p => [...p, ev.target!.result as string].slice(0,5));
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFAF9' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '3px solid #FFDBE9', borderTop: '3px solid #FF6F61', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
      <p style={{ color: '#FF6F61', fontWeight: '700' }}>정보를 불러오는 중...</p>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const birthYear = userData?.birthDate?.slice(0, 4) || '';
  const genderLabel = userData?.gender === 'male' ? 'M' : userData?.gender === 'female' ? 'F' : '-';
  const physique = userData?.height || userData?.weight
    ? `${userData?.height ? userData.height + 'cm' : '-'} / ${userData?.weight ? userData.weight + 'kg' : '-'}`
    : null;

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9F8', paddingTop: '80px', paddingBottom: '60px' }}>
      {/* Edit Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div style={{ background: '#FFFFFF', borderRadius: '28px', padding: '32px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(255,111,97,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111' }}>프로필 편집</h2>
              <button onClick={() => setIsEditing(false)} style={{ background: '#FFF5F4', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} color="#FF6F61" />
              </button>
            </div>

            <EditRow label="이름 *">
              <input style={inputStyle} value={editForm.name} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="이름 입력" />
            </EditRow>
            <EditRow label="생년월일">
              <input style={inputStyle} value={editForm.birthDate} onChange={e => setEditForm((p: any) => ({ ...p, birthDate: e.target.value }))} placeholder="YYYY-MM-DD" />
            </EditRow>
            <EditRow label="연락처">
              <input style={inputStyle} type="tel" value={editForm.phone} onChange={e => setEditForm((p: any) => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="010-0000-0000" />
            </EditRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <EditRow label="키 (cm)">
                <input style={inputStyle} value={editForm.height} onChange={e => setEditForm((p: any) => ({ ...p, height: e.target.value }))} placeholder="ex. 165" />
              </EditRow>
              <EditRow label="체중 (kg)">
                <input style={inputStyle} value={editForm.weight} onChange={e => setEditForm((p: any) => ({ ...p, weight: e.target.value }))} placeholder="ex. 55" />
              </EditRow>
            </div>
            <EditRow label="거주지">
              <input style={inputStyle} value={editForm.residence} onChange={e => setEditForm((p: any) => ({ ...p, residence: e.target.value }))} placeholder="ex. 부산 수영구" />
            </EditRow>
            <EditRow label="회사명 / 직무">
              <textarea style={textAreaStyle} value={editForm.workplace} onChange={e => setEditForm((p: any) => ({ ...p, workplace: e.target.value }))} placeholder="ex. 수액병원, 간호사" rows={2} />
            </EditRow>
            <EditRow label="음주">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['안 마심', '가끔 (월 1~2회)', '즐겨 마시는 편'].map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 12px', borderRadius: '100px', background: editForm.drinking === opt ? '#FFF5F4' : '#f8f8f8', border: editForm.drinking === opt ? '1.5px solid #FF6F61' : '1.5px solid #eee', color: editForm.drinking === opt ? '#FF6F61' : '#555', fontWeight: '600', transition: 'all 0.15s' }}
                    onClick={() => setEditForm((p: any) => ({ ...p, drinking: opt }))}>
                    {opt}
                  </label>
                ))}
              </div>
            </EditRow>
            <EditRow label="흡연">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['비흡연', '전자담배', '연초'].map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 12px', borderRadius: '100px', background: editForm.smoking === opt ? '#FFF5F4' : '#f8f8f8', border: editForm.smoking === opt ? '1.5px solid #FF6F61' : '1.5px solid #eee', color: editForm.smoking === opt ? '#FF6F61' : '#555', fontWeight: '600', transition: 'all 0.15s' }}
                    onClick={() => setEditForm((p: any) => ({ ...p, smoking: opt }))}>
                    {opt}
                  </label>
                ))}
              </div>
            </EditRow>
            <EditRow label="이상형">
              <textarea style={textAreaStyle} value={editForm.idealType} onChange={e => setEditForm((p: any) => ({ ...p, idealType: e.target.value }))} placeholder={'1. 다정한 사람\n2. 운동을 즐기는 사람'} rows={3} />
            </EditRow>
            <EditRow label="기타 / 특이사항">
              <textarea style={textAreaStyle} value={editForm.etc} onChange={e => setEditForm((p: any) => ({ ...p, etc: e.target.value }))} placeholder="자유롭게 기재해주세요" rows={2} />
            </EditRow>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setIsEditing(false)} disabled={isSaving} style={{ flex: 1, padding: '16px', borderRadius: '100px', border: '1.5px solid #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' }}>취소</button>
              <button onClick={handleSave} disabled={isSaving} style={{ flex: 1.5, padding: '16px', borderRadius: '100px', border: 'none', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {isSaving ? '저장 중...' : <><Check size={16} /> 저장하기</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '0 16px' }}>

        {/* Back */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#bbb', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600', marginBottom: '20px' }}>
          <ArrowLeft size={16} /> 홈으로
        </Link>

        {/* ─── PROFILE CARD ─── */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(255,111,97,0.07)', border: '1px solid #FFE8E5', marginBottom: '16px' }}>

          {/* Title bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 0' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#111' }}>프로필 정보</h2>
            <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: '#FF6F61', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: '4px 8px' }}>
              편집
            </button>
          </div>

          {/* Profile Image */}
          <div style={{ margin: '16px 20px', borderRadius: '16px', overflow: 'hidden', background: 'linear-gradient(135deg, #FFDBE9 0%, #E8D5F5 100%)', aspectRatio: '3/2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', position: 'relative' }}
            onClick={() => photoInputRef.current?.click()}>
            {galleryPhotos.length > 0 ? (
              <img src={galleryPhotos[0]} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            ) : (
              <>
                <Camera size={36} color="rgba(255,111,97,0.4)" />
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,111,97,0.5)', fontWeight: '700', textAlign: 'center' }}>이미지를 첨부해주세요</span>
              </>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>

          {/* Summary Info */}
          <div style={{ padding: '0 20px' }}>
            <InfoRow label="이름" value={userData?.name} />
            <InfoRow label="출생연도" value={userData?.birthDate ? calcAge(userData.birthDate) : null} />
            <InfoRow label="성별" value={genderLabel !== '-' ? (userData?.gender === 'male' ? 'M (남성)' : 'F (여성)') : null} />
            <InfoRow label="키 / 몸무게" value={physique} />
          </div>

          {/* Accordion Toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ width: '100%', margin: '16px 0 0', padding: '18px 20px', background: expanded ? '#FFF5F4' : 'linear-gradient(135deg, #FF6F61, #FF9A9E)', border: 'none', borderTop: '1px solid #FFE8E5', color: expanded ? '#FF6F61' : '#fff', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
            {expanded ? <><ChevronUp size={18} /> 접기</> : <><ChevronDown size={18} /> 펼쳐보기</>}
          </button>

          {/* === ACCORDION CONTENT === */}
          {expanded && (
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid #FFF0EE' }}>
              <div style={{ marginTop: '4px' }}>
                <InfoRow label="연락처" value={userData?.phone} />
                <InfoRow label="인스타그램" value={userData?.instaId} />
                <InfoRow label="거주지" value={userData?.residence} />
                <InfoRow label="회사명/직무" value={userData?.workplace} />
                <InfoRow label="음주" value={userData?.drinking} />
                <InfoRow label="흡연" value={userData?.smoking} />
                <InfoRow label="종교" value={userData?.religion} />
                <InfoRow label="이상형" value={userData?.idealType} />
                <InfoRow label="비선호형" value={userData?.nonIdealType} />
                <div style={{ borderBottom: '1px solid #FFF0EE', padding: '14px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#AAA', fontWeight: '600', display: 'block', marginBottom: '6px' }}>기타 / 특이사항</span>
                  <span style={{ fontSize: '0.9rem', color: userData?.etc ? '#222' : '#CCC', fontWeight: userData?.etc ? '600' : '400', fontStyle: !userData?.etc ? 'italic' : 'normal', whiteSpace: 'pre-wrap' }}>
                    {userData?.etc || EMPTY}
                  </span>
                </div>

                {/* Photo gallery strip */}
                {galleryPhotos.length > 0 && (
                  <div style={{ paddingTop: '16px' }}>
                    <p style={{ fontSize: '0.78rem', color: '#AAA', fontWeight: '600', marginBottom: '10px' }}>업로드된 사진 ({galleryPhotos.length}/5)</p>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                      {galleryPhotos.map((src, i) => (
                        <div key={i} style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: '1.5px solid #FFE8E5' }}>
                          <img src={src} alt={`photo-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => setGalleryPhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={10} color="#fff" />
                          </button>
                        </div>
                      ))}
                      {galleryPhotos.length < 5 && (
                        <div onClick={() => photoInputRef.current?.click()} style={{ width: '72px', height: '72px', borderRadius: '10px', border: '1.5px dashed #FFDBE9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: '#FFFAF9' }}>
                          <Camera size={20} color="#FFDBE9" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── 신청 상품 정보 ─── */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 4px 24px rgba(255,111,97,0.07)', border: '1px solid #FFE8E5', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #FFF0EE', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="#FF6F61" />
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#111' }}>신청 상품 정보</h2>
          </div>
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#FFF5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Package size={24} color="#FFDBE9" />
            </div>
            <p style={{ color: '#CCC', fontWeight: '600', fontSize: '0.9rem' }}>신청 내역이 없습니다.</p>
            <Link href="/events" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 24px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '700', fontSize: '0.85rem', textDecoration: 'none' }}>
              행사 신청하러 가기
            </Link>
          </div>
        </div>

        {/* ─── LOGOUT ─── */}
        <button onClick={async () => { await auth.signOut(); router.push('/'); }}
          style={{ width: '100%', padding: '16px', borderRadius: '100px', border: '1.5px solid #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <LogOut size={16} /> 로그아웃
        </button>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#DDD', fontSize: '0.76rem' }}>
          매칭을 위한 개인정보는 최고 수준의 보안으로 보호됩니다.
        </p>
      </div>
    </div>
  );
}
