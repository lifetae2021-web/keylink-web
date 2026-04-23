'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { compressImage } from '@/lib/utils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, getDoc, updateDoc, serverTimestamp, deleteField, 
  collection, query, where, getDocs, orderBy 
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import {
  LogOut, ArrowLeft, Camera, ChevronDown, ChevronUp, X, Check, Edit3, Package, Upload,
  Clock, Banknote, CheckCircle2, XCircle, Vote, Lock, ShieldCheck, FileText, History,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { subscribeMyApplication, subscribeMyApplications } from '@/lib/firestore/applications';
import { subscribeSession } from '@/lib/firestore/sessions';
import { getMyVote, getVotesReceivedByMe } from '@/lib/firestore/votes';
import { Application, Session } from '@/lib/types';

const EMPTY = '미입력';

// Calculate age from birthDate string e.g. "1994-05-30" or "940530"
function calcAge(birthDate: string): string {
  if (!birthDate) return '-';
  let year: string;
  if (birthDate.includes('-')) {
    year = birthDate.slice(2, 4);
  } else if (birthDate.length >= 6) {
    year = birthDate.slice(0, 2);
  } else return '-';
  return `${year}년생`;
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
function EditRow({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
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

  // v8.0.2: 신청 현황 다중 상태 관리
  const [applications, setApplications] = useState<Application[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  
  // v7.9.5: 내 신청 히스토리
  const [history, setHistory] = useState<any[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [sessionsMap, setSessionsMap] = useState<Record<string, Session>>({});

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({
    name: '', gender: '', phone: '', instaId: '', birthDate: '', height: '', weight: '',
    residence: '', workplace: '', jobRole: '', avoidAcquaintance: '',
    idealType: '', nonIdealType: '', smoking: '', drinking: '', religion: '',
    drink: '', etc: '', employmentProof: '',
  });

  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<string>('');
  const [verificationFileName, setVerificationFileName] = useState<string>('');
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // Photo states in modal (File or URL)
  const [photos, setPhotos] = useState<any[]>([]);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
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
            jobRole: d.jobRole || d.workplace || '',
            avoidAcquaintance: d.avoidAcquaintance || '',
            idealType: d.idealType || '',
            nonIdealType: d.nonIdealType || '',
            smoking: d.smoking || '',
            drinking: d.drinking || '',
            religion: d.religion || '',
            drink: Array.isArray(d.drink) ? d.drink : (d.drink ? [d.drink] : []),
            etc: d.etc || '',
            employmentProof: d.employmentProof || d.verificationUrl || '',
          };
          setEditForm(initialForm);
          setVerificationPreview(initialForm.employmentProof || '');
          
          const savedPhotos = d.photos || d.profilePhotos || [];
          const legacyFace = d.facePhotos || [];
          const legacyBody = d.bodyPhotos || [];
          const merged = savedPhotos.length > 0 ? savedPhotos : [...legacyFace, ...legacyBody].slice(0, 5);
          setPhotos(merged);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }

      // v8.0.2: 모든 신청서 실시간 구독 및 관련 세션 실시간 추적
      const unsubApps = subscribeMyApplications(currentUser.uid, (apps) => {
        setApplications(apps);
        
        // 각 신청서의 세션 정보 실시간 구독 (필요한 경우에만)
        apps.forEach(async (app) => {
          if (!sessionsMap[app.sessionId]) {
            subscribeSession(app.sessionId, (s) => {
              if (s) setSessionsMap(prev => ({ ...prev, [app.sessionId]: s }));
            });
          }
          // 투표 여부 확인 (최초 1회 또는 상태 변경 시)
          if (app.status === 'confirmed') {
            const vote = await getMyVote(app.sessionId, currentUser.uid);
            if (vote) setHasVoted(true); // 간단하게 하나라도 했는지 체크 (성능상 최적화 가능)
          }
        });
      });

      // v7.9.5: 내 신청 내역 일시불 오프라인 패치 (실시간까지는 필요X)
      const fetchHistory = async () => {
        try {
          const q = query(
            collection(db, 'applications'), 
            where('userId', '==', currentUser.uid), 
            orderBy('appliedAt', 'desc')
          );
          const hSnap = await getDocs(q);
          const apps = hSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistory(apps);

          // 세션 정보 캐싱 (제목 표시용)
          const sessionIds = Array.from(new Set(apps.map((a: any) => a.sessionId)));
          const newMap: any = { ...sessionsMap };
          for (const sId of sessionIds) {
            if (!newMap[sId]) {
              const sSnap = await getDoc(doc(db, 'sessions', sId));
              if (sSnap.exists()) newMap[sId] = { id: sSnap.id, ...sSnap.data() };
            }
          }
          setSessionsMap(newMap);
        } catch (e) {
          console.error("Error fetching history:", e);
        }
      };
      fetchHistory();

      return () => { unsubApps(); };
    });
    return () => unsubscribe();
  }, [router]);

  const handleSave = async () => {
    if (!editForm.workplace) return toast.error('회사명 / 직무를 입력해주세요.');
    
    // v7.8.5: 재직 증명 필수 검사 (employmentProof 필드명 표준화)
    if (!verificationFile && !editForm.employmentProof) {
      return toast.error('재직 증명 서류를 업로드해 주세요.');
    }

    // v5.1.0 추가 필수 항목 검사
    if (!editForm.phone) return toast.error('연락처를 입력해주세요.');
    if (!editForm.residence) return toast.error('거주지를 입력해주세요.');
    if (!editForm.smoking) return toast.error('흡연 유무를 선택해주세요.');
    if (!editForm.drinking) return toast.error('음주 빈도를 선택해주세요.');
    if (!editForm.religion) return toast.error('종교를 선택해주세요.');

    setIsSaving(true);
    try {
      // Photo Upload logic: Upload new base64 images to Storage (v3.5.1)
      const uploadedUrls = await Promise.all(
        photos.map(async (photo, index) => {
          if (typeof photo === 'string' && photo.startsWith('data:')) {
            const photoRef = ref(storage, `profile_images/${user!.uid}/${Date.now()}_${index}.jpg`);
            await uploadString(photoRef, photo, 'data_url');
            return await getDownloadURL(photoRef);
          }
          return photo; // Existing URL
        })
      );
      
      // v7.8.5: 재직 증명 서류 업로드
      let finalVerificationUrl = editForm.employmentProof;
      if (verificationFile) {
        const fileExt = verificationFile.name.split('.').pop();
        const verifyRef = ref(storage, `verification_proofs/${user!.uid}/${Date.now()}.${fileExt}`);
        const uploadTask = await uploadString(verifyRef, verificationPreview, 'data_url');
        finalVerificationUrl = await getDownloadURL(verifyRef);
      }

      // Sanitize editForm to ensure no undefined values are sent to Firestore
      const sanitizedForm = Object.keys(editForm).reduce((acc: any, key) => {
        acc[key] = editForm[key] === undefined ? '' : editForm[key];
        return acc;
      }, {});

      const updateData = {
        ...sanitizedForm,
        photos: uploadedUrls,
        employmentProof: finalVerificationUrl,
        isVerified: userData?.isVerified ?? false,
        // Explicitly clear legacy fields to prevent schema conflicts (v3.5.1 Cleanup)
        profilePhotos: deleteField(),
        facePhotos: deleteField(),
        bodyPhotos: deleteField(),
        fullBodyPhotos: deleteField(),
        facePhoto: deleteField(),
        bodyPhoto: deleteField(),
        verificationUrl: deleteField(),
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, 'users', user!.uid), updateData);
      setUserData((p: any) => ({ ...p, ...updateData }));
      setPhotos(uploadedUrls); // Update local state with URLs
      setIsEditing(false);
      toast.success('프로필 정보가 안전하게 업데이트되었습니다.');
    } catch (error: any) {
      console.error('Profile Save Error:', error);
      let errorMessage = '저장 중 오류가 발생했습니다.';
      if (error.code === 'storage/unauthorized') {
        errorMessage = '사진 업로드 권한이 없습니다. (Storage Rules 확인 필요)';
      } else if (error.code === 'storage/canceled') {
        errorMessage = '업로드가 취소되었습니다.';
      } else if (error.message) {
        errorMessage = `저장 오류: ${error.message}`;
      }
      alert(errorMessage);
      toast.error(errorMessage);
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
        // Apply compression before setting state (v3.5.1)
        const compressedUrl = await compressImage(rawUrl);
        setPhotos(prev => [...prev, compressedUrl].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleVerifyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) return toast.error('파일 크기는 5MB 이하여야 합니다.');
    
    setVerificationFile(file);
    setVerificationFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setVerificationPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
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

            {/* Photo Section (Unified v3.5.1) */}
            <div style={{ marginBottom: '40px' }}>
              <EditRow label={`본인 사진 업로드 (${photos.length}/5)`} required>
                <div style={{ background: '#FFFDFD', border: '1.5px dashed #FFDBE9', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                   <p style={{ fontSize: '0.82rem', color: '#666', lineHeight: 1.6, marginBottom: '20px', fontWeight: '500' }}>
                    과도한 보정이나 마스크 착용 사진은 지양해주세요.<br/>
                    <strong style={{ color: '#FF6F61' }}>얼굴과 전신 사진이 포함되도록 자유롭게 총 5장까지 등록해 주세요.</strong>
                  </p>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {photos.map((src, i) => (
                      <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #FFDBE9', boxShadow: '0 4px 12px rgba(255,111,97,0.1)' }}>
                        <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="profile" />
                        <button onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <X size={12} color="#fff" />
                        </button>
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <button onClick={() => photoInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: '14px', border: '1.5px dashed #FFDBE9', background: '#FFFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFDBE9', gap: '4px' }}>
                        <Upload size={24} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>추가</span>
                      </button>
                    )}
                  </div>
                </div>
                <input ref={photoInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
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

            <EditRow label="연락처" required>
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

            <EditRow label="거주지" required>
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

            <EditRow label="흡연 유무" required>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['비흡연', '전자담배', '연초'].map(opt => (
                  <button key={opt} onClick={() => setEditForm((p: any) => ({ ...p, smoking: opt }))} style={{ padding: '10px 18px', borderRadius: '100px', border: editForm.smoking === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.smoking === opt ? '#FFF5F4' : '#fff', color: editForm.smoking === opt ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </EditRow>

            <EditRow label="음주 빈도" required>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['안 마심', '가끔 (월 1~2회)', '주 1~2회', '즐겨 마시는 편'].map(opt => (
                  <button key={opt} onClick={() => setEditForm((p: any) => ({ ...p, drinking: opt }))} style={{ padding: '10px 18px', borderRadius: '100px', border: editForm.drinking === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.drinking === opt ? '#FFF5F4' : '#fff', color: editForm.drinking === opt ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </EditRow>

            <EditRow label="종교" required>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['무교', '기독교', '천주교', '불교', '기타'].map(opt => (
                  <button key={opt} onClick={() => setEditForm((p: any) => ({ ...p, religion: opt }))} style={{ padding: '10px 18px', borderRadius: '100px', border: editForm.religion === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5', background: editForm.religion === opt ? '#FFF5F4' : '#fff', color: editForm.religion === opt ? '#FF6F61' : '#AAA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </EditRow>

            <EditRow label="희망 음료 (중복 선택 가능)">
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['아이스 아메리카노', '제로 콜라', '복숭아 아이스티', '얼그레이', '페퍼민트', '카라멜 블랙티', '물', '따뜻한 음료'].map(d => {
                  const selected = (editForm.drink || []).includes(d);
                  return (
                    <button 
                      key={d} 
                      onClick={() => {
                        const current = editForm.drink || [];
                        const next = selected ? current.filter((v: string) => v !== d) : [...current, d];
                        setEditForm((p: any) => ({ ...p, drink: next }));
                      }}
                      style={{ 
                        padding: '10px 16px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
                        background: selected ? '#FF6F61' : '#fff', color: selected ? '#fff' : '#64748B', border: selected ? '1.5px solid #FF6F61' : '1.5px solid #E2E8F0'
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </EditRow>


            <EditRow label="특이사항 / 키링크에게 바라는 점">
              <textarea style={textAreaStyle} value={editForm.etc} onChange={e => setEditForm((p: any) => ({ ...p, etc: e.target.value }))} placeholder="알러지 여부나 기타 요청사항" rows={2} />
            </EditRow>

             {/* v7.8.5 재직 증명 업로드 섹션 (미리보기 강화) */}
             <EditRow label="재직 증명 (필수)" required>
               <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                 <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6, marginBottom: '16px' }}>
                   신뢰할 수 있는 모임을 위해 서류(재직증명서, 급여명세서, 건강보험 등) 중 하나를 반드시 업로드해 주세요.
                 </p>
                 
                 {/* 미리보기 영역 */}
                 {(verificationPreview || editForm.employmentProof) && (
                   <div style={{ marginBottom: '16px', padding: '12px', background: '#fff', borderRadius: '12px', border: '1px solid #FFE8E5', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     {verificationPreview.startsWith('data:image') || editForm.employmentProof ? (
                       <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                         <img src={verificationPreview || editForm.employmentProof} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       </div>
                     ) : (
                       <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FileText size={24} className="text-slate-400" />
                       </div>
                     )}
                     <div style={{ flex: 1 }}>
                       <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155' }}>{verificationFileName || '등록된 증빙 서류'}</p>
                       <p style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                         <CheckCircle2 size={12} /> {verificationFile ? '업로드 준비 완료' : '인증 대기 중'}
                       </p>
                     </div>
                     <button onClick={() => { setVerificationFile(null); setVerificationPreview(''); setEditForm((p:any)=>({...p, employmentProof:''})); }} style={{ padding: '8px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
                       <X size={18} />
                     </button>
                   </div>
                 )}

                 <p style={{ fontSize: '0.82rem', color: '#0F172A', fontWeight: '800', marginBottom: '16px' }}>
                   <strong>"업로드하신 모든 서류는 철저히 암호화되어 안전하게 보호됩니다."</strong>
                 </p>
                 
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <button 
                     onClick={() => verifyInputRef.current?.click()} 
                     style={{ padding: '10px 20px', borderRadius: '10px', background: '#fff', border: '1.5px solid #CBD5E1', color: '#475569', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                   >
                     <Upload size={16} /> 파일 변경
                   </button>
                 </div>
                 <input ref={verifyInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleVerifyUpload} />
               </div>
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

          {/* Profile Image (First Photo or Placeholder) */}
          <div style={{ margin: '20px 24px', borderRadius: '20px', overflow: 'hidden', background: 'linear-gradient(135deg, #FFDBE9 0%, #E8D5F5 100%)', aspectRatio: '3/2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', position: 'relative' }}
            onClick={() => setIsEditing(true)}>
            {photos.length > 0 ? (
              <img src={photos[0]} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            ) : (
              <>
                <Camera size={40} color="rgba(255,111,97,0.4)" />
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,111,97,0.5)', fontWeight: '800', textAlign: 'center' }}>본인 사진을 등록해주세요</span>
              </>
            )}
          </div>

          {/* Summary Info */}
          <div style={{ padding: '0 24px' }}>
            <InfoRow label="이름" value={userData?.name} />
            <InfoRow label="출생연도" value={userData?.birthDate ? calcAge(userData.birthDate) : null} />
            <InfoRow label="성별" value={genderLabel !== '-' ? (userData?.gender === 'male' ? '남성 (M)' : '여성 (F)') : null} />
            <InfoRow label="키 / 몸무게" value={physique} />
            <div style={{ display: 'flex', borderBottom: '1px solid #FFF0EE', padding: '14px 0', gap: '12px', alignItems: 'center' }}>
              <span style={{ minWidth: '90px', fontSize: '0.85rem', color: '#AAA', fontWeight: '600', flexShrink: 0 }}>인증 상태</span>
              {userData?.isVerified ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981', fontSize: '0.85rem', fontWeight: '800', background: '#ECFDF5', padding: '4px 10px', borderRadius: '100px' }}>
                  <ShieldCheck size={14} fill="#10B981" color="#fff" /> 인증 완료
                </span>
              ) : (
                <span style={{ color: '#F59E0B', fontSize: '0.85rem', fontWeight: '800', background: '#FFFBEB', padding: '4px 10px', borderRadius: '100px' }}>
                  승인 대기 중
                </span>
              )}
            </div>
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
                <InfoRow label="거주지" value={userData?.residence} />
                <InfoRow label="회사명/직무" value={userData?.workplace} />
                <InfoRow label="지인 회피" value={userData?.avoidAcquaintance} />
                <InfoRow label="음주 빈도" value={userData?.drinking} />
                <InfoRow label="흡연 유무" value={userData?.smoking} />
                <InfoRow label="종교" value={userData?.religion} />
                <InfoRow label="희망 음료" value={userData?.drink} />
                <InfoRow label="이상형" value={userData?.idealType} />
                <InfoRow label="비선호형" value={userData?.nonIdealType} />
                <div style={{ borderBottom: '1px solid #FFF0EE', padding: '16px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#AAA', fontWeight: '600', display: 'block', marginBottom: '8px' }}>기타 / 특이사항</span>
                  <span style={{ fontSize: '0.9rem', color: userData?.etc ? '#222' : '#CCC', fontWeight: userData?.etc ? '700' : '400', fontStyle: !userData?.etc ? 'italic' : 'normal', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {userData?.etc || EMPTY}
                  </span>
                </div>

                {/* Consolidated Photo Gallery */}
                <div style={{ paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.8rem', color: '#AAA', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} color="#FF6F61" /> 본인 사진 갤러리 ({photos.length}/5)
                  </p>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px' }} className="kl-scrollbar">
                    {photos.length > 0 ? photos.map((src, i) => (
                      <div key={i} style={{ width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '2.5px solid #FFE8E5', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        <img src={src} alt={`profile-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )) : <p style={{ fontSize: '0.85rem', color: '#CCC', fontStyle: 'italic' }}>등록된 사진이 없습니다.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── v8.0.2: 신청 현황 상태 블록 (다중 카드 지원) ─── */}
        <ApplicationStatusSection
          applications={applications}
          sessionsMap={sessionsMap}
          userId={user?.uid || ''}
        />

        {/* ─── v7.9.5: 내 신청 히스토리 ─── */}
        <ApplicationHistoryBlock 
          history={history} 
          sessionsMap={sessionsMap}
          showAll={showAllHistory}
          setShowAll={setShowAllHistory}
        />

        {/* ─── LOGOUT ─── */}
        <button onClick={async () => { await auth.signOut(); router.push('/'); }}
          style={{ width: '100%', padding: '18px', borderRadius: '100px', border: '1.5px solid #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#FFF5F4'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <LogOut size={18} /> 안전하게 로그아웃
        </button>

        <div style={{ textAlign: 'center', marginTop: '32px', color: '#BBB', fontSize: '0.8rem', fontWeight: '500' }}>
          매칭을 위한 모든 정보는 암호화되어 보호됩니다.
        </div>
      </div>

      <style>{`
        .kl-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .kl-scrollbar::-webkit-scrollbar-track { background: #fdfdfd; }
        .kl-scrollbar::-webkit-scrollbar-thumb { background: #FFDBE9; borderRadius: 4px; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// v8.0.2 ApplicationStatusSection — 다중 카드 렌더링 지원
// ─────────────────────────────────────────────────────────────────────────────
interface StatusBlockProps {
  application: Application | null;
  session: Session | null;
  userId: string;
  hasVoted: boolean;
}

function ApplicationStatusSection({ applications, sessionsMap, userId }: { applications: Application[], sessionsMap: Record<string, Session>, userId: string }) {
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    applications.forEach(async (app) => {
      if (app.status === 'confirmed' && votedMap[app.sessionId] === undefined) {
        const vote = await getMyVote(app.sessionId, userId);
        setVotedMap(prev => ({ ...prev, [app.sessionId]: !!vote }));
      }
    });
  }, [applications, userId]);

  if (applications.length === 0) {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #FFF0EE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} color="#FF6F61" />
            <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#111' }}>참여 신청 현황</span>
          </div>
          <span style={{ padding: '5px 14px', borderRadius: '100px', background: '#DDD', fontSize: '0.75rem', fontWeight: '800', color: '#fff' }}>신청 없음</span>
        </div>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Package size={32} color="#FFDBE9" style={{ marginBottom: '14px' }} />
          <p style={{ color: '#CCC', fontWeight: '700', fontSize: '0.9rem', marginBottom: '20px' }}>신청 내역이 없습니다.</p>
          <Link href="/events" style={{ display: 'inline-block', padding: '14px 32px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.9rem', textDecoration: 'none' }}>
            새로운 기수 신청하기 →
          </Link>
        </div>
      </div>
    );
  }

  // 1. 선발 확정(confirmed) 항목들을 날짜순으로 정렬
  const confirmedApps = applications
    .filter(a => a.status === 'confirmed')
    .sort((a, b) => {
      const dateA = sessionsMap[a.sessionId]?.eventDate?.getTime() || 0;
      const dateB = sessionsMap[b.sessionId]?.eventDate?.getTime() || 0;
      return dateA - dateB;
    });

  // 2. 만약 확정된 항목이 있다면 확정 카드를 전부 출력
  if (confirmedApps.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        {confirmedApps.map(app => (
          <ApplicationStatusBlock
            key={app.id}
            application={app}
            session={sessionsMap[app.sessionId]}
            userId={userId}
            hasVoted={votedMap[app.sessionId] || false}
          />
        ))}
      </div>
    );
  }

  // 3. 확정 항목이 없다면 가장 최근 상태(applied, selected 등) 하나를 출력
  const latestApp = applications[0]; // subscribeMyApplications에서 updatedAt 기준 내림차순 정렬됨
  return (
    <ApplicationStatusBlock
      application={latestApp}
      session={sessionsMap[latestApp.sessionId]}
      userId={userId}
      hasVoted={votedMap[latestApp.sessionId] || false}
    />
  );
}

function ApplicationStatusBlock({ application, session, userId, hasVoted }: StatusBlockProps) {
  const card = (content: React.ReactNode) => (
    <div style={{
      background: '#FFFFFF', borderRadius: '24px',
      boxShadow: '0 10px 40px rgba(255,111,97,0.08)',
      border: '1px solid #FFE8E5', overflow: 'hidden'
    }}>
      {content}
    </div>
  );

  const header = (icon: React.ReactNode, title: string, badgeColor: string, badgeText: string) => (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid #FFF0EE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {icon}
        <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#111' }}>{title}</span>
      </div>
      <span style={{ padding: '5px 14px', borderRadius: '100px', background: badgeColor, fontSize: '0.75rem', fontWeight: '800', color: '#fff' }}>{badgeText}</span>
    </div>
  );

  // ── 신청 없음 ──
  if (!application) {
    return card(
      <>
        {header(<Package size={20} color="#FF6F61" />, '참여 신청 현황', '#DDD', '신청 없음')}
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Package size={32} color="#FFDBE9" style={{ marginBottom: '14px' }} />
          <p style={{ color: '#CCC', fontWeight: '700', fontSize: '0.9rem', marginBottom: '20px' }}>신청 내역이 없습니다.</p>
          <Link href="/events" style={{ display: 'inline-block', padding: '14px 32px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.9rem', textDecoration: 'none' }}>
            새로운 기수 신청하기 →
          </Link>
        </div>
      </>
    );
  }

  // v7.2.0: ID 대신 실제 기수 명칭 표시
  const sessionTitle = session
    ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`
    : application.sessionId || '해당 기수';
  
  const sessionDateStr = session
    ? `${session.eventDate.getMonth() + 1}월 ${session.eventDate.getDate()}일 ${String(session.eventDate.getHours()).padStart(2,'0')}:${String(session.eventDate.getMinutes()).padStart(2,'0')}`
    : null;

  const sessionVenue = session?.venue || null;

  // ── 검토 중 (applied) ──
  if (application.status === 'applied') {
    return card(
      <>
        {header(<Clock size={20} color="#F59E0B" />, `${sessionTitle} 신청 완료`, '#F59E0B', '검토 중')}
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Clock size={32} color="#F59E0B" />
          </div>
          <p style={{ color: '#374151', fontWeight: '800', fontSize: '1.05rem', marginBottom: '8px' }}>신청이 접수되었습니다!</p>
          <p style={{ color: '#9CA3AF', fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.6 }}>
            운영진이 성비 및 조건을 검토하고 있습니다.<br />선발 결과는 개별 안내될 예정입니다.
          </p>
          {(sessionDateStr || sessionVenue) && (
            <div style={{ marginTop: '20px', background: '#FFFBEB', borderRadius: '14px', padding: '14px 18px', textAlign: 'left', border: '1px solid #FCD34D' }}>
              {sessionDateStr && <p style={{ fontSize: '0.82rem', color: '#92400E', fontWeight: '700', marginBottom: '4px' }}>📅 {sessionDateStr}</p>}
              {sessionVenue && <p style={{ fontSize: '0.82rem', color: '#92400E', fontWeight: '700' }}>📍 {sessionVenue}</p>}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── 선발됨 — 입금 안내 (selected) ──
  if (application.status === 'selected') {
    return card(
      <>
        {header(<Banknote size={20} color="#8B5CF6" />, `${sessionTitle} 선발 완료`, '#8B5CF6', '입금 대기')}
        <div style={{ padding: '28px 24px' }}>
          <div style={{ background: '#F5F3FF', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <p style={{ color: '#5B21B6', fontWeight: '900', fontSize: '1rem', marginBottom: '4px' }}>🎉 선발되셨습니다!</p>
            <p style={{ color: '#6D28D9', fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.6 }}>
              아래 계좌로 참가비를 입금해 주시면 참가 확정이 완료됩니다.
            </p>
          </div>
          <div style={{ background: '#FFFBEB', borderRadius: '16px', padding: '20px', border: '1px solid #FCD34D' }}>
            <p style={{ color: '#92400E', fontWeight: '700', fontSize: '0.82rem', marginBottom: '12px' }}>📌 입금 안내</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[['은행', '카카오뱅크'], ['계좌', '3333-01-8290604'], ['예금주', '박종현'], ['금액', '35,000원']].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ minWidth: '48px', color: '#9CA3AF', fontSize: '0.82rem', fontWeight: '700' }}>{label}</span>
                  <span style={{ color: '#111', fontSize: '0.9rem', fontWeight: '800' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ color: '#9CA3AF', fontSize: '0.78rem', fontWeight: '600', textAlign: 'center', marginTop: '16px' }}>
            입금 확인 후 운영진이 직접 확정 처리합니다.
          </p>
        </div>
      </>
    );
  }

  // ── 참가 확정 (confirmed) ──
  if (application.status === 'confirmed') {
    // v8.0.2: KST 기준 행사 당일 00:00부터 투표 활성화
    const isEventDay = session ? (
      new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) === 
      session.eventDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
    ) : false;

    const isVotingActive = isEventDay || session?.status === 'voting';
    const canVote = isVotingActive && !hasVoted;

    return card(
      <>
        {header(<CheckCircle2 size={20} color="#10B981" />, `${sessionTitle} 참가 확정`, '#10B981', '참가 확정 ✓')}
        <div style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={32} color="#10B981" />
          </div>
          <p style={{ color: '#065F46', fontWeight: '900', fontSize: '1.05rem', marginBottom: '8px' }}>참가가 확정되었습니다!</p>
          <p style={{ color: '#9CA3AF', fontWeight: '600', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.6 }}>
            행사 당일 멋진 만남이 기다리고 있습니다. 🌸
          </p>
          {(sessionDateStr || sessionVenue) && (
            <div style={{ marginBottom: '20px', background: '#F0FDF4', borderRadius: '14px', padding: '14px 18px', textAlign: 'left', border: '1px solid #86EFAC' }}>
              {sessionDateStr && <p style={{ fontSize: '0.85rem', color: '#065F46', fontWeight: '800', marginBottom: '4px' }}>📅 {sessionDateStr}</p>}
              {sessionVenue && <p style={{ fontSize: '0.85rem', color: '#065F46', fontWeight: '800' }}>📍 {sessionVenue}</p>}
            </div>
          )}

          {/* 투표 버튼 영역 */}
          {hasVoted ? (
            <div style={{ padding: '16px 24px', background: '#F0FDF4', borderRadius: '14px', color: '#15803D', fontWeight: '700', fontSize: '0.9rem' }}>
              ✅ 투표를 이미 완료하셨습니다.
            </div>
          ) : canVote ? (
            <Link href={`/vote/${application.sessionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 36px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 8px 20px rgba(255,111,97,0.3)' }}>
              <Vote size={20} /> 상대방 투표하러 가기
            </Link>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 28px', borderRadius: '14px', background: '#F3F4F6', color: '#9CA3AF', fontWeight: '700', fontSize: '0.85rem' }}>
              <Lock size={16} /> 행사 당일에 투표가 활성화됩니다
            </div>
          )}

          {/* v8.0.2: 나에게 도착한 호감 (발표 시 노출) */}
          {session?.status === 'completed' && (
            <ReceivedHeartsFeed 
              sessionId={application.sessionId} 
              userId={userId} 
            />
          )}

          <Link href="/matching/result/my" style={{ display: 'block', marginTop: '16px', color: '#FF6F61', fontWeight: '700', fontSize: '0.85rem', textDecoration: 'none' }}>
            내 매칭 리포트 보기 →
          </Link>
        </div>
      </>
    );
  }

  // ── 취소 (cancelled) ──
  return card(
    <>
      {header(<XCircle size={20} color="#9CA3AF" />, `${sessionTitle} 참여 내역`, '#9CA3AF', '취소됨')}
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <XCircle size={32} color="#E5E7EB" style={{ marginBottom: '14px' }} />
        <p style={{ color: '#9CA3AF', fontWeight: '700', fontSize: '0.9rem', marginBottom: '20px' }}>이번 기수 참여가 취소되었습니다.</p>
        <Link href="/events" style={{ display: 'inline-block', padding: '14px 32px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.9rem', textDecoration: 'none' }}>
          다음 기수 신청하기 →
        </Link>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// v8.0.2 ReceivedHeartsFeed — 나를 선택한 이성 정보 및 맞호감 표시
// ─────────────────────────────────────────────────────────────────────────────
function ReceivedHeartsFeed({ sessionId, userId }: { sessionId: string, userId: string }) {
  const [voters, setVoters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myVote, setMyVote] = useState<Vote | null>(null);

  useEffect(() => {
    async function loadHearts() {
      try {
        const [received, mine] = await Promise.all([
          getVotesReceivedByMe(sessionId, userId),
          getMyVote(sessionId, userId)
        ]);
        
        setMyVote(mine);

        const profiles = await Promise.all(received.map(async (v) => {
          const userSnap = await getDoc(doc(db, 'users', v.userId));
          return { id: v.userId, ...(userSnap.data() || {}) };
        }));

        setVoters(profiles);
      } catch (e) {
        console.error('Error loading hearts:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHearts();
  }, [sessionId, userId]);

  if (loading) return <div style={{ padding: '20px', color: '#FF6F61', fontSize: '0.8rem', textAlign: 'center' }}>호감 데이터를 불러오는 중...</div>;
  if (voters.length === 0) return (
    <div style={{ marginTop: '24px', padding: '24px', background: '#F8FAFC', borderRadius: '18px', textAlign: 'center' }}>
      <p style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: '600' }}>아쉽게도 이번 기수에는 나를 선택한 분이 없네요.</p>
      <p style={{ color: '#CBD5E1', fontSize: '0.75rem', marginTop: '4px' }}>다음 번에는 더 멋진 인연이 기다리고 있을 거예요!</p>
    </div>
  );

  return (
    <div style={{ marginTop: '24px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Heart size={18} color="#FF6F61" fill="#FF6F61" />
        <h3 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#334155' }}>나에게 도착한 호감 <span style={{ color: '#FF6F61' }}>{voters.length}개</span></h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {voters.map(voter => {
          const isMutual = myVote?.choices.some(c => c.targetUserId === voter.id);
          return (
            <div key={voter.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: isMutual ? '#FFF5F4' : '#fff', padding: '12px 16px', borderRadius: '16px', border: isMutual ? '1.5px solid #FFDBE9' : '1.5px solid #F1F5F9', boxShadow: isMutual ? '0 4px 12px rgba(255,111,97,0.1)' : 'none' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: '#FFE8E5' }}>
                <img src={(voter.photos && voter.photos[0]) || '/images/placeholder-user.png'} alt={voter.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1E293B' }}>{voter.name}</span>
                  {isMutual && (
                    <span style={{ fontSize: '0.7rem', fontWeight: '900', background: '#FF6F61', color: '#fff', padding: '3px 8px', borderRadius: '6px', letterSpacing: '-0.02em' }}>매칭 성공(맞호감)</span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>{voter.birthDate ? calcAge(voter.birthDate) : ''} · {voter.residence}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ApplicationHistoryBlock({ history, sessionsMap, showAll, setShowAll }: { 
  history: any[], 
  sessionsMap: Record<string, Session>,
  showAll: boolean,
  setShowAll: (v: boolean) => void 
}) {
  if (history.length === 0) return null;

  const displayList = showAll ? history : history.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return { text: '선발 확정', bg: '#10B981', color: '#fff' };
      case 'selected': return { text: '입금 대기', bg: '#F59E0B', color: '#fff' };
      case 'applied': return { text: '검토 중', bg: '#FDE047', color: '#92400E' };
      case 'cancelled': return { text: '취소됨', bg: '#E5E7EB', color: '#9CA3AF' };
      default: return { text: '미선발', bg: '#F3F4F6', color: '#9CA3AF' };
    }
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '20px', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #FFF0EE', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <History size={18} color="#FF6F61" />
        <span style={{ fontSize: '1rem', fontWeight: '900', color: '#111' }}>내 신청 히스토리</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: '700', color: '#AAA' }}>총 {history.length}건</span>
      </div>
      
      <div style={{ padding: '8px 0' }}>
        {displayList.map((app, i) => {
          const session = sessionsMap[app.sessionId];
          const sessionTitle = session ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기` : '알 수 없는 기수';
          const appliedDate = app.appliedAt?.toDate ? app.appliedAt.toDate() : new Date(app.appliedAt);
          const dateStr = appliedDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
          const status = getStatusBadge(app.status);

          return (
            <Link 
              key={app.id}
              href={app.status === 'confirmed' ? '/matching/result/my' : `/events/${app.sessionId}`}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', 
                borderBottom: i === displayList.length - 1 ? 'none' : '1px solid #FFF9F8',
                textDecoration: 'none', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#FFFAFA'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#334155' }}>{sessionTitle}</span>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '600' }}>신청일: {dateStr}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  padding: '4px 10px', borderRadius: '100px', background: status.bg, 
                  fontSize: '0.7rem', fontWeight: '800', color: status.color 
                }}>{status.text}</span>
                <ChevronRight size={14} color="#CBD5E1" />
              </div>
            </Link>
          );
        })}
      </div>

      {!showAll && history.length > 5 && (
        <button 
          onClick={() => setShowAll(true)}
          style={{ 
            width: '100%', padding: '14px', background: '#F8FAFC', border: 'none', borderTop: '1px solid #FFF0EE',
            color: '#64748B', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' 
          }}
        >
          전체 신청 내역 더 보기 ({history.length - 5}개 더 있음)
        </button>
      )}
    </div>
  );
}
