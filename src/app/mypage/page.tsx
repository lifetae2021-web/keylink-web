'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { compressImage } from '@/lib/utils';
import { onAuthStateChanged, User, updatePassword } from 'firebase/auth';
import { 
  doc, getDoc, updateDoc, serverTimestamp, deleteField, 
  collection, query, where, getDocs, arrayUnion
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import {
  LogOut, Camera, ChevronDown, ChevronUp, X, Check, Edit3, Package, Upload,
  Clock, Banknote, CheckCircle2, XCircle, Vote as VoteIcon, Lock, ShieldCheck, FileText,
  ChevronRight, Heart, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { subscribeMyApplication, subscribeMyApplications } from '@/lib/firestore/applications';
import { subscribeSession } from '@/lib/firestore/sessions';
import { getMyVote, getVotesReceivedByMe } from '@/lib/firestore/votes';
import { Application, Session, Vote } from '@/lib/types';

const EMPTY = '미입력';

// Calculate age from birthDate string e.g. "1994-05-30" or "940530"
function calcAge(birthDate: string): string {
  if (!birthDate) return '-';
  const digits = String(birthDate).replace(/[^0-9]/g, '');
  if (digits.length === 6) {
    return `${digits.slice(0, 2)}년생`;
  } else if (digits.length === 8) {
    return `${digits.slice(2, 4)}년생`;
  }
  return '-';
}

// Simple label-value row used in both summary and detail
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const isEmpty = !value;
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #FFF0EE', padding: '14px 0', gap: '12px' }}>
      <span style={{ minWidth: '90px', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: '600', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', color: isEmpty ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontWeight: isEmpty ? '400' : '600', fontStyle: isEmpty ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
const subInputStyle: React.CSSProperties = { ...inputStyle, borderRadius: '8px', padding: '8px 10px', fontSize: '0.85rem', fontWeight: '500' };

function MyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // v8.1.7: 신청 현황 다중 상태 관리
  const [applications, setApplications] = useState<Application[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [privateApp, setPrivateApp] = useState<any>(null); // v8.15.8: 1:1 매칭 신청 정보
  
  const [sessionsMap, setSessionsMap] = useState<Record<string, Session | null>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuestUser, setIsGuestUser] = useState(false);
  const [userCoupons, setUserCoupons] = useState<any[]>([]);

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({
    name: '', gender: '', phone: '', instaId: '', birthDate: '', height: '', weight: '',
    residence: '', workplace: '', jobRole: '', avoidAcquaintance: '',
    avoidList: [] as Array<{name: string; birthYear: string; workplace: string}>,
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

  // 비밀번호 변경 기능 관련 상태값
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('로그인 상태가 아닙니다.');
      return;
    }
    if (!newPassword) {
      toast.error('새 비밀번호를 입력해 주세요.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('비밀번호가 성공적으로 변경되었습니다!');
      setNewPassword('');
      setNewPasswordConfirm('');
      setPasswordFormOpen(false);
    } catch (err: any) {
      console.error('Password change failed:', err);
      if (err.code === 'auth/requires-recent-login') {
        toast.error('보안을 위해 로그아웃 후 다시 로그인하여 비밀번호를 변경해 주세요.');
      } else {
        toast.error(err.message || '비밀번호 변경에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // [Draft] Load from localStorage if exists
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      setUser(currentUser);
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserData(d);
          // 관리자 여부 확인
          const role = d?.role;
          setIsAdmin(role === 'admin' || role === 'super_admin');
          // 비회원 여부 확인
          setIsGuestUser(d?.isRegistered === false);
          
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
            avoidList: Array.isArray(d.avoidList) && d.avoidList.length > 0
              ? d.avoidList
              : [], // 기존 데이터는 마이그레이션 후 avoidList로 이관,
            idealType: d.idealType || '',
            nonIdealType: d.nonIdealType || '',
            smoking: d.smoking || '',
            drinking: d.drinking || '',
            religion: d.religion || '',
            drink: Array.isArray(d.drink) ? d.drink : (d.drink ? [d.drink] : []),
            etc: d.etc || '',
            employmentProof: d.employmentProof || d.verificationUrl || '',
          };

          // [Draft] Load from UNIFIED profile draft
          const savedDraft = localStorage.getItem(`kl_unified_profile_draft_${currentUser.uid}`);
          if (savedDraft) {
            try {
              const draft = JSON.parse(savedDraft);
              setEditForm({ ...initialForm, ...draft });
            } catch (e) {
              setEditForm(initialForm);
            }
          } else {
            setEditForm(initialForm);
          }

          setVerificationPreview(initialForm.employmentProof || '');
          
          const savedPhotos = d.photos || d.profilePhotos || [];
          const legacyFace = d.facePhotos || [];
          const legacyBody = d.bodyPhotos || [];
          const merged = savedPhotos.length > 0 ? savedPhotos : [...legacyFace, ...legacyBody].slice(0, 5);
          setPhotos(merged);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }

      const unsubApps = subscribeMyApplications(currentUser.uid, (apps) => {
        setApplications(apps);
        apps.forEach(async (app) => {
          if (sessionsMap[app.sessionId] === undefined) {
            subscribeSession(app.sessionId, (s) => {
              setSessionsMap(prev => ({ ...prev, [app.sessionId]: s || null }));
            });
          }
          if (app.status === 'confirmed') {
            const vote = await getMyVote(app.sessionId, currentUser.uid);
            if (vote) setHasVoted(true);
          }
        });
      });

      // v8.15.8: 1:1 매칭 신청 현황 조회
      const privateQ = query(collection(db, 'private_applications'), where('userId', '==', currentUser.uid));
      getDocs(privateQ).then(snap => {
        if (!snap.empty) {
          setPrivateApp(snap.docs[0].data());
        }
      });

      // v8.18.0: 보유 쿠폰 현황 조회
      const couponsQ = query(collection(db, 'users', currentUser.uid, 'coupons'), where('isUsed', '==', false));
      getDocs(couponsQ).then(snap => {
        const now = new Date();
        const coupons = snap.docs.map(cd => {
          const data = cd.data();
          let expireAt = data.expireAt || data.expiresAt;
          if (!expireAt && data.validityMonths && data.validityMonths !== 'unlimited' && data.createdAt) {
            const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            const exp = new Date(created);
            exp.setMonth(exp.getMonth() + Number(data.validityMonths));
            expireAt = exp;
          }
          let title = data.title || data.name || '할인 쿠폰';
          if (title === '가입 축하 5,000원 할인쿠폰') title = '웰컴 가입 축하 쿠폰';
          return { id: cd.id, ...data, expireAt, title };
        }).filter(c => {
          if (c.expireAt) {
            const exp = c.expireAt.toDate ? c.expireAt.toDate() : new Date(c.expireAt);
            return exp > now;
          }
          return true;
        });
        setUserCoupons(coupons);
      });

      return () => { unsubApps(); };
    });
    return () => unsubscribe();
  }, [router]);

  // [Draft] Auto-save to UNIFIED profile draft
  useEffect(() => {
    if (user && isEditing) {
      const timeout = setTimeout(() => {
        localStorage.setItem(`kl_unified_profile_draft_${user.uid}`, JSON.stringify(editForm));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [editForm, user, isEditing]);

  // v8.13.0: URL mode=edit 대응
  useEffect(() => {
    if (mode === 'edit') {
      setIsEditing(true);
    }
  }, [mode]);

  const handleSave = async () => {
    if (!editForm.name) return toast.error('성함을 입력해주세요.');
    if (!editForm.gender) return toast.error('성별을 선택해주세요.');
    if (!editForm.birthDate) return toast.error('생년월일을 입력해주세요.');
    if (!editForm.workplace) return toast.error('회사명 / 직무를 입력해주세요.');
    
    // v7.8.5: 재직 증명 필수 검사 해제 (선택사항으로 변경)
    // if (!verificationFile && !editForm.employmentProof) {
    //   return toast.error('재직 증명 서류를 업로드해 주세요.');
    // }

    // v5.1.0 추가 필수 항목 검사
    if (!editForm.phone) return toast.error('연락처를 입력해주세요.');
    if (!editForm.height) return toast.error('키를 입력해주세요.');
    if (!editForm.weight) return toast.error('몸무게를 입력해주세요.');
    if (!editForm.residence) return toast.error('거주지를 입력해주세요.');
    if (!editForm.smoking) return toast.error('흡연 유무를 선택해주세요.');
    if (!editForm.drinking) return toast.error('음주 빈도를 선택해주세요.');
    if (!editForm.religion) return toast.error('종교를 선택해주세요.');

    // 본인 사진 1장 이상 필수 검사
    if (photos.length === 0) {
      return toast.error('본인 사진을 최소 1장 이상 등록해주세요.');
    }

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

      // Sanitize editForm and explicitly set isJobReviewed to false for admin notification
      const sanitizedForm = Object.keys(editForm).reduce((acc: any, key) => {
        acc[key] = editForm[key] === undefined ? '' : editForm[key];
        return acc;
      }, {});
      sanitizedForm.isJobReviewed = false;

      // v8.15.3: 프로필 저장 시 항상 isJobReviewed=false → 관리자에게 알림/뱃지 표시
      // v9.1.0: 개인정보 수정 시 인증 상태 취소(승인 대기 전환) 및 변경 로깅 강화
      const newLogs = [];
      const changedAt = new Date().toISOString();

      if (userData?.name !== sanitizedForm.name) {
        newLogs.push({
          field: 'name',
          oldValue: userData?.name || '미입력',
          newValue: sanitizedForm.name || '미입력',
          changedAt
        });
      }

      if (userData?.gender !== sanitizedForm.gender) {
        newLogs.push({
          field: 'gender',
          oldValue: userData?.gender === 'male' ? '남성' : userData?.gender === 'female' ? '여성' : '미입력',
          newValue: sanitizedForm.gender === 'male' ? '남성' : sanitizedForm.gender === 'female' ? '여성' : '미입력',
          changedAt
        });
      }

      if (userData?.birthDate !== sanitizedForm.birthDate) {
        newLogs.push({
          field: 'birthDate',
          oldValue: userData?.birthDate || '미입력',
          newValue: sanitizedForm.birthDate || '미입력',
          changedAt
        });
      }

      if (userData?.phone !== sanitizedForm.phone) {
        newLogs.push({
          field: 'phone',
          oldValue: userData?.phone || '미입력',
          newValue: sanitizedForm.phone || '미입력',
          changedAt
        });
      }
      
      const oldWorkplace = userData?.workplace || userData?.jobRole || userData?.job || '미입력';
      const newWorkplace = sanitizedForm.workplace || '미입력';
      if (oldWorkplace !== newWorkplace) {
        newLogs.push({
          field: 'workplace',
          oldValue: oldWorkplace,
          newValue: newWorkplace,
          changedAt
        });
      }

      if (userData?.employmentProof !== finalVerificationUrl) {
        newLogs.push({
          field: 'employmentProof',
          oldValue: userData?.employmentProof ? '이전 재직 증명 서류' : '미입력',
          newValue: finalVerificationUrl ? '새로운 재직 증명 서류' : '삭제됨',
          changedAt
        });
      }

      const oldPhotos = userData?.photos || [];
      if (JSON.stringify(oldPhotos) !== JSON.stringify(uploadedUrls)) {
        newLogs.push({
          field: 'photos',
          oldValue: `이전 사진 ${oldPhotos.length}장`,
          newValue: `새로운 사진 ${uploadedUrls.length}장`,
          changedAt
        });
      }

      const hasCoreInfoChanged = newLogs.length > 0;
      let nextIsVerified = userData?.isVerified ?? false;
      let nextStatus = userData?.status ?? 'pending';

      if (hasCoreInfoChanged && userData?.isVerified) {
        nextIsVerified = false;
        nextStatus = 'pending';
        newLogs.push({
          field: 'verification_revoked',
          oldValue: '인증 완료',
          newValue: '개인정보 수정으로 인한 인증 취소 (재승인 대기)',
          changedAt
        });
      }

      if (newLogs.length === 0) {
        newLogs.push({ field: 'profile', changedAt });
      }

      const updateData: any = {
        ...sanitizedForm,
        photos: uploadedUrls,
        employmentProof: finalVerificationUrl,
        isVerified: nextIsVerified,
        status: nextStatus,
        avoidList: editForm.avoidList || [],
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

      if (hasCoreInfoChanged) {
        updateData.isJobReviewed = false;
      }
      updateData.user_logs = arrayUnion(...newLogs);

      console.log('Saving profile. Revoking isVerified and isJobReviewed if core info changed.');

      await updateDoc(doc(db, 'users', user!.uid), updateData);
      
      // Update local state
      setUserData((p: any) => ({ ...p, ...updateData }));
      setPhotos(uploadedUrls); // Update local state with URLs
      setIsEditing(false);
      
      // [Draft] Clear UNIFIED draft on success
      localStorage.removeItem(`kl_unified_profile_draft_${user!.uid}`);
      
      if (hasCoreInfoChanged && userData?.isVerified) {
        toast.success('개인정보가 변경되어 인증 상태가 승인 대기로 전환되었습니다. 관리자 확인 후 곧 재승인됩니다.');
      } else {
        toast.success('프로필 정보가 안전하게 업데이트되었습니다.');
      }
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
      toast.error(
        <span>
          앗, 시스템에 문제가 생겼나요? 현재 화면을 캡처해서 <b>인스타 DM</b>으로 보내주시면, 죄송하고 감사한 마음을 담아 <b>50% 할인쿠폰</b>을 드립니다!<br /><br />
          <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>[오류: {errorMessage}]</span>
        </span>,
        { duration: 8000 }
      );
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

  const formatBirthDate = (val: string) => {
    let digits = val.replace(/[^0-9]/g, '');
    if (digits.length > 2 && digits.length <= 4) {
      digits = digits.replace(/(\d{2})(\d{1,2})/, '$1-$2');
    } else if (digits.length > 4) {
      digits = digits.replace(/(\d{2})(\d{2})(\d{1,2})/, '$1-$2-$3');
    }
    return digits.substring(0, 8);
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
    
    if (file.size > 20 * 1024 * 1024) return toast.error('파일 크기는 20MB 이하여야 합니다.');
    
    setVerificationFile(file);
    setVerificationFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      if (file.type.startsWith('image/')) {
        setVerificationPreview(await compressImage(raw));
      } else {
        setVerificationPreview(raw);
      }
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

  /* ── 비회원 전용 간소 마이페이지 ── */
  const renderGuestView = () => (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }}>

          {/* 비회원 안내 배너 */}
          <div style={{ background: 'linear-gradient(135deg, #FF6F61, #ff8a7a)', borderRadius: '20px', padding: '24px', marginBottom: '20px', textAlign: 'center', color: '#fff' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: '700', opacity: 0.85, marginBottom: '6px' }}>비회원으로 신청하셨어요</p>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '4px' }}>안녕하세요, {userData?.name || '회원'}님 👋</h2>
            <p style={{ fontSize: '0.82rem', opacity: 0.8 }}>매칭 결과만 확인 가능합니다</p>
          </div>

          {/* 매칭 결과 (성공/실패만) */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
            <h3 style={{ fontWeight: '900', color: '#111', marginBottom: '16px', fontSize: '1rem' }}>📋 내 신청 현황</h3>
            {applications.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>신청 내역이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {applications.map(app => {
                  const session = sessionsMap[app.sessionId];
                  return (
                    <div key={app.id} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e8ecf0' }}>
                      <p style={{ fontWeight: '800', color: '#111', fontSize: '0.9rem', marginBottom: '4px' }}>{session?.title || app.sessionId}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: '800',
                          background: app.status === 'confirmed' ? '#DCFCE7' : app.status === 'applied' || app.status === 'selected' ? '#FEF9C3' : '#f1f5f9',
                          color: app.status === 'confirmed' ? '#166534' : app.status === 'applied' || app.status === 'selected' ? '#92400e' : '#64748b',
                        }}>
                          {app.status === 'confirmed' ? '✅ 신청확정' : app.status === 'applied' ? '⏳ 검토중' : app.status === 'selected' ? '⏳ 입금대기' : '취소됨'}
                        </span>
                        {app.status === 'confirmed' && (
                          <Link href={`/vote/${app.sessionId}`} style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: '800', background: '#FF6F61', color: '#fff', textDecoration: 'none' }}>
                            투표하기 →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 득표수 블러 처리 카드 */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', position: 'relative', overflow: 'hidden' }}>
            <h3 style={{ fontWeight: '900', color: '#111', marginBottom: '16px', fontSize: '1rem' }}>💕 호감 득표 현황</h3>
            {/* Fake content behind blur */}
            <div style={{ filter: 'blur(8px)', userSelect: 'none', pointerEvents: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: '40px', height: '40px', background: '#FFF0EE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>❤️</div>
                <div><p style={{ fontWeight: '800', color: '#111', fontSize: '0.9rem' }}>받은 하트</p><p style={{ color: '#FF6F61', fontWeight: '900', fontSize: '1.4rem' }}>7표</p></div>
              </div>
            </div>
            {/* Lock overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)' }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🔒</span>
              <p style={{ fontSize: '0.82rem', fontWeight: '800', color: '#555' }}>정식 가입 시 확인 가능</p>
            </div>
          </div>

          {/* 프로필 수정 (비회원) */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setIsEditing(true)}
              style={{ width: '100%', padding: '16px', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', fontWeight: '800', color: '#333', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6F61" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> 내 프로필 수정하기
            </button>
          </div>

          {/* 회원가입 유도 CTA */}
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '20px', padding: '28px 24px', textAlign: 'center', color: '#fff' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '8px' }}>정식 가입하고 혜택 받기</p>
            <p style={{ fontSize: '0.82rem', opacity: 0.85, marginBottom: '20px', lineHeight: 1.6 }}>
              득표수 확인 + 5,000원 할인 쿠폰 즉시 발급!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
                  if (!clientId) return;
                  const stateParam = user?.uid ? `upgrade_guest|${user.uid}` : 'upgrade_guest';
                  window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/kakao')}&response_type=code&state=${stateParam}`;
                }}
                style={{ padding: '14px', background: '#FEE500', border: 'none', borderRadius: '12px', fontWeight: '800', color: '#3c1e1e', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3c1e1e"><path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" /></svg>
                카카오로 1초 만에 가입하기
              </button>
              <Link href="/register" style={{ padding: '12px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', fontWeight: '700', color: '#fff', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center' }}>
                일반 회원가입
              </Link>
            </div>
          </div>

        </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9F8', paddingTop: '80px', paddingBottom: '60px' }}>
      
      {/* ─── EDIT MODAL (Synchronization with Application Form) ─── */}
      {isEditing && (
        <div className="edit-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditing(false); }}>
          <div className="edit-modal-panel">
            
            {/* [1] Fixed Header */}
            <div style={{ 
              padding: '24px 32px', 
              background: '#FFFFFF', 
              zIndex: 100, 
              borderBottom: '1px solid #FFF0EE',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>신뢰 기반 프로필 편집</h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>신청서와 동일한 정보를 관리하세요.</p>
              </div>
              <button onClick={() => setIsEditing(false)} style={{ background: '#FFF5F4', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={20} color="#FF6F61" />
              </button>
            </div>

            {/* [2] Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }} className="kl-scrollbar">


            {/* Photo Section (Unified v3.5.1) */}
            <div style={{ marginBottom: '40px' }}>
              <EditRow label={`본인 사진 업로드 (${photos.length}/5)`} required>
                <div style={{ background: '#FFFDFD', border: '1.5px dashed #FFDBE9', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                   <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '20px', fontWeight: '500' }}>
                    과도한 보정이나 마스크 착용 사진은 지양해주세요.<br/>
                    <strong style={{ color: '#FF6F61' }}>얼굴과 전신 사진이 포함되도록<br />자유롭게 총 5장까지 등록가능</strong>
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
              <input style={inputStyle} value={editForm.birthDate} onChange={e => setEditForm((p: any) => ({ ...p, birthDate: formatBirthDate(e.target.value) }))} placeholder="ex. 940530" />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(editForm.avoidList || []).map((entry: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      style={{ ...subInputStyle, flex: '2', minWidth: 0 }}
                      value={entry.name || ''}
                      onChange={e => setEditForm((p: any) => ({
                        ...p,
                        avoidList: p.avoidList.map((v: any, i: number) => i === idx ? { ...v, name: e.target.value } : v)
                      }))}
                      placeholder="이름 (ex. 김민수)"
                    />
                    <input
                      style={{ ...subInputStyle, flex: '1', minWidth: 0 }}
                      value={entry.birthYear || ''}
                      onChange={e => setEditForm((p: any) => ({
                        ...p,
                        avoidList: p.avoidList.map((v: any, i: number) => i === idx ? { ...v, birthYear: e.target.value } : v)
                      }))}
                      placeholder="97 (년생)"
                    />
                    <input
                      style={{ ...subInputStyle, flex: '2', minWidth: 0 }}
                      value={entry.workplace || ''}
                      onChange={e => setEditForm((p: any) => ({
                        ...p,
                        avoidList: p.avoidList.map((v: any, i: number) => i === idx ? { ...v, workplace: e.target.value } : v)
                      }))}
                      placeholder="직장 (ex. 토스)"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm((p: any) => ({ ...p, avoidList: p.avoidList.filter((_: any, i: number) => i !== idx) }))}
                      style={{ flexShrink: 0, background: '#FFF0EE', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FF6F61' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEditForm((p: any) => ({ ...p, avoidList: [...(p.avoidList || []), { name: '', birthYear: '', workplace: '' }] }))}
                  style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '10px', border: '1.5px dashed #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  + 추가
                </button>
              </div>
            </EditRow>

            <EditRow label="이상형 (최대 5가지)">
              <textarea style={textAreaStyle} value={editForm.idealType} onChange={e => setEditForm((p: any) => ({ ...p, idealType: e.target.value }))} placeholder={'ex) 자기관리하는, 비흡연, 173이상, 94~00년생 등 자유롭게 적어주세요.'} rows={3} />
            </EditRow>

            <EditRow label="비선호형 (최대 5가지)">
              <textarea style={textAreaStyle} value={editForm.nonIdealType} onChange={e => setEditForm((p: any) => ({ ...p, nonIdealType: e.target.value }))} placeholder={'ex) 키, 몸매, 흡연 및 음주여부, 경제력, 원하지 않는 나이대 등 자유롭게 적어주세요.'} rows={3} />
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
                {['아이스 아메리카노', '복숭아 아이스티', '얼그레이', '페퍼민트', '카라멜 블랙티', '물', '따뜻한 음료'].map(d => {
                  const currentDrinks = editForm.drink || [];
                  const selected = currentDrinks.includes(d);
                  
                  const MAIN_DRINKS = ['아이스 아메리카노', '복숭아 아이스티', '얼그레이', '페퍼민트', '카라멜 블랙티', '물'];
                  const hasIceOnlySelected = currentDrinks.some((v: string) => ['아이스 아메리카노', '복숭아 아이스티'].includes(v));
                  const isWarmDisabled = d === '따뜻한 음료' && hasIceOnlySelected;

                  return (
                    <button 
                      key={d} 
                      type="button"
                      disabled={isWarmDisabled}
                      onClick={() => {
                        if (isWarmDisabled) return;
                        let next: string[] = [];

                        if (MAIN_DRINKS.includes(d)) {
                          if (currentDrinks.includes(d)) {
                            next = currentDrinks.filter((v: string) => v !== d);
                          } else {
                            next = currentDrinks.filter((v: string) => !MAIN_DRINKS.includes(v));
                            next.push(d);
                            if (['아이스 아메리카노', '복숭아 아이스티'].includes(d)) {
                              next = next.filter((v: string) => v !== '따뜻한 음료');
                            }
                          }
                        } else if (d === '따뜻한 음료') {
                          if (currentDrinks.includes(d)) {
                            next = currentDrinks.filter((v: string) => v !== d);
                          } else {
                            next = [...currentDrinks, d];
                          }
                        }
                        setEditForm((p: any) => ({ ...p, drink: next }));
                      }}
                      style={{ 
                        padding: '10px 16px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: '700', 
                        cursor: isWarmDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                        background: selected ? '#FF6F61' : (isWarmDisabled ? '#F1F5F9' : '#fff'), 
                        color: selected ? '#fff' : (isWarmDisabled ? '#94A3B8' : '#64748B'), 
                        border: selected ? '1.5px solid #FF6F61' : (isWarmDisabled ? '1.5px solid #E2E8F0' : '1.5px solid #E2E8F0'),
                        opacity: isWarmDisabled ? 0.6 : 1
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
             <EditRow label="재직 증명 (선택)">
               <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                 <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                   <strong style={{ color: '#FF6F61' }}>지금 당장 서류가 없으신가요? 일단 비워두고 가입하셔도 됩니다! (행사 선발 후 제출 가능)</strong><br />
                   신뢰할 수 있는 모임을 위해 서류(재직증명서, 급여명세서, 건강보험, 사원증, 명함 등) 중 하나를 업로드해 주세요.
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

            </div>

            {/* [3] Fixed Footer */}
            <div style={{ 
              padding: '16px 24px calc(16px + env(safe-area-inset-bottom))', 
              background: '#FFFFFF', 
              borderTop: '1px solid #FFF0EE',
              display: 'flex', 
              gap: '12px',
              flexShrink: 0,
              zIndex: 100
            }}>
              <button 
                onClick={() => setIsEditing(false)} 
                disabled={isSaving} 
                style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1.5px solid #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                취소
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                style={{ 
                  flex: 2, 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: 'none', 
                  background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', 
                  color: '#fff', 
                  fontWeight: '900', 
                  cursor: 'pointer', 
                  fontSize: '1rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  boxShadow: '0 8px 20px rgba(255,111,97,0.25)',
                  whiteSpace: 'nowrap'
                }}
              >
                {isSaving ? '저장 중...' : <><Check size={18} /> 프로필 수정 완료</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGuestUser ? renderGuestView() : (
        <div style={{ maxWidth: '460px', margin: '0 auto', padding: '0 16px' }}>

        {/* ─── COUPON BOX ─── */}
        <div style={{ background: '#FFFFFF', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>🎟️</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111' }}>내 보유 쿠폰 <span style={{ color: '#FF6F61', marginLeft: '4px' }}>{userCoupons.length}장</span></h2>
          </div>
          
          {userCoupons.length === 0 ? (
            <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', fontWeight: '600' }}>현재 사용 가능한 쿠폰이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {userCoupons.map(coupon => {
                const expDate = coupon.expireAt?.toDate ? coupon.expireAt.toDate() : (coupon.expireAt ? new Date(coupon.expireAt) : null);
                const expString = expDate ? `${expDate.getFullYear()}.${String(expDate.getMonth()+1).padStart(2, '0')}.${String(expDate.getDate()).padStart(2, '0')} 까지` : '기한 없음';
                
                return (
                  <div key={coupon.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', background: '#FFFDFD', border: '1.5px dashed #FFDBE9', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: '-8px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', borderRight: '1.5px dashed #FFDBE9', zIndex: 1 }} />
                    <div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', borderLeft: '1.5px dashed #FFDBE9', zIndex: 1 }} />
                    
                    <div style={{ paddingLeft: '12px', zIndex: 2 }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: '800', color: '#111', marginBottom: '4px' }}>{coupon.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontSize: '0.8rem', color: '#FF6F61', fontWeight: '800' }}>
                          {coupon.type === 'percent' ? `${coupon.value || coupon.amount}% 할인` :
                           coupon.type === 'free' ? '100% 무료' :
                           `${(coupon.value || coupon.amount || 0).toLocaleString()}원 할인`}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: '#9CA3B8', fontWeight: '500' }}>| {expString}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── PROFILE CARD ─── */}
        <div style={{ background: '#FFFFFF', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '16px' }}>

          {/* Title bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 0' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--color-text-primary)' }}>나의 프로필</h2>
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
              <span style={{ minWidth: '90px', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: '600', flexShrink: 0 }}>인증 상태</span>
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

          {/* Accordion Toggle (Refined Design) */}
          <div style={{ padding: '0 24px 20px' }}>
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: expanded ? '#FFF5F4' : '#FFFFFF', 
                border: expanded ? '1px solid #FFDBE9' : '1px solid #FFE8E5',
                color: '#FF6F61', 
                fontWeight: '800', 
                fontSize: '0.9rem', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                borderRadius: '16px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: expanded ? 'none' : '0 4px 12px rgba(255,111,97,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,111,97,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = expanded ? 'none' : '0 4px 12px rgba(255,111,97,0.05)';
              }}
            >
              {expanded ? <><ChevronUp size={18} /> 상세 정보 접기</> : <><ChevronDown size={18} /> 전체 정보 펼쳐보기</>}
            </button>
          </div>

          {/* === ACCORDION CONTENT === */}
          {expanded && (
            <div style={{ padding: '0 24px 24px', borderTop: '1px solid #FFF0EE' }}>
              <div style={{ marginTop: '8px' }}>
                <InfoRow label="연락처" value={userData?.phone} />
                <InfoRow label="인스타그램" value={userData?.instaId} />
                <InfoRow label="거주지" value={userData?.residence} />
                <InfoRow label="회사명/직무" value={userData?.admin_job || userData?.job || userData?.workplace} />
                {userData?.avoidList && userData.avoidList.length > 0 ? (
                  <div style={{ display: 'flex', borderBottom: '1px solid #FFF0EE', padding: '14px 0', gap: '12px' }}>
                    <span style={{ minWidth: '90px', fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: '600', flexShrink: 0 }}>지인 회피</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {userData.avoidList.map((entry: any, i: number) => (
                        <span key={i} style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
                          {[entry.name, entry.birthYear ? `${entry.birthYear}년생` : '', entry.workplace].filter(Boolean).join(' · ')}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <InfoRow label="지인 회피" value={userData?.avoidAcquaintance} />
                )}
                <InfoRow label="음주 빈도" value={userData?.drinking} />
                <InfoRow label="흡연 유무" value={userData?.smoking} />
                <InfoRow label="종교" value={userData?.religion} />
                <InfoRow label="희망 음료" value={userData?.drink} />
                <InfoRow label="이상형" value={userData?.idealType} />
                <InfoRow label="비선호형" value={userData?.nonIdealType} />
                <div style={{ borderBottom: '1px solid #FFF0EE', padding: '16px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>기타 / 특이사항</span>
                  <span style={{ fontSize: '0.9rem', color: userData?.etc ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: userData?.etc ? '700' : '400', fontStyle: !userData?.etc ? 'italic' : 'normal', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {userData?.etc || EMPTY}
                  </span>
                </div>

                {/* Consolidated Photo Gallery */}
                <div style={{ paddingTop: '20px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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

        {/* ─── 매칭 결과 목록 이동 버튼 ─── */}
        <Link
          href="/matching-results"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#FFFFFF', borderRadius: '24px', padding: '20px 24px',
            boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5',
            textDecoration: 'none', marginBottom: '12px', transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#FFFAFA'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#FFF0EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={22} color="#FF6F61" fill="#FF6F61" />
            </div>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--color-text-primary)', marginBottom: '2px' }}>내 매칭 결과 히스토리</p>
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF', fontWeight: '600' }}>참여 기수별 결과 모아보기</p>
            </div>
          </div>
          <ChevronRight size={20} color="#CBD5E1" />
        </Link>

        {/* v8.12.7: 1:1 매칭 서비스 유도 블록 */}
        <Link 
          href={privateApp?.status === 'pending_consult' ? "/private-matching/apply?mode=edit" : "/private-matching"} 
          style={{ 
            marginBottom: '20px', 
            display: 'flex', 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '12px',
            background: 'linear-gradient(135deg, #6A4C93, #8E54E9)', 
            padding: '16px 24px', 
            borderRadius: '24px', 
            border: 'none',
            color: '#fff',
            textDecoration: 'none',
            boxShadow: '0 8px 25px rgba(106, 76, 147, 0.2)',
            transition: 'transform 0.2s',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '2px', letterSpacing: '-0.02em' }}>1:1 프라이빗 매칭 서비스</h3>
            <p style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: '500', lineHeight: 1.3 }}>
              {privateApp?.status === 'pending_consult' ? '현재 상담 대기 중입니다. 내용을 수정할 수 있어요.' : '가입비 0원, 지금 신청 시 무료 매칭'}
            </p>
          </div>
          <div style={{ background: '#fff', color: '#6A4C93', padding: '8px 14px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {privateApp?.status === 'pending_consult' ? (
              <><Edit3 size={14} /> 수정하기</>
            ) : (
              <>신청 <ArrowRight size={14} /></>
            )}
          </div>
        </Link>

        {/* ─── v8.1.7: 신청 현황 상태 블록 (다중 카드 지원) ─── */}
        <ApplicationStatusSection
          applications={applications}
          sessionsMap={sessionsMap}
          userId={user?.uid || ''}
          isAdmin={isAdmin}
        />

        {/* ─── v12.2.0: 비밀번호 변경 기능 (이메일 로그인 회원 전용) ─── */}
        {userData?.provider === 'email' && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: '0 10px 40px rgba(255,111,97,0.06)',
            border: '1px solid #FFE8E5',
            marginBottom: '16px',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
          }}>
            <button
              onClick={() => setPasswordFormOpen(!passwordFormOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFF5F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={18} color="#FF6F61" />
                </div>
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '2px' }}>비밀번호 변경</p>
                  <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: '500' }}>안전하게 내 비밀번호 수정하기</p>
                </div>
              </div>
              {passwordFormOpen ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
            </button>

            {passwordFormOpen && (
              <form onSubmit={handlePasswordChange} style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid #FFF0EE', paddingTop: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#FF6F61', fontWeight: '800', marginBottom: '6px' }}>새 비밀번호</label>
                  <input
                    type="password"
                    placeholder="새 비밀번호 (6자리 이상)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #FFE8E5',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#FF6F61'}
                    onBlur={e => e.target.style.borderColor = '#FFE8E5'}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#FF6F61', fontWeight: '800', marginBottom: '6px' }}>새 비밀번호 확인</label>
                  <input
                    type="password"
                    placeholder="새 비밀번호 다시 입력"
                    value={newPasswordConfirm}
                    onChange={e => setNewPasswordConfirm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #FFE8E5',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#FF6F61'}
                    onBlur={e => e.target.style.borderColor = '#FFE8E5'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '100px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #FF8E8E, #FF6F61)',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(255, 111, 97, 0.2)',
                    transition: 'transform 0.2s',
                    marginTop: '8px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {isChangingPassword ? '변경하는 중...' : '비밀번호 변경 완료'}
                </button>
              </form>
            )}
          </div>
        )}

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
      )}

      <style>{`
        .kl-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .kl-scrollbar::-webkit-scrollbar-track { background: #fdfdfd; }
        .kl-scrollbar::-webkit-scrollbar-thumb { background: #FFDBE9; borderRadius: 4px; }
        .edit-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .edit-modal-panel {
          background: #FFFFFF;
          width: 100%;
          max-width: 540px;
          height: 100%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          position: relative;
        }
        @media (max-width: 640px) {
          .edit-modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }
          .edit-modal-panel {
            max-height: 100vh;
            height: 100vh;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFAF9' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '3px solid #FFDBE9', borderTop: '3px solid #FF6F61', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <p style={{ color: '#FF6F61', fontWeight: '700' }}>정보를 불러오는 중...</p>
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <MyPageContent />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// v8.1.7 ApplicationStatusSection — 다중 카드 렌더링 지원
// ─────────────────────────────────────────────────────────────────────────────
interface StatusBlockProps {
  application: Application | null;
  session: Session | null;
  userId: string;
  hasVoted: boolean;
  submittedAt?: Date | null; // 투표 제출 시각 추가
}

function ApplicationStatusSection({ applications, sessionsMap, userId, isAdmin = false }: { applications: Application[], sessionsMap: Record<string, Session | null>, userId: string, isAdmin?: boolean }) {
  const [votedMap, setVotedMap] = useState<Record<string, { voted: boolean; submittedAt?: Date | null }>>({});

  // 테스트 기수 신청서 필터링 (isTest: true 인 세션은 관리자가 아닌 경우에만 제외)
  // + confirmed 상태이고 행사일 기준 7일이 지난 앱은 메인에서 숨김 처리
  const visibleApps = applications.filter(app => {
    const s = sessionsMap[app.sessionId];
    
    // 세션 정보가 존재하지 않음 (삭제된 기수)
    if (s === null) return false;

    if (isAdmin) return true; // 관리자는 테스트 기수 신청서도 표시
    if (s?.isTest) return false;

    // confirmed 앱은 행사일 기준 7일 이후 메인에서 숨김
    if (app.status === 'confirmed' && s?.eventDate) {
      const ed = s.eventDate;
      const eventDate = ed instanceof Date ? ed : (ed as any)?.toDate?.() || new Date(ed);
      const isSevenDaysOver = Date.now() > eventDate.getTime() + 7 * 24 * 60 * 60 * 1000;
      if (isSevenDaysOver) return false;
    }

    // 선발이 안 된(취소/검토중) 상태인데 행사가 이미 지나버렸다면(24시간) 숨김 처리
    if (app.status !== 'confirmed' && s?.eventDate) {
      const ed = s.eventDate;
      const eventDate = ed instanceof Date ? ed : (ed as any)?.toDate?.() || new Date(ed);
      const isOver = Date.now() > eventDate.getTime() + 24 * 60 * 60 * 1000;
      if (isOver) return false;
    }

    return true;
  });

  useEffect(() => {
    visibleApps.forEach(async (app) => {
      if (app.status === 'confirmed' && votedMap[app.sessionId] === undefined) {
        const vote = await getMyVote(app.sessionId, userId);
        setVotedMap(prev => ({ 
          ...prev, 
          [app.sessionId]: { 
            voted: !!vote, 
            submittedAt: vote ? vote.submittedAt : null 
          } 
        }));
      }
    });
  }, [visibleApps, userId]);

  if (visibleApps.length === 0) {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 40px rgba(255,111,97,0.08)', border: '1px solid #FFE8E5', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #FFF0EE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} color="#FF6F61" />
            <span style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--color-text-primary)' }}>참여 신청 현황</span>
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
  const confirmedApps = visibleApps
    .filter(a => {
      if (a.status !== 'confirmed') return false;
      const session = sessionsMap[a.sessionId];
      if (!session) return true;
      
      const ed = session.eventDate;
      if (!ed) return true;
      
      const eventDate = ed instanceof Date ? ed : (ed as any)?.toDate?.() || new Date(ed);
      // 행사가 시작된 지 24시간이 지났는지 확인 (완전히 종료된 행사)
      const isCompletelyOver = Date.now() > eventDate.getTime() + 24 * 60 * 60 * 1000;
      
      if (isCompletelyOver) {
        // 완전히 종료된 행사인데 출석(present)이나 지각(late) 처리가 없다면 미참여로 간주
        if (a.attendanceStatus !== 'present' && a.attendanceStatus !== 'late') {
          return false;
        }
      }

      // 행사가 시작된 지 7일이 지났는지 확인 (메인 화면에서 숨김 처리)
      const isSevenDaysOver = Date.now() > eventDate.getTime() + 7 * 24 * 60 * 60 * 1000;
      if (isSevenDaysOver) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const edA = sessionsMap[a.sessionId]?.eventDate;
      const edB = sessionsMap[b.sessionId]?.eventDate;
      const dateA = edA instanceof Date ? edA.getTime() : (edA as any)?.toMillis?.() || (edA ? new Date(edA).getTime() : 0);
      const dateB = edB instanceof Date ? edB.getTime() : (edB as any)?.toMillis?.() || (edB ? new Date(edB).getTime() : 0);
      return dateA - dateB;
    });

  const inProgressApps = visibleApps
    .filter(a => {
      if (a.status !== 'applied' && a.status !== 'selected') return false;
      
      const ed = sessionsMap[a.sessionId]?.eventDate;
      if (!ed) return true;
      
      const eventDate = ed instanceof Date ? ed : (ed as any)?.toDate?.() || new Date(ed);
      
      // 이미 시작되었거나 종료된 행사인데 아직도 확정(confirmed)이 아니라면 미선발로 간주하고 숨김 처리
      if (Date.now() > eventDate.getTime()) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // 1. 상태 기준 정렬 (selected가 먼저 오도록)
      if (a.status === 'selected' && b.status !== 'selected') return -1;
      if (a.status !== 'selected' && b.status === 'selected') return 1;

      // 2. 같은 상태라면 행사일 기준 오름차순 (가까운 행사일 먼저)
      const edA = sessionsMap[a.sessionId]?.eventDate;
      const edB = sessionsMap[b.sessionId]?.eventDate;
      const dateA = edA instanceof Date ? edA.getTime() : (edA as any)?.toMillis?.() || (edA ? new Date(edA).getTime() : 0);
      const dateB = edB instanceof Date ? edB.getTime() : (edB as any)?.toMillis?.() || (edB ? new Date(edB).getTime() : 0);
      return dateA - dateB;
    });

  const appsToDisplay = [...confirmedApps, ...inProgressApps];

  // 2. 확정되거나 진행 중인 항목이 있다면 모두 출력
  if (appsToDisplay.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        {appsToDisplay.map(app => (
          <ApplicationStatusBlock
            key={app.id}
            application={app}
            session={sessionsMap[app.sessionId]}
            userId={userId}
            hasVoted={votedMap[app.sessionId]?.voted || false}
            submittedAt={votedMap[app.sessionId]?.submittedAt || null}
          />
        ))}
      </div>
    );
  }

  // 4. 진행 중인 것도 없다면 취소된 가장 최근 항목 하나 출력
  const latestApp = visibleApps[0];
  return (
    <ApplicationStatusBlock
      application={latestApp}
      session={sessionsMap[latestApp.sessionId]}
      userId={userId}
      hasVoted={votedMap[latestApp.sessionId]?.voted || false}
      submittedAt={votedMap[latestApp.sessionId]?.submittedAt || null}
    />
  );
}

function ApplicationStatusBlock({ application, session, userId, hasVoted, submittedAt }: StatusBlockProps) {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

  useEffect(() => {
    if (!hasVoted || !submittedAt) return;

    // 투표 제출 후 20분 만료 시각 계산 (20분 * 60초 * 1000밀리초)
    const limitTime = new Date(submittedAt).getTime() + 20 * 60 * 1000;
    
    const updateTimer = () => {
      const diff = limitTime - Date.now();
      setTimeLeftMs(diff > 0 ? diff : 0);
    };

    updateTimer(); // 즉시 틱
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [hasVoted, submittedAt]);

  const formatTimeLeft = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}분 ${secs}초`;
  };

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
    : '삭제된 기수';
  
  const sessionDateStr = session ? (() => {
    const d = session.eventDate instanceof Date ? session.eventDate : (session.eventDate as any).toDate();
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  })() : null;

  const sessionVenue = session?.venue || null;

  // 2) 검토중 (applied)
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
            <p style={{ color: '#5B21B6', fontWeight: '900', fontSize: '1rem', marginBottom: '4px' }}>선발되셨습니다!</p>
            <p style={{ color: '#6D28D9', fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.6 }}>
              아래 계좌로 참가비를 입금해 주시면 참가 확정이 완료됩니다.
            </p>
          </div>
          <div style={{ background: '#FFFBEB', borderRadius: '16px', padding: '20px', border: '1px solid #FCD34D' }}>
            <p style={{ color: '#92400E', fontWeight: '700', fontSize: '0.82rem', marginBottom: '12px' }}>📌 입금 안내</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                ['은행', '카카오뱅크'],
                ['계좌', '3333-35-9229548'],
                ['예금주', '태영훈(키링크)'],
                ['금액', `${(application.price || (application.gender === 'female' ? 29000 : 49000)).toLocaleString()}원`]
              ].map(([label, val]) => (
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
    // 행사 당일 해당 시간이 지나면 자동으로 투표 활성화
    const isEventTimeStarted = session ? (() => {
      const d = session.eventDate instanceof Date ? session.eventDate : (session.eventDate as any).toDate();
      return Date.now() >= d.getTime();
    })() : false;

    const isVotingActive = isEventTimeStarted || session?.status === 'voting';
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
          {session?.status !== 'completed' && (
            hasVoted ? (
            timeLeftMs > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
                <div style={{ 
                  padding: '16px 20px', 
                  background: '#ECFDF5', 
                  border: '1.5px solid #A7F3D0', 
                  borderRadius: '18px', 
                  color: '#065F46', 
                  fontWeight: '800', 
                  fontSize: '0.85rem', 
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.05)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#047857' }}>
                    <CheckCircle2 size={16} color="#10B981" /> 투표를 완료하셨습니다!
                  </span>
                  {timeLeftMs > 0 && (
                    <span style={{ color: '#E11D48', fontWeight: '900', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#FFF1F2', padding: '3px 10px', borderRadius: '100px', border: '1px solid #FFE4E6' }}>
                      ⏱️ {formatTimeLeft(timeLeftMs)} 내 수정 가능
                    </span>
                  )}
                </div>
                <Link 
                  href={`/vote/${application.sessionId}?edit=true`} 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    padding: '14px 36px', 
                    borderRadius: '100px', 
                    background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', 
                    color: '#fff', 
                    fontWeight: '900', 
                    fontSize: '0.9rem', 
                    textDecoration: 'none', 
                    boxShadow: '0 6px 20px rgba(255,111,97,0.22)', 
                    width: '100%', 
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1.5px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  📝 제출한 투표 수정하러 가기
                </Link>
              </div>
            ) : (
              <div style={{ 
                padding: '18px 20px', 
                background: '#F8FAFC', 
                borderRadius: '18px', 
                border: '1.5px solid #E2E8F0',
                color: '#475569', 
                fontWeight: '800', 
                fontSize: '0.88rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                alignItems: 'center',
                width: '100%'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ✅ 투표를 최종 완료하셨습니다.
                </span>
                <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: '600' }}>
                  제출 후 30분 초과로 투표가 마감되었습니다.
                </span>
              </div>
            )
          ) : canVote ? (
            <Link href={`/vote/${application.sessionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 36px', borderRadius: '100px', background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)', color: '#fff', fontWeight: '800', fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 8px 20px rgba(255,111,97,0.3)' }}>
              <VoteIcon size={20} /> 상대방 투표하러 가기
            </Link>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 28px', borderRadius: '14px', background: '#F3F4F6', color: '#9CA3AF', fontWeight: '700', fontSize: '0.85rem' }}>
                <Lock size={16} /> 행사 당일에 투표가 활성화됩니다
              </div>
              {session?.eventDate && (
                <CountdownTimer targetDate={session.eventDate instanceof Date ? session.eventDate : (session.eventDate as any).toDate()} />
              )}
            </div>
          ))}

          {/* v8.1.7: 나에게 도착한 호감 (발표 시 노출) */}
          {session?.status === 'completed' && (
            <div style={{
              marginTop: '24px',
              padding: '28px 24px',
              background: 'linear-gradient(135deg, #FFF5F4, #FFF0EE)',
              borderRadius: '20px',
              border: '1.5px solid #FFD3CD',
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(255,111,97,0.06)'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 16px rgba(255,111,97,0.2)'
              }}>
                <Heart size={24} color="#FFF" fill="#FFF" />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#1E293B', marginBottom: '8px' }}>
                매칭 결과가 발표되었습니다!
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600', lineHeight: 1.6, marginBottom: '20px', wordBreak: 'keep-all' }}>
                오늘 소개팅에서 탄생한 기적 같은 인연과,<br />
                나에게 도착한 총 호감 득표 수를<br />
                지금 바로 확인해 보세요! ✨
              </p>
              <Link
                href={`/matching-results/${session.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 32px',
                  borderRadius: '100px',
                  background: 'linear-gradient(135deg, #FF6F61, #FF9A9E)',
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  boxShadow: '0 6px 16px rgba(255,111,97,0.25)',
                  transition: 'all 0.2s',
                  marginBottom: '12px'
                }}
              >
                내 매칭 결과 확인하기 →
              </Link>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginTop: '4px',
                padding: '10px 14px',
                background: 'rgba(255,111,97,0.05)',
                borderRadius: '12px',
                border: '1px dashed rgba(255,111,97,0.2)',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: '0.8rem', flexShrink: 0, lineHeight: 1 }}>🗓️</span>
                <p style={{ fontSize: '0.73rem', color: '#94A3B8', fontWeight: '600', lineHeight: 1.6, margin: 0 }}>
                  <strong style={{ color: '#FF9A9E', fontWeight: '800' }}>7일 후</strong>부터는<br />
                  히스토리에서만 확인 가능합니다.
                </p>
              </div>
              {(() => {
                const d = session?.eventDate instanceof Date ? session.eventDate : (session?.eventDate as any)?.toDate?.();
                if (d && d.getHours() === 20) {
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      marginTop: '8px',
                      padding: '10px 14px',
                      background: 'rgba(255,111,97,0.05)',
                      borderRadius: '12px',
                      border: '1px dashed rgba(255,111,97,0.2)',
                      textAlign: 'left',
                    }}>
                      <span style={{ fontSize: '0.8rem', flexShrink: 0, lineHeight: 1 }}>🌙</span>
                      <p style={{ fontSize: '0.73rem', color: '#94A3B8', fontWeight: '600', lineHeight: 1.6, margin: 0 }}>
                        20시 기수는 종료 시간이 늦어,<br />
                        매칭 성공 시 카카오톡 연결은<br />
                        <strong style={{ color: '#FF9A9E', fontWeight: '800' }}>다음날 오전 중</strong>에 진행됩니다.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

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

// v8.1.7 ReceivedHeartsFeed — 나를 선택한 이성 정보 및 맞호감 표시
// ─────────────────────────────────────────────────────────────────────────────
function ReceivedHeartsFeed({ session, userId }: { session: Session, userId: string }) {
  const [voters, setVoters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myVote, setMyVote] = useState<Vote | null>(null);

  useEffect(() => {
    async function loadHearts() {
      try {
        const [received, mine] = await Promise.all([
          getVotesReceivedByMe(session.id, userId),
          getMyVote(session.id, userId)
        ]);
        
        setMyVote(mine);

        const profiles = await Promise.all(received.map(async (v) => {
          const [userSnap, appSnap] = await Promise.all([
            getDoc(doc(db, 'users', v.userId)),
            getDocs(query(collection(db, 'applications'), where('userId', '==', v.userId), where('sessionId', '==', session.id), where('status', '==', 'confirmed')))
          ]);
          const appData = !appSnap.empty ? appSnap.docs[0].data() : {};
          return { id: v.userId, voteData: v, ...(userSnap.data() || {}), gender: appData.gender, slotNumber: appData.slotNumber };
        }));

        setVoters(profiles);
      } catch (e) {
        console.error('Error loading hearts:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHearts();
  }, [session.id, userId]);

  if (loading) return <div style={{ padding: '20px', color: '#FF6F61', fontSize: '0.8rem', textAlign: 'center' }}>호감 데이터를 불러오는 중...</div>;

  // v8.1.7: 결과 공개 로직 필터링
  const visibility = session.voteConfig?.resultVisibility || 'all';
  const filteredVoters = visibility === 'mutual'
    ? voters.filter(v => myVote?.choices.some(c => c.targetUserId === v.id))
    : voters;
  // 맞호감 먼저, 나머지 아래
  const displayedVoters = [...filteredVoters].sort((a, b) => {
    const aMutual = myVote?.choices.some(c => c.targetUserId === a.id) ? 0 : 1;
    const bMutual = myVote?.choices.some(c => c.targetUserId === b.id) ? 0 : 1;
    return aMutual - bMutual;
  });

  if (displayedVoters.length === 0) return (
    <div style={{ marginTop: '24px', padding: '24px', background: '#F8FAFC', borderRadius: '18px', textAlign: 'center' }}>
      <p style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: '600' }}>아쉽게도 이번 기수에는 나를 선택한 분이 없네요.</p>
      <p style={{ color: '#CBD5E1', fontSize: '0.75rem', marginTop: '4px' }}>다음 번에는 더 멋진 인연이 기다리고 있을 거예요!</p>
    </div>
  );

  return (
    <div style={{ marginTop: '24px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Heart size={18} color="#FF6F61" fill="#FF6F61" />
        <h3 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#334155' }}>나에게 도착한 호감 <span style={{ color: '#FF6F61' }}>{displayedVoters.length}개</span></h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displayedVoters.map(voter => {
          const isMutual = myVote?.choices.some(c => c.targetUserId === voter.id);
          // 본인이 익명 모드면 나에게 온 호감도 무조건 익명 처리
          const isAnonymous = voter.voteData?.disclosureMode === 'anonymous' || myVote?.disclosureMode === 'anonymous';

          // 실명 대신 호수 공개, 맞호감+익명이면 호수 표시
          const genderPrefix = voter.gender === 'male' ? '키링남' : voter.gender === 'female' ? '키링녀' : '';
          const slotLabel = voter.slotNumber ? `${genderPrefix} ${voter.slotNumber}호` : '익명';
          const displayName = isAnonymous
            ? (isMutual && voter.slotNumber ? slotLabel : '익명')
            : (voter.voteData?.myAlias || '공개');
          const displayPhoto = isAnonymous ? '/images/placeholder-user.png' : ((voter.photos && voter.photos[0]) || '/images/placeholder-user.png');
          const displaySubtext = '';

          return (
            <div key={voter.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: isMutual ? '#FFF5F4' : '#fff', padding: '12px 16px', borderRadius: '16px', border: isMutual ? '1.5px solid #FFDBE9' : '1.5px solid #F1F5F9', boxShadow: isMutual ? '0 4px 12px rgba(255,111,97,0.1)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1E293B' }}>{displayName}</span>
                  {isMutual && (
                    <span style={{ fontSize: '0.7rem', fontWeight: '900', background: '#FF6F61', color: '#fff', padding: '3px 8px', borderRadius: '6px', letterSpacing: '-0.02em' }}>매칭 성공</span>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>{displaySubtext}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CountdownTimer — 투표 활성화까지 남은 시간 표시
// ─────────────────────────────────────────────────────────────────────────────
function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const target = new Date(targetDate);
    // target.setHours(0, 0, 0, 0); 제거 (실제 행사 시간 기준 타이머)

    const updateTimer = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft(''); 
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      if (d > 0) {
        setTimeLeft(`${d}일 ${h}시간 ${m}분 남음`);
      } else {
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} 남음`);
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#FF6F61', fontWeight: '800', background: '#FFF5F4', padding: '8px 16px', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      ⏳ 투표 오픈까지 {timeLeft}
    </div>
  );
}
