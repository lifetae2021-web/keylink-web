'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  LogOut, ArrowLeft, Camera, ChevronDown, ChevronUp, X, Check, Edit3, Package, Upload, Trash2
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
function EditRow({ label, children, required }: { label: string; children: React.Abnode; required?: boolean }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', color: '#FF6F61', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.02em' }}>
        {label} {required && <span style={{ color: '#FF6F61' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { borderRadius: '12px', border: '1.5px solid #FFDBE9', padding: '12px 16px', fontSize: '0.95rem', fontWeight: '600', width: '100%', boxSizing: 'border-box', background: '#FFFAFA', outline: 'none', transition: 'border-color 0.2s' };
const textAreaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: '80px', lineHeight: '1.6' };

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({
    name: '', gender: '', phone: '', instaId: '', birthDate: '', height: '', weight: '',
    residence: '', workplace: '', jobRole: '', avoidAcquaintance: '',
    idealType: '', nonIdealType: '', smoking: '', drinking: '', religion: '',
    drink: '', vibe: '', etc: '',
  });

  // Photo states in modal (File or URL)
  const [facePhotos, setFacePhotos] = useState<any[]>([]);
  const [bodyPhotos, setBodyPhotos] = useState<any[]>([]);
  
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const mainPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      setUser(currentUser);
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserData(d);
          
          const initialForm = {
            name: d.name || '',
            gender: d.gender || '',
            phone: d.phone || '',
            instaId: d.instaId || '',
            birthDate: d.birthDate || '',
            height: d.height || '',
            weight: d.weight || '',
            residence: d.residence || '',
            workplace: d.workplace || '',
            jobRole: d.jobRole || d.workplace || '', // Fallback for transition
            avoidAcquaintance: d.avoidAcquaintance || '',
            idealType: d.idealType || '',
            nonIdealType: d.nonIdealType || '',
            smoking: d.smoking || '',
            drinking: d.drinking || '',
            religion: d.religion || '',
            drink: d.drink || '',
            vibe: d.vibe || '',
            etc: d.etc || '',
          };
          setEditForm(initialForm);
          
          if (d.facePhotos) setFacePhotos(d.facePhotos);
          if (d.bodyPhotos) setBodyPhotos(d.bodyPhotos);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSave = async () => {
    if (!editForm.name) return toast.error('이름을 입력해주세요.');
    if (!editForm.birthDate) return toast.error('생년월일을 입력해주세요.');
    if (!editForm.height || !editForm.weight) return toast.error('키와 체중을 입력해주세요.');
    if (!editForm.workplace) return toast.error('회사명 / 직무를 입력해주세요.');

    setIsSaving(true);
    try {
      const updateData = {
        ...editForm,
        facePhotos,
        bodyPhotos,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(db, 'users', user!.uid), updateData);
      setUserData((p: any) => ({ ...p, ...updateData }));
      setIsEditing(false);
      toast.success('프로필 정보가 안전하게 업데이트되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handlePhotoUpload = (category: 'face' | 'body', e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (category === 'face') {
          setFacePhotos(prev => [...prev, url].slice(0, 5));
        } else {
          setBodyPhotos(prev => [...prev, url].slice(0, 5));
        }
      };
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

  const genderLabel = userData?.gender === 'male' ? 'M' : userData?.gender === 'female' ? 'F' : '-';
  const physique = userData?.height || userData?.weight
    ? `${userData?.height ? userData.height + 'cm' : '-'} / ${userData?.weight ? userData.weight + 'kg' : '-'}`
    : null;

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9F8', paddingTop: '80px', paddingBottom: '60px' }}>
      
      {/* ─── EDIT MODAL (Synchronization with Application Form) ─── */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div style={{ background: '#FFFFFF', borderRadius: '32px', padding: '32px', maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 70px rgba(255,111,97,0.2)' }} className="kl-scrollbar">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: '16px', borderBottom: '1px solid #FFF0EE' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#111' }}>신뢰 기반 프로필 편집</h2>
                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>상대에게 보여지는 정보를 신청서와 동일하게 관리하세요.</p>
              </div>
              <button onClick={() => setIsEditing(false)} style={{ background: '#FFF5F4', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'rotate(90deg)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <X size={20} color="#FF6F61" />
              </button>
            </div>

            {/* Photo Section */}
            <div style={{ marginBottom: '40px' }}>
              <EditRow label="본인 사진 업로드 (최대 5장씩)" required>
                <div style={{ background: '#FFFDFD', border: '1.5px dashed #FFDBE9', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                   <p style={{ fontSize: '0.78rem', color: '#666', lineHeight: 1.6, marginBottom: '20px' }}>
                    과도한 보정이나 마스크 착용 사진은 지양해주세요.<br/>
                    <strong style={{ color: '#FF6F61' }}>얼굴과 전신 사진을 각각 최소 1장 이상 등록 바랍니다.</strong>
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Face Category */}
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Camera size={14} color="#FF6F61" /> 얼굴 사진 ({facePhotos.length}/5)
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {facePhotos.map((src, i) => (
                          <div key={i} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #FFDBE9' }}>
                            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="face" />
                            <button onClick={() => setFacePhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <X size={10} color="#fff" />
                            </button>
                          </div>
                        ))}
                        {facePhotos.length < 5 && (
                          <button onClick={() => faceInputRef.current?.click()} style={{ width: '60px', height: '60px', borderRadius: '12px', border: '1.5px dashed #FFDBE9', background: '#FFFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFDBE9' }}>
                            <Upload size={20} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Body Category */}
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Camera size={14} color="#A98FD5" /> 전신 사진 ({bodyPhotos.length}/5)
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {bodyPhotos.map((src, i) => (
                          <div key={i} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8D5F5' }}>
                            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="body" />
                            <button onClick={() => setBodyPhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <X size={10} color="#fff" />
                            </button>
                          </div>
                        ))}
                        {bodyPhotos.length < 5 && (
                          <button onClick={() => bodyInputRef.current?.click()} style={{ width: '60px', height: '60px', borderRadius: '12px', border: '1.5px dashed #FFDBE9', background: '#FFFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFDBE9' }}>
                            <Upload size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <input ref={faceInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload('face', e)} />
                <input ref={bodyInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoUpload('body', e)} />
              </EditRow>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <EditRow label="성함" required>
                <input style={inputStyle} value={editForm.name} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="본명 입력" />
              </EditRow>
              <EditRow label="성별">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['male', 'female'].map(g => (
                    <button key={g} onClick={() => setEditForm((p: any) => ({ ...p, gender: g }))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: editForm.gender === g ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.gender === g ? '#FFF5F4' : '#fff', color: editForm.gender === g ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                      {g === 'male' ? '남성' : '여성'}
                    </button>
                  ))}
                </div>
              </EditRow>
            </div>

            <EditRow label="생년월일" required>
              <input style={inputStyle} value={editForm.birthDate} onChange={e => setEditForm((p: any) => ({ ...p, birthDate: e.target.value }))} placeholder="ex. 1994-05-30" />
            </EditRow>

            <EditRow label="연락처">
              <input style={inputStyle} type="tel" value={editForm.phone} onChange={e => setEditForm((p: any) => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="010-0000-0000" />
            </EditRow>

            <EditRow label="인스타그램 계정">
              <input style={inputStyle} value={editForm.instaId} onChange={e => setEditForm((p: any) => ({ ...p, instaId: e.target.value }))} placeholder="@insta_account" />
            </EditRow>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <EditRow label="키 (cm)" required>
                <input style={inputStyle} value={editForm.height} onChange={e => setEditForm((p: any) => ({ ...p, height: e.target.value }))} placeholder="ex. 178" />
              </EditRow>
              <EditRow label="체중 (kg)" required>
                <input style={inputStyle} value={editForm.weight} onChange={e => setEditForm((p: any) => ({ ...p, weight: e.target.value }))} placeholder="ex. 72" />
              </EditRow>
            </div>

            <EditRow label="거주 지역">
              <input style={inputStyle} value={editForm.residence} onChange={e => setEditForm((p: any) => ({ ...p, residence: e.target.value }))} placeholder="ex. 부산 수영구" />
            </EditRow>

            <EditRow label="회사명 / 직무" required>
              <textarea style={textAreaStyle} value={editForm.workplace} onChange={e => setEditForm((p: any) => ({ ...p, workplace: e.target.value, jobRole: e.target.value }))} placeholder={`ex. 수액병원, 간호사\n링크은행, 은행원`} />
            </EditRow>

            <EditRow label="겹치고 싶지 않은 지인 (선택)">
              <input style={inputStyle} value={editForm.avoidAcquaintance} onChange={e => setEditForm((p: any) => ({ ...p, avoidAcquaintance: e.target.value }))} placeholder="이름 또는 연락처" />
            </EditRow>

            <EditRow label="이상형 (최대 5가지)">
              <textarea style={textAreaStyle} value={editForm.idealType} onChange={e => setEditForm((p: any) => ({ ...p, idealType: e.target.value }))} placeholder={'1. 다정한 사람\n2. 웃는게 예쁜 사람'} rows={3} />
            </EditRow>

            <EditRow label="비선호형 (최대 5가지)">
              <textarea style={textAreaStyle} value={editForm.nonIdealType} onChange={e => setEditForm((p: any) => ({ ...p, nonIdealType: e.target.value }))} placeholder={'1. 예의 없는 사람\n2. 연락 두절되는 사람'} rows={3} />
            </EditRow>

            <EditRow label="흡연 유무">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['비흡연', '전자담배', '연초'].map(opt => (
                  <button key={opt} onClick={() => setEditForm((p: any) => ({ ...p, smoking: opt }))} style={{ padding: '10px 18px', borderRadius: '100px', border: editForm.smoking === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.smoking === opt ? '#FFF5F4' : '#fff', color: editForm.smoking === opt ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </EditRow>

            <EditRow label="음주 빈도">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['안 마심', '가끔 (월 1~2회)', '즐겨 마시는 편'].map(opt => (
                  <button key={opt} onClick={() => setEditForm((p: any) => ({ ...p, drinking: opt }))} style={{ padding: '10px 18px', borderRadius: '100px', border: editForm.drinking === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.drinking === opt ? '#FFF5F4' : '#fff', color: editForm.drinking === opt ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </EditRow>

            <EditRow label="종교">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['무교', '기독교', '천주교', '불교', '기타'].map(opt => (
                  <button key={opt} onClick={() => setEditForm((p: any) => ({ ...p, religion: opt }))} style={{ padding: '10px 18px', borderRadius: '100px', border: editForm.religion === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.religion === opt ? '#FFF5F4' : '#fff', color: editForm.religion === opt ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </EditRow>

            <EditRow label="행사 희망 음료">
              <select style={inputStyle} value={editForm.drink} onChange={e => setEditForm((p: any) => ({ ...p, drink: e.target.value }))}>
                <option value="">음료 선택</option>
                {['아이스 아메리카노', '복숭아 아이스티', '얼그레이', '페퍼민트', '카라멜 블랙티', '물', '따뜻한 음료'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </EditRow>

            <EditRow label="행사 선호 분위기">
              <input style={inputStyle} value={editForm.vibe} onChange={e => setEditForm((p: any) => ({ ...p, vibe: e.target.value }))} placeholder="ex. 차분한 대화 위주" />
            </EditRow>

            <EditRow label="특이사항 / 키링크에게 바라는 점">
              <textarea style={textAreaStyle} value={editForm.etc} onChange={e => setEditForm((p: any) => ({ ...p, etc: e.target.value }))} placeholder="알러지 여부나 기타 요청사항" rows={2} />
            </EditRow>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', position: 'sticky', bottom: 0, background: '#fff', paddingTop: '20px', borderTop: '1px solid #FFF0EE' }}>
              <button onClick={() => setIsEditing(false)} disabled={isSaving} style={{ flex: 1, padding: '18px', borderRadius: '100px', border: '1.5px solid #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '700', cursor: 'pointer', fontSize: '1rem' }}>취소</button>
              <button onClick={handleSave} disabled={isSaving} style={{ flex: 1.5, padding: '18px', borderRadius: '100px', border: 'none', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(255,111,97,0.3)' }}>
                {isSaving ? '저장 중...' : <><Check size={20} /> 프로필 수정 완료</>}
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
        <div style={{ background: '#FFFFFF', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '16px' }}>

          {/* Title bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 0' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111' }}>나의 프로필</h2>
            <button onClick={() => setIsEditing(true)} style={{ background: '#FFF5F4', border: 'none', color: '#FF6F61', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', padding: '8px 16px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Edit3 size={14} /> 편집
            </button>
          </div>

          {/* Profile Image (First Face Photo or Placeholder) */}
          <div style={{ margin: '20px 24px', borderRadius: '20px', overflow: 'hidden', background: 'linear-gradient(135deg, #FFDBE9 0%, #E8D5F5 100%)', aspectRatio: '3/2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', position: 'relative' }}
            onClick={() => setIsEditing(true)}>
            {facePhotos.length > 0 ? (
              <img src={facePhotos[0]} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            ) : (
              <>
                <Camera size={40} color="rgba(255,111,97,0.4)" />
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,111,97,0.5)', fontWeight: '800', textAlign: 'center' }}>얼굴 사진을 등록해주세요</span>
              </>
            )}
          </div>

          {/* Summary Info */}
          <div style={{ padding: '0 24px' }}>
            <InfoRow label="이름" value={userData?.name} />
            <InfoRow label="출생연도" value={userData?.birthDate ? calcAge(userData.birthDate) : null} />
            <InfoRow label="성별" value={genderLabel !== '-' ? (userData?.gender === 'male' ? '남성 (M)' : '여성 (F)') : null} />
            <InfoRow label="키 / 몸무게" value={physique} />
          </div>

          {/* Accordion Toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ width: '100%', margin: '20px 0 0', padding: '20px', background: expanded ? '#FFF5F4' : 'linear-gradient(135deg, #FF6F61, #FF9A9E)', border: 'none', color: expanded ? '#FF6F61' : '#fff', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s' }}>
            {expanded ? <><ChevronUp size={20} /> 상세 정보 접기</> : <><ChevronDown size={20} /> 전체 정보 펼쳐보기</>}
          </button>

          {/* === ACCORDION CONTENT === */}
          {expanded && (
            <div style={{ padding: '0 24px 24px', borderTop: '1px solid #FFF0EE' }}>
              <div style={{ marginTop: '8px' }}>
                <InfoRow label="연락처" value={userData?.phone} />
                <InfoRow label="인스타그램" value={userData?.instaId} />
                <InfoRow label="거주 지역" value={userData?.residence} />
                <InfoRow label="회사명/직무" value={userData?.workplace} />
                <InfoRow label="지인 회피" value={userData?.avoidAcquaintance} />
                <InfoRow label="음주 빈도" value={userData?.drinking} />
                <InfoRow label="흡연 유무" value={userData?.smoking} />
                <InfoRow label="종교" value={userData?.religion} />
                <InfoRow label="희망 음료" value={userData?.drink} />
                <InfoRow label="희망 분위기" value={userData?.vibe} />
                <InfoRow label="이상형" value={userData?.idealType} />
                <InfoRow label="비선호형" value={userData?.nonIdealType} />
                <div style={{ borderBottom: '1px solid #FFF0EE', padding: '16px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#AAA', fontWeight: '600', display: 'block', marginBottom: '8px' }}>기타 / 특이사항</span>
                  <span style={{ fontSize: '0.9rem', color: userData?.etc ? '#222' : '#CCC', fontWeight: userData?.etc ? '700' : '400', fontStyle: !userData?.etc ? 'italic' : 'normal', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {userData?.etc || EMPTY}
                  </span>
                </div>

                {/* Face Photo Strip */}
                <div style={{ paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#AAA', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} color="#FF6F61" /> 얼굴 갤러리 ({facePhotos.length}/5)
                  </p>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }} className="kl-scrollbar">
                    {facePhotos.length > 0 ? facePhotos.map((src, i) => (
                      <div key={i} style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '2px solid #FFE8E5' }}>
                        <img src={src} alt={`face-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )) : <p style={{ fontSize: '0.85rem', color: '#CCC', fontStyle: 'italic' }}>등록된 얼굴 사진이 없습니다.</p>}
                  </div>
                </div>

                {/* Body Photo Strip */}
                <div style={{ paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#AAA', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} color="#A98FD5" /> 전신 갤러리 ({bodyPhotos.length}/5)
                  </p>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }} className="kl-scrollbar">
                    {bodyPhotos.length > 0 ? bodyPhotos.map((src, i) => (
                      <div key={i} style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '2px solid #E8D5F5' }}>
                        <img src={src} alt={`body-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )) : <p style={{ fontSize: '0.85rem', color: '#CCC', fontStyle: 'italic' }}>등록된 전신 사진이 없습니다.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 신청 상품 정보 ─── */}
        <div style={{ background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #FFF0EE', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} color="#FF6F61" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111' }}>신청 상품 정보</h2>
          </div>
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: '#FFF5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Package size={28} color="#FFDBE9" />
            </div>
            <p style={{ color: '#CCC', fontWeight: '700', fontSize: '0.95rem' }}>신청 내역이 존재하지 않습니다.</p>
            <Link href="/events" style={{ display: 'inline-block', marginTop: '20px', padding: '14px 32px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.9rem', textDecoration: 'none', boxShadow: '0 8px 16px rgba(255,111,97,0.2)' }}>
              새로운 기수 신청하기
            </Link>
          </div>
        </div>

        {/* ─── LOGOUT ─── */}
        <button onClick={async () => { await auth.signOut(); router.push('/'); }}
          style={{ width: '100%', padding: '18px', borderRadius: '100px', border: '1.5px solid #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#FFF5F4'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <LogOut size={18} /> 안전하게 로그아웃
        </button>

        <p style={{ textAlign: 'center', marginTop: '32px', color: '#BBB', fontSize: '0.8rem', fontWeight: '500' }}>
          매칭을 위한 모든 정보는 암호화되어 보호됩니다.
        </p>
      </div>

      <style>{`
        .kl-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .kl-scrollbar::-webkit-scrollbar-track { background: #fdfdfd; }
        .kl-scrollbar::-webkit-scrollbar-thumb { background: #FFDBE9; borderRadius: 4px; }
      `}</style>
    </div>
  );
}
