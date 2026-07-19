'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db, auth, storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import {
  collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp, getDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import {
  signInAnonymously, GoogleAuthProvider, signInWithPopup, onAuthStateChanged
} from 'firebase/auth';
import {
  ChevronLeft, ChevronRight, Check, Heart, Calendar, User, Phone, MapPin, Briefcase, Star, X, Loader2, ChevronDown, FileText, CheckCircle2, Upload, Eye, EyeOff, CheckSquare, Square, CheckCircle, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { compressImage } from '@/lib/utils';
import { EventCalendar } from '@/components/EventsSection';
import { KeylinkEvent } from '@/types';

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface RecruitingSession {
  id: string;
  title: string;
  eventDate: Date;
  location?: string;
  ageRange?: string;
  maxParticipants?: number;
  price?: number;
  targetMaleAge?: string;
  isTest?: boolean;
  malePrice?: number;
  femalePrice?: number;
  femaleGroupPrice?: number;
  maleSafePrice?: number;
  isCustomCuration?: boolean;
}

interface FormData {
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  instaId: string;
  height: string;
  weight: string;
  residence: string;
  workplace: string;
  avoidList: { name: string; birthYear: string; workplace: string }[];
  idealType: string;
  nonIdealType: string;
  smoking: string;
  drinking: string;
  religion: string;
  drink: string[];
  etc: string;
  employmentProof: string;
}

type ProviderType = 'kakao' | 'google' | 'email' | null;

/* ─────────────────────────────────────────
   Utility
───────────────────────────────────────── */
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatKorDate(date: Date): string {
  const d = date.getDay();
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS[d]}) ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
function FastApplyContent({ initialSessions }: { initialSessions?: any[] }) {
  // ── Pre-process Initial Sessions ──
  const mappedSessions = (initialSessions || []).map(s => ({
    ...s,
    eventDate: new Date(s.eventDateStr || s.eventDate)
  }));

  // ── Calendar state ──
  const [calendarYear, setCalendarYear] = useState(mappedSessions.length > 0 ? mappedSessions[0].eventDate.getFullYear() : new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(mappedSessions.length > 0 ? mappedSessions[0].eventDate.getMonth() : new Date().getMonth());
  const [sessions, setSessions] = useState<RecruitingSession[]>(mappedSessions);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [loadingSessions, setLoadingSessions] = useState(mappedSessions.length === 0);
  const sessionListRef = useRef<HTMLDivElement>(null);

  // ── Helper: Upload Base64 to Storage ──
  const uploadBase64Photos = async (uid: string, photosBase64: string[], proofBase64?: string) => {
    let newPhotos = [...photosBase64];
    let newProof = proofBase64 || '';
    
    const promises = newPhotos.map(async (photo, i) => {
      if (photo.startsWith('data:image')) {
        const path = `applications/${uid}/photo_${Date.now()}_${i}.jpg`;
        const storageRef = ref(storage, path);
        await uploadString(storageRef, photo, 'data_url');
        newPhotos[i] = await getDownloadURL(storageRef);
      }
    });
    
    if (newProof && newProof.startsWith('data:image')) {
      promises.push((async () => {
        const path = `applications/${uid}/proof_${Date.now()}.jpg`;
        const storageRef = ref(storage, path);
        await uploadString(storageRef, newProof, 'data_url');
        newProof = await getDownloadURL(storageRef);
      })());
    }
    
    await Promise.all(promises);
    return { uploadedPhotos: newPhotos, uploadedProof: newProof };
  };

  // ── Form state ──
  const [form, setForm] = useState<FormData>({
    name: '', gender: '', birthDate: '', phone: '', instaId: '',
    height: '', weight: '', residence: '', workplace: '', avoidList: [],
    idealType: '', nonIdealType: '', smoking: '', drinking: '', religion: '', drink: [],
    etc: '', employmentProof: '',
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const verifyInputRef = useRef<HTMLInputElement>(null);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<string>('');
  const [verificationFileName, setVerificationFileName] = useState('');

  // ── Submission state ──
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedData, setSavedData] = useState<{
    formData: FormData;
    sessionIds: string[];
    photos?: string[];
    maleOption?: string;
    femaleOption?: string;
    groupPartnerName?: string;
    groupPartnerBirthYear?: string;
    selectedCouponId?: string | null;
    selectedCouponTitle?: string | null;
    couponDiscount?: number;
  } | null>(null);

  // ── Male & Female matching option ──
  const [maleOption, setMaleOption] = useState<'normal' | 'safe'>('normal');
  const [femaleOption, setFemaleOption] = useState<'normal' | 'group'>('normal');
  const [groupPartnerName, setGroupPartnerName] = useState('');
  const [groupPartnerBirthYear, setGroupPartnerBirthYear] = useState('');

  // ── Coupon state ──
  const [userCoupons, setUserCoupons] = useState<any[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);

  // ── Duplicate account modal ──
  const [dupModal, setDupModal] = useState<{ provider: ProviderType; phone: string } | null>(null);

  // ── Signup funnel modal ──
  const [funnelModal, setFunnelModal] = useState(false);
  const [nonMemberWarning, setNonMemberWarning] = useState(false);

  // ── Agreements state ──
  const [showRefundPolicy, setShowRefundPolicy] = useState(false);
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    thirdParty: false,
    refund: false,
    marketing: false,
  });
  // ── Auth state ──
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorFields, setErrorFields] = useState<string[]>([]);

  // 폼 값 변경 시 에러 초기화
  useEffect(() => {
    if (errorFields.length > 0) setErrorFields([]);
  }, [form, agreements, selectedSessionIds, photos]);

  const isAllAgreed = currentUser 
    ? agreements.refund 
    : (agreements.terms && agreements.privacy && agreements.thirdParty && agreements.refund && agreements.marketing);

  const toggleAllAgreements = () => {
    const nextVal = !isAllAgreed;
    if (currentUser) {
      setAgreements(a => ({ ...a, refund: nextVal }));
    } else {
      setAgreements({ terms: nextVal, privacy: nextVal, thirdParty: nextVal, refund: nextVal, marketing: nextVal });
    }
  };
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [showGuestPin, setShowGuestPin] = useState(false);
  const [guestPin, setGuestPin] = useState('');

  // 뒤로가기 발생 시 자동 비회원 신청 처리
  useEffect(() => {
    if (funnelModal) {
      window.history.pushState({ funnelOpen: true }, '');
      
      const handlePopState = (e: PopStateEvent) => {
        setFunnelModal(false);
        saveNonMemberApplication(undefined); 
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [funnelModal]);

  // ── Form Lock State ──
  const [isGenderLocked, setIsGenderLocked] = useState(false);

  // (이전 테스트 자동입력 useEffect는 제거됨 - onClick 핸들러로 통합)

  // ── Social login loading ──
  const [socialLoading, setSocialLoading] = useState(false);

  // ── Auth state ──
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // ── Kakao redirect: auto-complete application ──
  useEffect(() => {
    const kakaoDone = searchParams.get('kakao_done');
    if (kakaoDone !== '1') return;

    const autoSubmit = async () => {
      const raw = sessionStorage.getItem('kl_fast_apply_backup');
      if (!raw) return;

      // CLEAR IMMEDIATELY to prevent React Strict Mode duplicate execution
      sessionStorage.removeItem('kl_fast_apply_backup');

      let backup: { formData: FormData; sessionIds: string[]; photos?: string[]; maleOption?: string; femaleOption?: string; groupPartnerName?: string; groupPartnerBirthYear?: string; couponDiscount?: number; selectedCouponId?: string; selectedCouponTitle?: string; };
      try { backup = JSON.parse(raw); } catch { return; }
      if (!backup?.formData || !backup?.sessionIds?.length) return;

      // Wait for auth to settle
      const user = await new Promise<any>((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
      });
      if (!user) return;

      const uid = user.uid;
      const { formData, sessionIds, photos } = backup;
      
      try {
        const batch = writeBatch(db);

        // Upload images to Firebase Storage under the new Kakao user UID
        const { uploadedPhotos, uploadedProof } = await uploadBase64Photos(uid, photos || [], formData.employmentProof);

        // Create or update user doc with form data
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
          batch.set(doc(db, 'users', uid), {
            uid,
            name: formData.name || '',
            gender: formData.gender || '',
            birthDate: formData.birthDate || '',
            phone: formData.phone || '',
            instaId: formData.instaId || '',
            height: formData.height || '',
            weight: formData.weight || '',
            residence: formData.residence || '',
            workplace: formData.workplace || '',
            avoidList: formData.avoidList || [],
            idealType: formData.idealType || '',
            nonIdealType: formData.nonIdealType || '',
            smoking: formData.smoking || '',
            drinking: formData.drinking || '',
            religion: formData.religion || '',
            drink: formData.drink || [],
            etc: formData.etc || '',
            employmentProof: uploadedProof,
            photos: uploadedPhotos,
            isRegistered: true,
            loginMethod: 'kakao',
            provider: 'kakao',
            role: 'user',
            createdAt: Timestamp.now(),
          });

          // 웰컴 가입 축하 쿠폰 발급 (batch로 추가 불가능하므로 직접 추가, 단 batch 외부에 위치해야함)
          const expireAt = new Date();
          expireAt.setMonth(expireAt.getMonth() + 3);
          // Wait, addDoc creates a new auto-id doc, we can use doc() with batch
          const couponRef = doc(collection(db, 'users', uid, 'coupons'));
          batch.set(couponRef, {
            title: '웰컴 가입 축하 쿠폰',
            type: 'amount',
            value: 5000,
            createdAt: Timestamp.now(),
            expireAt: Timestamp.fromDate(expireAt),
            isUsed: false,
          });
        } else {
          // 기존 유저인 경우 새로 입력/업로드한 사진 및 정보로 업데이트
          batch.update(doc(db, 'users', uid), {
            ...(uploadedPhotos.length > 0 ? { photos: uploadedPhotos } : {}),
            ...(uploadedProof ? { employmentProof: uploadedProof } : {}),
            updatedAt: Timestamp.now(),
          });
        }

        // Create applications
        for (const sessionId of sessionIds) {
          // 중복 신청 방지 로직 추가
          const existingSnap = await getDocs(query(
            collection(db, 'applications'),
            where('userId', '==', uid),
            where('sessionId', '==', sessionId),
            where('status', 'in', ['pending', 'applied', 'selected', 'confirmed'])
          ));
          if (!existingSnap.empty) continue;

          const basePrice = getBasePrice(sessionId);
          const couponDiscount = backup.couponDiscount || 0;

          const birthYear = formData.birthDate
            ? (() => {
              if (formData.birthDate.includes('-')) {
                const y = parseInt(formData.birthDate.slice(0, 4), 10);
                return isNaN(y) ? new Date().getFullYear() : y;
              }
              const yy = parseInt(formData.birthDate.slice(0, 2), 10);
              if (isNaN(yy)) return new Date().getFullYear();
              return yy > 30 ? 1900 + yy : 2000 + yy;
            })()
            : new Date().getFullYear();
          const age = new Date().getFullYear() - birthYear;

          const appRef = doc(collection(db, 'applications'));
          batch.set(appRef, {
            userId: uid,
            sessionId,
            name: formData.name,
            age,
            gender: formData.gender,
            birthDate: formData.birthDate,
            phone: formData.phone,
            job: formData.workplace || '',
            residence: formData.residence || '',
            instaId: formData.instaId || '',
            smoking: formData.smoking || '',
            drinking: formData.drinking || '',
            religion: formData.religion || '',
            drink: formData.drink?.length > 0 ? formData.drink.join(', ') : '',
            idealType: formData.idealType || '',
            nonIdealType: formData.nonIdealType || '',
            avoidList: formData.avoidList || [],
            etc: formData.etc || '',
            employmentProof: uploadedProof,
            photos: uploadedPhotos,
            maleOption: formData.gender === 'male' ? backup.maleOption || null : null,
            femaleOption: formData.gender === 'female' ? backup.femaleOption || null : null,
            groupPartnerName: formData.gender === 'female' && backup.femaleOption === 'group' ? backup.groupPartnerName || null : null,
            groupPartnerBirthYear: formData.gender === 'female' && backup.femaleOption === 'group' ? backup.groupPartnerBirthYear || null : null,
            couponId: backup.selectedCouponId || null,
            couponTitle: backup.selectedCouponTitle || null,
            couponDiscount,
            price: Math.max(0, basePrice - couponDiscount),
            status: 'applied',
            sessionType: 'group',
            appliedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }

        await batch.commit();

        setSubmitted(true);
        toast.success('카카오 로그인으로 신청이 완료되었습니다!');
      } catch (e) {
        console.error('Kakao auto-submit failed:', e);
        toast.error('신청 저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    };

    autoSubmit();
  }, [searchParams]);

  // ── Pre-fill form if logged in ──
  useEffect(() => {
    if (currentUser) {
      const fetchUserData = async () => {
        try {
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
          if (snap.exists()) {
            const d = snap.data();
            setIsAdmin(d.role === 'admin' || d.role === 'super_admin');
            setForm(prev => ({
              ...prev,
              name: d.name || prev.name,
              gender: d.gender || prev.gender,
              birthDate: d.birthDate || prev.birthDate,
              phone: d.phone || prev.phone,
              instaId: d.instaId || prev.instaId,
              height: d.height || prev.height,
              weight: d.weight || prev.weight,
              residence: d.residence || prev.residence,
              workplace: d.workplace || d.job || d.jobRole || prev.workplace,
              avoidList: d.avoidList || prev.avoidList,
              idealType: d.idealType || prev.idealType,
              nonIdealType: d.nonIdealType || prev.nonIdealType,
              smoking: d.smoking || prev.smoking,
              drinking: d.drinking || prev.drinking,
              religion: d.religion || prev.religion,
              drink: Array.isArray(d.drink) ? d.drink : (d.drink ? [d.drink] : prev.drink),
              etc: d.etc || prev.etc,
              employmentProof: d.employmentProof || d.verificationUrl || prev.employmentProof,
            }));
            setVerificationPreview(d.employmentProof || d.verificationUrl || '');

            const savedPhotos = d.photos || d.profilePhotos || [];
            const legacyFace = d.facePhotos || [];
            const legacyBody = d.bodyPhotos || [];
            const merged = savedPhotos.length > 0 ? savedPhotos : [...legacyFace, ...legacyBody].slice(0, 5);
            setPhotos(merged);

            if (d.gender) {
              setIsGenderLocked(true);
            }
          }

          // 사용 가능한 쿠폰 로드
          const couponsSnap = await getDocs(query(
            collection(db, 'users', currentUser.uid, 'coupons'),
            where('isUsed', '==', false)
          ));
          const now = new Date();
          const coupons = couponsSnap.docs.map(cd => {
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
        } catch (e) {
          console.error('Failed to fetch user data for pre-fill:', e);
        }
      };
      fetchUserData();
    }
  }, [currentUser]);

  // ── 가격 계산 헬퍼 ──
  const getBasePrice = (explicitSessionId?: string) => {
    const sid = explicitSessionId || Array.from(selectedSessionIds)[0];
    const sessionObj = sessions.find(s => s.id === sid);
    if (form.gender === 'female') {
      if (femaleOption === 'group') return sessionObj?.femaleGroupPrice || 19000;
      return sessionObj?.femalePrice || sessionObj?.price || 29000;
    }
    if (maleOption === 'safe') return sessionObj?.maleSafePrice || 60000;
    return sessionObj?.malePrice || sessionObj?.price || 49000;
  };

  const getCouponDiscount = () => {
    if (!selectedCoupon) return 0;
    const base = getBasePrice();
    const { type, value, amount } = selectedCoupon;
    if (type === 'free') return base;
    if (type === 'percent') return Math.floor(base * ((value || amount || 0) / 100));
    return value || amount || 0;
  };

  const getFinalPrice = () => Math.max(0, getBasePrice() - getCouponDiscount());

  const visibleSessions = sessions.filter(s => {
    if (s.isTest && !isAdmin) return false;
    return true;
  });

  /* ── Load recruiting sessions ── */
  useEffect(() => {
    // If we already have sessions from SSR, we can skip fetching or re-fetch silently in background
    if (mappedSessions.length > 0) {
      setLoadingSessions(false);
      // Optional: you can still re-fetch to ensure the latest data, but without loading spinner
    }

    const fetch = async () => {
      if (mappedSessions.length === 0) setLoadingSessions(true);
      try {
        const snap = await getDocs(query(collection(db, 'sessions'), where('status', '==', 'open')));
        const now = new Date();
        const list: RecruitingSession[] = snap.docs
          .map(d => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || '',
              isTest: data.isTest || false,
              eventDate: data.eventDate?.toDate() || new Date(),
              location: data.location || '',
              ageRange: data.ageRange || '',
              maxParticipants: data.maxParticipants,
              price: data.price,
              malePrice: data.malePrice,
              femalePrice: data.femalePrice,
              femaleGroupPrice: data.femaleGroupPrice,
              maleSafePrice: data.maleSafePrice,
              targetMaleAge: data.targetMaleAge || '',
              isCustomCuration: data.isCustomCuration || false,
            };
          })
          .filter(s => {
            // 행사일 기준 24시간이 지나면 달력에서 자동으로 숨김
            const isEnded = now.getTime() >= s.eventDate.getTime() + 24 * 60 * 60 * 1000;
            return !isEnded;
          })
          .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
        setSessions(list);

        // Auto-navigate calendar to first session month if not already set
        if (list.length > 0 && mappedSessions.length === 0) {
          setCalendarYear(list[0].eventDate.getFullYear());
          setCalendarMonth(list[0].eventDate.getMonth());
        }
      } catch (e) { console.error(e); }
      finally { setLoadingSessions(false); }
    };
    fetch();
  }, []);

  /* ── Calendar helpers ── */
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

  const sessionsInMonth = sessions.filter(s =>
    s.eventDate.getFullYear() === calendarYear && s.eventDate.getMonth() === calendarMonth
  );

  const toggleSession = (id: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleByDate = (date: Date) => {
    const matched = sessions.filter(s => isSameDay(s.eventDate, date));
    if (matched.length === 0) return;
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      const allSelected = matched.every(s => next.has(s.id));
      matched.forEach(s => { if (allSelected) next.delete(s.id); else next.add(s.id); });
      return next;
    });
  };

  const hasSessionOnDay = (day: number) =>
    sessions.some(s =>
      s.eventDate.getFullYear() === calendarYear &&
      s.eventDate.getMonth() === calendarMonth &&
      s.eventDate.getDate() === day
    );

  const isSelectedDay = (day: number) =>
    sessions.some(s =>
      s.eventDate.getFullYear() === calendarYear &&
      s.eventDate.getMonth() === calendarMonth &&
      s.eventDate.getDate() === day &&
      selectedSessionIds.has(s.id)
    );

  /* ── Form helpers ── */
  const setField = (key: keyof FormData, val: string | string[]) => setForm(prev => ({ ...prev, [key]: val }));

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 2 && val.length <= 4) {
      val = val.replace(/(\d{2})(\d{1,2})/, '$1-$2');
    } else if (val.length > 4) {
      val = val.replace(/(\d{2})(\d{2})(\d{1,2})/, '$1-$2-$3');
    }
    setField('birthDate', val.substring(0, 8));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 3 && val.length <= 7) {
      val = val.replace(/(\d{3})(\d{1,4})/, '$1-$2');
    } else if (val.length > 7) {
      val = val.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
    }
    setField('phone', val.substring(0, 13));
  };

  const checkField = (condition: boolean, msg: string, id: string) => {
    if (!condition) {
      toast.error(msg);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const validateForm = () => {
    const errors: string[] = [];
    let firstMessage = '';
    let firstId = '';

    const addError = (condition: boolean, msg: string, id: string) => {
      if (!condition) {
        errors.push(id);
        if (!firstMessage) {
          firstMessage = msg;
          firstId = id;
        }
      }
    };

    addError(selectedSessionIds.size > 0, '신청할 날짜를 선택해 주세요.', 'field-sessions');
    addError(!!form.name.trim(), '이름을 입력해 주세요.', 'field-name');
    addError(!!form.gender, '성별을 선택해 주세요.', 'field-gender');
    addError(!!form.birthDate.trim(), '생년월일을 입력해 주세요.', 'field-birthDate');
    addError(!!form.phone.trim(), '전화번호를 입력해 주세요.', 'field-phone');
    addError(!!form.height.trim(), '키(cm)를 입력해 주세요.', 'field-height');
    addError(!!form.weight.trim(), '체중(kg)을 입력해 주세요.', 'field-weight');
    addError(!!form.residence.trim(), '거주지를 입력해 주세요.', 'field-residence');
    addError(!!form.workplace.trim(), '회사명 / 직무를 입력해 주세요.', 'field-workplace');
    addError(!!form.smoking, '흡연 유무를 선택해 주세요.', 'field-smoking');
    addError(!!form.drinking, '음주 빈도를 선택해 주세요.', 'field-drinking');
    addError(!!form.religion, '종교를 선택해 주세요.', 'field-religion');
    addError(form.drink.length > 0, '희망 음료를 선택해 주세요.', 'field-drink');
    addError(photos.length > 0, '본인 사진을 최소 1장 이상 등록해 주세요.', 'field-photos');
    addError(isAllAgreed, currentUser ? '환불 및 취소 규정에 동의해 주세요.' : '모든 필수 약관에 동의해 주세요.', 'field-agreements');

    setErrorFields(errors);

    if (errors.length > 0) {
      toast.error(firstMessage);
      const el = document.getElementById(firstId) || (firstId === 'field-sessions' ? sessionListRef.current : null);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  /* ── Phone duplicate check & submit ── */
  /* ── Photo upload & Verify upload ── */
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    if (photos.length + files.length > 5) {
      toast.error('사진은 최대 5장까지 업로드 가능합니다.');
      return;
    }
    
    files.forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error('20MB 이하의 이미지만 업로드 가능합니다.');
        return;
      }
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

  const handleVerifyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 20 * 1024 * 1024) return toast.error('파일 크기는 20MB 이하여야 합니다.');
    
    setVerificationFile(file);
    setVerificationFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      let finalUrl = raw;
      if (file.type.startsWith('image/')) {
        finalUrl = await compressImage(raw);
      }
      setVerificationPreview(finalUrl);
      setField('employmentProof', finalUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      let isGuest = false;
      if (currentUser) {
        if (currentUser.isAnonymous) {
          isGuest = true;
        } else {
          const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDocSnap.exists() && userDocSnap.data().loginMethod === 'anonymous') {
            isGuest = true;
          }
        }
      }

      if (!currentUser || isGuest) {
        // 1. Check phone duplicate in users collection for non-members
        const phone = form.phone.replace(/\s/g, '');
        const usersSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', phone)));
        if (!usersSnap.empty) {
          const existingUser = usersSnap.docs[0].data();
          // If the found user is NOT the currently logged-in user, show duplicate warning
          if (!currentUser || currentUser.uid !== existingUser.uid) {
            const provider: ProviderType =
              existingUser.loginMethod === 'kakao' ? 'kakao' :
              existingUser.loginMethod === 'google' ? 'google' : 'email';
            setDupModal({ provider, phone });
            // Save form data to sessionStorage for post-login recovery
            sessionStorage.setItem('kl_fast_apply_backup', JSON.stringify({
              formData: form,
              sessionIds: Array.from(selectedSessionIds),
              maleOption,
              femaleOption,
              groupPartnerName,
              groupPartnerBirthYear,
              selectedCouponId: selectedCoupon?.id || null,
              selectedCouponTitle: selectedCoupon?.title || null,
              couponDiscount: getCouponDiscount(),
            }));
            setSubmitting(false);
            return;
          }
        }

        const backup = {
          formData: form,
          sessionIds: Array.from(selectedSessionIds),
          photos,
          maleOption,
          femaleOption,
          groupPartnerName,
          groupPartnerBirthYear,
          selectedCouponId: selectedCoupon?.id || null,
          selectedCouponTitle: selectedCoupon?.title || null,
          couponDiscount: getCouponDiscount(),
        };
        sessionStorage.setItem('kl_fast_apply_backup', JSON.stringify(backup));
        setSavedData(backup);
        
        // NEW: Submit as non-member automatically (Background)
        await saveNonMemberApplication(undefined, true);
        
        setFunnelModal(true);
      } else {
        // 3. Current user is logged in, submit immediately
        const uid = currentUser.uid;
        
        // Upload images to Firebase Storage
        const { uploadedPhotos, uploadedProof } = await uploadBase64Photos(uid, photos, form.employmentProof);

        const batch = writeBatch(db);
        
        // Update user profile with latest form info
        batch.set(doc(db, 'users', uid), {
          name: form.name,
          gender: form.gender,
          birthDate: form.birthDate,
          phone: form.phone,
          job: form.workplace || '',
          residence: form.residence || '',
          instaId: form.instaId || '',
          smoking: form.smoking || '',
          drinking: form.drinking || '',
          religion: form.religion || '',
          drink: form.drink || [],
          idealType: form.idealType || '',
          nonIdealType: form.nonIdealType || '',
          avoidList: form.avoidList || [],
          etc: form.etc || '',
          ...(uploadedPhotos.length > 0 ? { photos: uploadedPhotos } : {}),
          ...(uploadedProof ? { employmentProof: uploadedProof } : {}),
          updatedAt: Timestamp.now(),
        }, { merge: true });

        // Create applications
        for (const sessionId of Array.from(selectedSessionIds)) {
          const basePrice = getBasePrice(sessionId);
          const couponDiscount = getCouponDiscount();
          
          const birthYear = form.birthDate
            ? (() => {
              if (form.birthDate.includes('-')) return parseInt(form.birthDate.slice(0, 4));
              const yy = parseInt(form.birthDate.slice(0, 2));
              return yy > 30 ? 1900 + yy : 2000 + yy;
            })()
            : new Date().getFullYear();
          const age = new Date().getFullYear() - birthYear;

          // 중복 신청 방지 및 익명 계정 이관 로직 (전화번호 기준)
          const existingSnap = await getDocs(query(
            collection(db, 'applications'),
            where('phone', '==', form.phone),
            where('sessionId', '==', sessionId)
          ));
          
          let existingActiveApp = null;
          for (const docSnap of existingSnap.docs) {
            if (['pending', 'applied', 'selected', 'confirmed'].includes(docSnap.data().status)) {
              existingActiveApp = docSnap;
              break;
            }
          }
          
          if (existingActiveApp) {
            const data = existingActiveApp.data();
            // 기존 신청서가 다른 UID(비회원 등)로 작성되었다면 현재 정식 회원 UID로 소유권 이전
            if (data.userId !== uid) {
              batch.update(existingActiveApp.ref, {
                userId: uid,
                isGuestApply: false,
                name: form.name,
                gender: form.gender,
                birthDate: form.birthDate,
                phone: form.phone,
                job: form.workplace || '',
                residence: form.residence || '',
                updatedAt: Timestamp.now(),
              });
            }
            continue; // 중복 생성 건너뜀
          }

          const appRef = doc(collection(db, 'applications'));
          batch.set(appRef, {
            userId: uid,
            sessionId,
            name: form.name,
            age,
            gender: form.gender,
            birthDate: form.birthDate,
            phone: form.phone,
            job: form.workplace || '',
            residence: form.residence || '',
            instaId: form.instaId || '',
            smoking: form.smoking || '',
            drinking: form.drinking || '',
            religion: form.religion || '',
            drink: form.drink.length > 0 ? form.drink.join(', ') : '',
            idealType: form.idealType || '',
            nonIdealType: form.nonIdealType || '',
            avoidList: form.avoidList || [],
            etc: form.etc || '',
            employmentProof: uploadedProof,
            photos: uploadedPhotos,
            maleOption: form.gender === 'male' ? maleOption : null,
            femaleOption: form.gender === 'female' ? femaleOption : null,
            groupPartnerName: form.gender === 'female' && femaleOption === 'group' ? groupPartnerName : null,
            groupPartnerBirthYear: form.gender === 'female' && femaleOption === 'group' ? groupPartnerBirthYear : null,
            couponId: selectedCoupon?.id || null,
            couponTitle: selectedCoupon?.title || null,
            couponDiscount,
            price: Math.max(0, basePrice - couponDiscount),
            status: 'applied',
            sessionType: 'group',
            isGuestApply: false,
            appliedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
        
        // Mark coupon as used if selected
        if (selectedCoupon?.id) {
          batch.update(doc(db, 'users', uid, 'coupons', selectedCoupon.id), {
            isUsed: true,
            usedAt: Timestamp.now(),
          });
        }

        await batch.commit();
        
        setSubmitted(true);
        toast.success('신청이 완료되었습니다!');
      }
    } catch (e: any) {
      console.error('[handleSubmit error]', e);
      const msg = e?.code ? `저장 오류: ${e.code}\n${e.message}` : (e?.message || '알 수 없는 오류');
      toast.error(
        <span>
          앗, 시스템에 문제가 생겼나요? 현재 화면을 캡처해서 <b>인스타 DM</b>으로 보내주시면, 죄송하고 감사한 마음을 담아 <b>10,000원 할인 쿠폰</b>을 드립니다!<br /><br />
          <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>[오류: {msg}]</span>
        </span>,
        { duration: 8000 }
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Actually save non-member data to Firestore ── */
  const saveNonMemberApplication = async (customPin?: string, isBackground = false) => {
    const backup = savedData || JSON.parse(sessionStorage.getItem('kl_fast_apply_backup') || '{}');
    if (!backup?.formData) return;

    try {
      let uid = '';
      if (auth.currentUser) {
        uid = auth.currentUser.uid;
      } else {
        const anonResult = await signInAnonymously(auth);
        uid = anonResult.user.uid;
      }
      const { formData, sessionIds } = backup;

      // Upload images to Firebase Storage
      const { uploadedPhotos, uploadedProof } = await uploadBase64Photos(uid, photos, formData.employmentProof);

      const batch = writeBatch(db);

      // Create temp user doc
      const birthStr = formData.birthDate.replace(/-/g, ''); // '971121'
      const phoneLast4 = formData.phone.replace(/\D/g, '').slice(-4);

      batch.set(doc(db, 'users', uid), {
        uid,
        name: formData.name,
        gender: formData.gender,
        birthDate: formData.birthDate,
        phone: formData.phone,
        instaId: formData.instaId || '',
        height: formData.height || '',
        weight: formData.weight || '',
        residence: formData.residence || '',
        workplace: formData.workplace || '',
        jobRole: formData.workplace || '',
        avoidList: formData.avoidList || [],
        idealType: formData.idealType || '',
        nonIdealType: formData.nonIdealType || '',
        smoking: formData.smoking || '',
        drinking: formData.drinking || '',
        religion: formData.religion || '',
        drink: formData.drink || [],
        etc: formData.etc || '',
        employmentProof: uploadedProof,
        photos: uploadedPhotos,
        isRegistered: false,          // 비회원 플래그
        loginMethod: 'anonymous',
        role: 'user',                 // Firestore 규칙을 통과하기 위해 필수
        guestId: birthStr,            // 생년월일 6자리
        guestPw: customPin || phoneLast4, // 설정한 비밀번호 또는 전화번호 끝 4자리
        createdAt: Timestamp.now(),
      });

      // Create applications for each selected session
      for (const sessionId of sessionIds) {
          const basePrice = getBasePrice(sessionId);
          const couponDiscount = backup.couponDiscount || 0;
        
        const birthYear = formData.birthDate
          ? (() => {
            if (formData.birthDate.includes('-')) {
              const y = parseInt(formData.birthDate.slice(0, 4), 10);
              return isNaN(y) ? new Date().getFullYear() : y;
            }
            const yy = parseInt(formData.birthDate.slice(0, 2), 10);
            if (isNaN(yy)) return new Date().getFullYear();
            return yy > 30 ? 1900 + yy : 2000 + yy;
          })()
          : new Date().getFullYear();
        const age = new Date().getFullYear() - birthYear;

        // 중복 신청 방지 로직 추가 (전화번호 기준)
        const existingSnap = await getDocs(query(
          collection(db, 'applications'),
          where('phone', '==', formData.phone),
          where('sessionId', '==', sessionId)
        ));
        
        let hasActive = false;
        for (const docSnap of existingSnap.docs) {
          if (['pending', 'applied', 'selected', 'confirmed'].includes(docSnap.data().status)) {
            hasActive = true;
            break;
          }
        }
        
        if (hasActive) {
          continue; // 이미 동일 기수에 신청한 내역이 있으면 중복 생성 건너뜀
        }

        const appRef = doc(collection(db, 'applications'));
        batch.set(appRef, {
          userId: uid,
          sessionId,
          name: formData.name,
          age,
          gender: formData.gender,
          birthDate: formData.birthDate,
          phone: formData.phone,
          job: formData.workplace || '',
          residence: formData.residence || '',
          instaId: formData.instaId || '',
          smoking: formData.smoking || '',
          drinking: formData.drinking || '',
          religion: formData.religion || '',
          drink: formData.drink?.length > 0 ? formData.drink.join(', ') : '',
          idealType: formData.idealType || '',
          nonIdealType: formData.nonIdealType || '',
          avoidList: formData.avoidList || [],
          etc: formData.etc || '',
          employmentProof: uploadedProof,
          photos: uploadedPhotos,
          maleOption: formData.gender === 'male' ? (backup.maleOption || maleOption) : null,
          femaleOption: formData.gender === 'female' ? (backup.femaleOption || femaleOption) : null,
          groupPartnerName: formData.gender === 'female' && (backup.femaleOption || femaleOption) === 'group' ? (backup.groupPartnerName || groupPartnerName) : null,
          groupPartnerBirthYear: formData.gender === 'female' && (backup.femaleOption || femaleOption) === 'group' ? (backup.groupPartnerBirthYear || groupPartnerBirthYear) : null,
          couponId: backup.selectedCouponId || null,
          couponTitle: backup.selectedCouponTitle || null,
          couponDiscount,
          price: Math.max(0, basePrice - couponDiscount),
          status: 'applied',
          sessionType: 'group',
          isGuestApply: true,
          appliedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      await batch.commit();

      if (!isBackground) {
        sessionStorage.removeItem('kl_fast_apply_backup');
        setFunnelModal(false);
        setSubmitted(true);
        toast.success('신청이 완료되었습니다!');
      }
    } catch (e) {
      console.error(e);
      if (!isBackground) {
        toast.error(
          <span>
            앗, 시스템에 문제가 생겼나요? 현재 화면을 캡처해서 <b>인스타 DM</b>으로 보내주시면, 죄송하고 감사한 마음을 담아 <b>10,000원 할인 쿠폰</b>을 드립니다!<br /><br />
            <span style={{ fontSize: '0.8rem', color: '#EF4444' }}>[오류: {(e instanceof Error ? e.message : String(e)) || '알 수 없는 오류'}]</span>
          </span>,
          { duration: 8000 }
        );
      }
    }
  };

  /* ── Social login in funnel modal ── */
  const handleGoogleLoginFunnel = async () => {
    setSocialLoading(true);
    try {
      const currentUid = auth.currentUser?.uid || 'temp_' + Date.now();
      const { uploadedPhotos, uploadedProof } = await uploadBase64Photos(currentUid, photos, form.employmentProof);
      
      // Backup current form before popup
      const backupForm = { ...form, employmentProof: uploadedProof };
      const backup = { formData: backupForm, sessionIds: Array.from(selectedSessionIds), photos: uploadedPhotos };
      sessionStorage.setItem('kl_fast_apply_backup', JSON.stringify(backup));

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const uid = result.user.uid;

      const batch = writeBatch(db);

      // Check if user doc exists
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        // New google user → create basic profile then applications
        batch.set(doc(db, 'users', uid), {
          uid,
          name: backup.formData.name || result.user.displayName || '',
          gender: backup.formData.gender || '',
          birthDate: backup.formData.birthDate || '',
          phone: backup.formData.phone || '',
          workplace: backup.formData.workplace || '',
          residence: backup.formData.residence || '',
          isRegistered: true,
          loginMethod: 'google',
          provider: 'google',
          photoURL: result.user.photoURL || '',
          photos: backup.photos || [],
          role: 'user',
          createdAt: Timestamp.now(),
        });

        // 웰컴 가입 축하 쿠폰 발급
        const expireAt = new Date();
        expireAt.setMonth(expireAt.getMonth() + 3);
        const couponRef = doc(collection(db, 'users', uid, 'coupons'));
        batch.set(couponRef, {
          title: '웰컴 가입 축하 쿠폰',
          type: 'amount',
          value: 5000,
          createdAt: Timestamp.now(),
          expireAt: Timestamp.fromDate(expireAt),
          isUsed: false,
        });
      } else {
        batch.update(doc(db, 'users', uid), {
          ...(backup.photos && backup.photos.length > 0 ? { photos: backup.photos } : {}),
          ...(backup.formData.employmentProof ? { employmentProof: backup.formData.employmentProof } : {}),
          updatedAt: Timestamp.now(),
        });
      }

      // Create applications
      for (const sessionId of backup.sessionIds) {
        // 중복 신청 방지 로직 추가
        const existingSnap = await getDocs(query(
          collection(db, 'applications'),
          where('userId', '==', uid),
          where('sessionId', '==', sessionId),
          where('status', 'in', ['pending', 'applied', 'selected', 'confirmed'])
        ));
        
        if (!existingSnap.empty) {
          continue;
        }

        const appRef = doc(collection(db, 'applications'));
        batch.set(appRef, {
          userId: uid,
          sessionId,
          name: backup.formData.name,
          gender: backup.formData.gender,
          birthDate: backup.formData.birthDate,
          phone: backup.formData.phone,
          job: backup.formData.workplace || '',
          residence: backup.formData.residence || '',
          instaId: backup.formData.instaId || '',
          smoking: backup.formData.smoking || '',
          drinking: backup.formData.drinking || '',
          religion: backup.formData.religion || '',
          drink: backup.formData.drink?.length > 0 ? backup.formData.drink.join(', ') : '',
          idealType: backup.formData.idealType || '',
          nonIdealType: backup.formData.nonIdealType || '',
          avoidList: backup.formData.avoidList || [],
          etc: backup.formData.etc || '',
          employmentProof: backup.formData.employmentProof || '',
          photos: backup.photos || [],
          status: 'applied',
          appliedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      await batch.commit();

      sessionStorage.removeItem('kl_fast_apply_backup');
      setFunnelModal(false);
      setSubmitted(true);
      toast.success('✅ 구글 계정으로 신청 완료! 마이페이지에서 확인하세요.');
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        toast.error('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setSocialLoading(false);
    }
  };

  const handleKakaoLoginFunnel = async () => {
    setSocialLoading(true);
    const currentUid = auth.currentUser?.uid || 'temp_' + Date.now();
    const { uploadedPhotos, uploadedProof } = await uploadBase64Photos(currentUid, photos, form.employmentProof);
    
    // Backup form before redirect
    const backupForm = { ...form, employmentProof: uploadedProof };
    const backup = { formData: backupForm, sessionIds: Array.from(selectedSessionIds), photos: uploadedPhotos };
    sessionStorage.setItem('kl_fast_apply_backup', JSON.stringify(backup));

    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    if (!clientId) { toast.error('카카오 설정 오류'); return; }
    const redirectUri = `${window.location.origin}/api/auth/kakao`;
    
    // Pass fast-apply flag in state so the callback can complete the application
    let kakaoState = 'fast_apply';
    if (auth.currentUser) {
      kakaoState = `upgrade_guest|${auth.currentUser.uid}|fast_apply`;
    }
    
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${kakaoState}`;
  };

  /* ── Completion screen ── */
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 30%, rgba(255,111,97,0.08) 0%, transparent 70%)' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: '#fff', borderRadius: '32px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #FF6F61, #ff8a7a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check size={36} color="#fff" strokeWidth={3} />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111', marginBottom: '12px' }}>신청 완료!</h1>
          <p style={{ color: '#666', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '32px' }}>
            소개팅 신청이 성공적으로 접수되었습니다.<br />
            운영진이 검토 후 확정 문자를 보내드립니다.
          </p>
          <Link href="/mypage" style={{ display: 'block', padding: '16px', background: '#FF6F61', color: '#fff', borderRadius: '100px', fontWeight: '800', textDecoration: 'none', fontSize: '1rem' }}>
            신청 내역 확인하기
          </Link>
        </div>
      </div>
    );
  }

  const renderSubmitButton = () => (
    <>
      {/* ─── 남성 매칭 옵션 ─── */}
      {form.gender === 'male' && (
        <div style={{ marginTop: '20px', padding: '24px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShieldCheck size={18} color="#FF6F61" />
            <span style={{ fontWeight: '800', fontSize: '1rem', color: '#111' }}>매칭 옵션 선택</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* 일반 매칭 */}
            <button
              type="button"
              onClick={() => setMaleOption('normal')}
              style={{
                padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: maleOption === 'normal' ? '#FFF0EE' : '#F8FAFC',
                outline: maleOption === 'normal' ? '2px solid #FF6F61' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: '700', color: maleOption === 'normal' ? '#FF6F61' : '#94A3B8', marginBottom: '6px' }}>일반 매칭</p>
              <p style={{ fontSize: '1.15rem', fontWeight: '900', color: '#111', marginBottom: '4px' }}>49,000원</p>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.4 }}>매칭 실패 시 환불 없음</p>
            </button>
            {/* 안심 매칭 패키지 */}
            <button
              type="button"
              onClick={() => setMaleOption('safe')}
              style={{
                padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: maleOption === 'safe' ? '#F3EFFF' : '#F8FAFC',
                outline: maleOption === 'safe' ? '2px solid #A98FD5' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: '700', color: maleOption === 'safe' ? '#A98FD5' : '#94A3B8', marginBottom: '6px' }}>안심 매칭 패키지</p>
              <p style={{ fontSize: '1.15rem', fontWeight: '900', color: '#111', marginBottom: '4px' }}>60,000원</p>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.4 }}>매칭 실패 시 30% 환불</p>
            </button>
          </div>
        </div>
      )}

      {/* ─── 여성 매칭 옵션 ─── */}
      {form.gender === 'female' && (
        <div style={{ marginTop: '20px', padding: '24px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShieldCheck size={18} color="#FF6F61" />
            <span style={{ fontWeight: '800', fontSize: '1rem', color: '#111' }}>매칭 옵션 선택</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* 1인 참석 */}
            <button
              type="button"
              onClick={() => setFemaleOption('normal')}
              style={{
                padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: femaleOption === 'normal' ? '#FFF0EE' : '#F8FAFC',
                outline: femaleOption === 'normal' ? '2px solid #FF6F61' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: '700', color: femaleOption === 'normal' ? '#FF6F61' : '#94A3B8', marginBottom: '6px' }}>1인 참석</p>
              <p style={{ fontSize: '1.15rem', fontWeight: '900', color: '#111', marginBottom: '4px' }}>29,000원</p>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.4 }}>일반 신청</p>
            </button>
            {/* 지인과 동반 참석 */}
            <button
              type="button"
              onClick={() => setFemaleOption('group')}
              style={{
                padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: femaleOption === 'group' ? '#F3EFFF' : '#F8FAFC',
                outline: femaleOption === 'group' ? '2px solid #A98FD5' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: '700', color: femaleOption === 'group' ? '#A98FD5' : '#94A3B8', marginBottom: '6px' }}>지인과 동반 참석</p>
              <p style={{ fontSize: '1.15rem', fontWeight: '900', color: '#111', marginBottom: '4px' }}>19,000원</p>
              <p style={{ fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.4 }}>동반 할인 적용</p>
            </button>
          </div>
          {femaleOption === 'group' && (
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '12px' }}>동반 참여자 정보</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  className="kl-input"
                  style={{ background: '#fff', fontSize: '0.85rem' }}
                  placeholder="이름"
                  value={groupPartnerName}
                  onChange={(e) => setGroupPartnerName(e.target.value)}
                />
                <input
                  className="kl-input"
                  style={{ background: '#fff', fontSize: '0.85rem' }}
                  placeholder="년생 (ex. 98)"
                  value={groupPartnerBirthYear}
                  onChange={(e) => setGroupPartnerBirthYear(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 쿠폰 적용 (로그인 유저만) ─── */}
      {currentUser && (
        <div style={{ marginTop: '12px', padding: '24px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.1rem' }}>🎟️</span>
            <span style={{ fontWeight: '800', fontSize: '1rem', color: '#111' }}>쿠폰 적용</span>
          </div>
          {userCoupons.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>사용 가능한 쿠폰이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {userCoupons.map(coupon => {
                const isSelected = selectedCoupon?.id === coupon.id;
                const expDate = coupon.expireAt?.toDate ? coupon.expireAt.toDate() : (coupon.expireAt ? new Date(coupon.expireAt) : null);
                const expString = expDate ? `${expDate.getFullYear()}.${String(expDate.getMonth()+1).padStart(2, '0')}.${String(expDate.getDate()).padStart(2, '0')} 까지` : '기한 없음';

                return (
                  <button
                    key={coupon.id}
                    type="button"
                    onClick={() => setSelectedCoupon(isSelected ? null : coupon)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: isSelected ? '#FFF0EE' : '#F8FAFC',
                      outline: isSelected ? '2px solid #FF6F61' : '2px solid transparent',
                      transition: 'all 0.15s', textAlign: 'left',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.88rem', fontWeight: '800', color: '#111', marginBottom: '2px' }}>{coupon.title || '할인 쿠폰'}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontSize: '0.72rem', color: '#FF6F61', fontWeight: '700' }}>
                          {coupon.type === 'percent' ? `${coupon.value || coupon.amount}% 할인` :
                           coupon.type === 'free' ? '100% 무료' :
                           `${(coupon.value || coupon.amount || 0).toLocaleString()}원 할인`}
                        </p>
                        <p style={{ fontSize: '0.65rem', color: '#999' }}>
                          | {expString}
                        </p>
                      </div>
                    </div>
                    {isSelected
                      ? <CheckCircle size={20} color="#FF6F61" fill="rgba(255,111,97,0.15)" />
                      : <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #CBD5E1' }} />
                    }
                  </button>
                );
              })}
              <p style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '4px', lineHeight: 1.5 }}>
                * 쿠폰은 복수 기수 선택 시 최초 선발 기수에 자동 적용됩니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── 최종 결제 금액 요약 ─── */}
      {form.gender && (
        <div style={{ marginTop: '12px', padding: '18px 20px', background: '#FFF5F4', borderRadius: '14px', border: '1px solid rgba(255,111,97,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#111' }}>최종 결제 금액</span>
            <div style={{ textAlign: 'right' }}>
              {getCouponDiscount() > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: '700', marginRight: '8px' }}>
                  (-{getCouponDiscount().toLocaleString()}원 쿠폰)
                </span>
              )}
              <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#FF6F61' }}>{getFinalPrice().toLocaleString()}원</span>
            </div>
          </div>
        </div>
      )}

      <div id="field-agreements" style={{ 
        marginTop: '20px', padding: '24px', 
        background: errorFields.includes('field-agreements') ? '#FEF2F2' : '#fff', 
        borderRadius: '16px', 
        border: errorFields.includes('field-agreements') ? '1.5px solid #EF4444' : '1px solid #E2E8F0', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        transition: 'all 0.2s'
      }}>
        {!currentUser && (
          <button type="button" onClick={toggleAllAgreements} style={{
            display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px', padding: 0
          }}>
            {isAllAgreed ? <CheckSquare color="#FF6F61" fill="rgba(255,111,97,0.2)" size={24} /> : <Square color="#94A3B8" size={24} />}
            <span style={{ fontWeight: '800', fontSize: '1rem', color: isAllAgreed ? '#FF6F61' : '#334155' }}>전체 동의하기</span>
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { key: 'terms', label: '서비스 이용약관 동의 (필수)' },
            { key: 'privacy', label: '개인정보 수집 및 이용 동의 (필수)' },
            { key: 'thirdParty', label: '개인정보 제3자 제공 동의 (필수)' },
            { key: 'refund', label: '환불 및 취소 규정 확인 및 동의 (필수)' },
            { key: 'marketing', label: '마케팅 활용 모자이크 촬영 동의 (필수)' },
          ].filter(item => {
            if (currentUser && item.key !== 'refund') return false;
            return true;
          }).map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                onClick={() => setAgreements(a => ({ ...a, [key]: !a[key as keyof typeof agreements] }))}>
                {agreements[key as keyof typeof agreements] ? <CheckCircle color="#FF6F61" size={18} fill="rgba(255,111,97,0.1)" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #CBD5E1' }} />}
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '500' }}>{label}</span>
              </div>
              {key === 'refund' && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowRefundPolicy(true); }} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <ChevronRight size={18} color="#94A3B8" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 111, 97, 0.15)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.03)'
      }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '18px',
              background: 'linear-gradient(135deg, #FF6F61 0%, #ff8a7a 100%)',
              color: '#fff', border: 'none', borderRadius: '18px',
              fontWeight: '900', fontSize: '1.1rem', cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 24px rgba(255,111,97,0.35)',
              opacity: submitting ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Heart size={20} fill="#fff" />}
            {submitting ? '신청 중...' : '소개팅 신청하기'}
            {!submitting && <Heart size={20} fill="#fff" />}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, rgba(255,111,97,0.07) 0%, transparent 60%)', paddingBottom: '120px' }}>

      {showRefundPolicy && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 4000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '40px 20px', backdropFilter: 'blur(5px)',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '32px 24px',
            maxWidth: '440px', width: '100%',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            margin: 'auto 0'
          }}>
            <button onClick={() => setShowRefundPolicy(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
              <X size={20} color="#94A3B8" />
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,111,97,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ShieldCheck size={28} color="#FF6F61" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111' }}>환불 및 취소 규정</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ marginBottom: '4px' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#333', marginBottom: '6px' }}>제1조 (서비스의 성격)</p>
                <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6 }}>본 서비스는 다수의 참여자가 동일 일정에 맞추어 진행되는 오프라인 매칭 프로그램으로, 남녀 성비 및 참여 인원 구성이 사전에 확정되어 진행됩니다.</p>
              </div>
              
              <div style={{ marginBottom: '4px' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#333', marginBottom: '6px' }}>제2조 (결제 및 환불)</p>
                <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6 }}>프로그램 특성상 참여자 매칭, 장소 예약, 운영 인력 배치 등 모든 사전 준비가 신청과 동시에 진행되므로, <strong style={{ color: '#C86A6A' }}>참여확정 이후 개인 사유(단순 변심, 일정 변경, 불참 등)에 의한 취소 및 환불은 원칙적으로 불가합니다.</strong></p>
              </div>

              <div style={{ marginBottom: '4px' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#333', marginBottom: '6px' }}>제3조 (환불 및 예외 사항)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,111,97,0.05)', border: '1px solid rgba(255,111,97,0.1)' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#FF6F61', marginBottom: '2px' }}>① 중복 만남 보장</p>
                    <p style={{ fontSize: '0.75rem', color: '#666' }}>이용약관 제6조에 의거하여 100% 환불</p>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(169,143,213,0.05)', border: '1px solid rgba(169,143,213,0.1)' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#A98FD5', marginBottom: '2px' }}>② 안심 매칭 보장</p>
                    <p style={{ fontSize: '0.75rem', color: '#666' }}>안심 매칭 패키지 특약에 의거하여 환불됩니다.</p>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6 }}>③ 서비스 제공자의 귀책 사유로 행사가 취소되거나, 본인의 입원 또는 직계가족 경조사 등 불가피한 사유 발생 시 증빙서류 확인 후 환불이 가능합니다.</p>
                </div>
              </div>

              <div style={{ marginBottom: '4px' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#333', marginBottom: '6px' }}>제4조 (법적 미혼 및 신원 보증)</p>
                <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6 }}>본 서비스는 진정성 있는 만남을 목적으로 합니다. <strong style={{ color: '#C86A6A' }}>본인은 현재 법적 미혼이며 교제 중인 이성이 없음을 보증합니다.</strong> 이를 위반하거나 허위 정보를 기재하여 타인 및 서비스에 피해를 줄 경우, 서비스 이용이 즉각 영구 정지되며 기결제된 금액은 전액 환불 불가합니다. 또한 이로 인해 발생하는 법적 책임 및 민/형사상의 손해배상을 전적으로 부담할 것에 동의합니다.</p>
              </div>

              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#333', marginBottom: '6px' }}>제5조 (유의 사항)</p>
                <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6 }}>본인은 위 환불 및 취소, 이용 규정을 충분히 확인하였으며, 이에 동의합니다.</p>
              </div>
            </div>

            <button
              style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FF6F61, #ff8a7a)', color: '#fff', border: 'none', borderRadius: '100px', fontWeight: '800', cursor: 'pointer' }}
              onClick={() => setShowRefundPolicy(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ─── Hero / Brand Section ─── */}
      <div style={{ background: 'linear-gradient(135deg, #FF6F61 0%, #ff8a7a 100%)', padding: '100px 24px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'4\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', opacity: 0.5 }} />
        <div style={{ position: 'relative' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', fontWeight: '900', color: '#fff', marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.03em' }}>
            가입 없이<br />1분 만에 신청
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto 28px' }}>
            소규모 로테이션 방식으로<br />모든 이성과 1:1 대화를 나눠보세요
          </p>

          {/* Trust badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {['검증된 직장인', '소규모 정원제'].map(badge => (
              <div key={badge} style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', borderRadius: '100px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={12} color="#fff" strokeWidth={3} />
                <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: '700' }}>{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 6px' }}>

        {/* ─── 로그인 유도 배너 (비로그인 상태일 때만 표시) ─── */}
        {!currentUser && (
          <div style={{ background: '#FFF5F4', borderRadius: '20px', padding: '20px 24px', marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #FFE8E5' }}>
            <div>
              <p style={{ fontWeight: '900', color: '#111', fontSize: '1rem', marginBottom: '4px', letterSpacing: '-0.02em' }}>이미 가입하셨나요?</p>
              <p style={{ color: '#777', fontSize: '0.82rem', letterSpacing: '-0.01em' }}>로그인하면 3초 만에 신청할 수 있어요!</p>
            </div>
            <Link href="/login?redirect=/apply/fast" style={{ background: '#FF6F61', color: '#fff', padding: '12px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(255,111,97,0.2)' }}>
              로그인하기
            </Link>
          </div>
        )}

        {/* ─── Calendar View (Main Page Sync) ─── */}
        <div style={{ margin: '16px 0 24px 0' }}>
          <EventCalendar
              events={visibleSessions.map(s => ({
                id: s.id,
                title: s.title,
                region: 'busan',
                venue: s.location || '',
                venueAddress: '',
                date: s.eventDate,
                time: formatKorDate(s.eventDate),
                maxMale: s.maxParticipants || 0,
                maxFemale: s.maxParticipants || 0,
                currentMale: 0,
                currentFemale: 0,
                price: s.price || 0,
                status: 'open',
                description: '',
                rankingOpen: false,
                matchingOpen: false,
                episode: 0,
                targetMaleAge: s.targetMaleAge,
                isCustomCuration: s.isCustomCuration,
                createdAt: new Date(),
              } as KeylinkEvent))}
              onDateSelect={(d: Date) => {
                toggleByDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
              }}
              isSelectedDate={(d: Date) => isSelectedDay(d.getDate())}
            />
        </div>

        {/* ─── Session Select List ─── */}
        <div ref={sessionListRef} style={{ background: '#fff', borderRadius: '24px', padding: '24px 20px', marginBottom: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', background: '#FFF0EE', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#FF6F61" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', marginBottom: '2px' }}>행사 선택</h2>
              <p style={{ fontSize: '0.78rem', color: '#999' }}>원하는 일정을 모두 선택해주세요</p>
            </div>
          </div>

          {/* 공통 장소 안내 */}
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '1.1rem' }}>📍</span>
            <p style={{ fontSize: '0.85rem', color: '#555', fontWeight: '600', letterSpacing: '-0.01em' }}>
              장소: <strong style={{ color: '#111' }}>서면역 인근 프라이빗 파티룸</strong>
            </p>
          </div>

          {/* Session list (checkbox) */}
          {loadingSessions ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#aaa', fontSize: '0.85rem' }}>행사 정보 불러오는 중...</div>
          ) : visibleSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '16px' }}>
              <p style={{ color: '#999', fontSize: '0.9rem', fontWeight: '600' }}>현재 모집 중인 행사가 없습니다.</p>
              <p style={{ color: '#bbb', fontSize: '0.8rem', marginTop: '4px' }}>일정이 확정되면 공지해드릴게요 💛</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {visibleSessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => toggleSession(session.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '10px', border: 'none',
                    background: selectedSessionIds.has(session.id) ? '#FFF0EE' : '#f8fafc',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    outline: selectedSessionIds.has(session.id) ? '1.5px solid #FF6F61' : '1.5px solid transparent',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                    background: selectedSessionIds.has(session.id) ? '#FF6F61' : '#e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {selectedSessionIds.has(session.id) && <Check size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <p style={{ fontWeight: '800', color: '#111', fontSize: '0.8rem', marginBottom: '0' }}>{session.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: '600', margin: '0', minWidth: '115px' }}>
                        📅 {formatKorDate(session.eventDate)}
                      </p>
                      {session.ageRange && (
                        <p style={{ color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0' }}>👤 {session.ageRange}</p>
                      )}
                      {session.isCustomCuration ? (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          여성 우선 선발
                        </p>
                      ) : (
                        session.targetMaleAge && (
                          <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                            남성 {session.targetMaleAge}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedSessionIds.size > 0 && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#FFF0EE', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#FF6F61' }}>
              {selectedSessionIds.size}개 행사 선택됨
            </div>
          )}
        </div>

          {/* ─── Submit Button (Logged In) ─── */}
          {currentUser && renderSubmitButton()}

          {/* ─── Section 3: Profile Form ─── */}
        <div style={{ background: '#fff', borderRadius: '24px', padding: '28px 24px', marginTop: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '36px', height: '36px', background: '#FFF0EE', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#FF6F61" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#111', marginBottom: '2px' }}>기본 정보 입력</h2>
              <p style={{ fontSize: '0.78rem', color: '#999' }}>* 표시 항목은 필수입니다</p>
            </div>
          </div>

          {currentUser && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: '#F8FAFC', padding: '16px', borderRadius: '16px',
              border: '1px dashed #CBD5E1', marginBottom: '28px'
            }}>
              <div>
                <p style={{ fontSize: '0.9rem', color: '#334155', fontWeight: '700', marginBottom: '4px', lineHeight: '1.4' }}>
                  기존 프로필 정보가 자동으로 입력되었습니다.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '500', lineHeight: '1.4' }}>
                  직업이나 외적인 변화, 이상형 등 <strong>변경된 내용이 있을 경우에</strong> 자유롭게 수정해 주세요!
                </p>
              </div>
            </div>
          )}

          <FormField errorFields={errorFields} id="field-name" label="이름" required>
            <input
              className="kl-input"
              placeholder="실명을 입력해 주세요"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              style={inputStyle}
            />
          </FormField>

          <FormField errorFields={errorFields} id="field-gender" label="성별" required>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['male', 'female'] as const).filter(g => {
                if (isGenderLocked && form.gender !== g) return false;
                return true;
              }).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    if (isGenderLocked) return;
                    setField('gender', g);
                    
                    if (form.name.toLowerCase().includes('tset') || form.name.toLowerCase().includes('test')) {
                      const counterStr = localStorage.getItem('kl_test_phone_counter') || '0';
                      const counter = parseInt(counterStr, 10);
                      localStorage.setItem('kl_test_phone_counter', (counter + 1).toString());
                      const padNum = counter.toString().padStart(8, '0');
                      const testPhone = `011-${padNum.slice(0,4)}-${padNum.slice(4)}`;

                      setForm(prev => ({
                        ...prev,
                        gender: g,
                        birthDate: '950101',
                        phone: testPhone,
                        height: g === 'male' ? '180' : '165',
                        weight: g === 'male' ? '75' : '50',
                        residence: '테스트시 테스트구',
                        workplace: '테스트회사 / 테스트직무',
                        smoking: '비흡연',
                        drinking: '안 마심',
                        religion: '무교',
                        idealType: '테스트 이상형입니다.',
                        nonIdealType: '테스트 비선호형입니다.',
                        drink: ['아이스 아메리카노'],
                      }));
                      if (photos.length === 0) {
                        setPhotos(['https://dummyimage.com/600x400/FF6F61/fff&text=TEST']);
                      }
                      setAgreements({ terms: true, privacy: true, thirdParty: true, refund: true, marketing: true });
                      toast.success('테스트용 데이터가 자동 입력되었습니다!');
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem',
                    background: form.gender === g ? '#FF6F61' : '#f8fafc',
                    color: form.gender === g ? '#fff' : '#555',
                    transition: 'all 0.15s',
                  }}
                >
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </FormField>

          <FormField errorFields={errorFields} id="field-birthDate" label="생년월일" required>
            <input
              className="kl-input"
              placeholder="ex. 940530"
              value={form.birthDate}
              onChange={handleBirthDateChange}
              style={inputStyle}
            />
          </FormField>

          <FormField errorFields={errorFields} id="field-phone" label="전화번호" required>
            <input
              className="kl-input"
              type="tel"
              placeholder="ex) 010-1234-5678"
              value={form.phone}
              onChange={handlePhoneChange}
              style={inputStyle}
            />
          </FormField>

          <FormField errorFields={errorFields} label="인스타그램 계정">
            <input
              className="kl-input"
              value={form.instaId}
              onChange={e => setField('instaId', e.target.value)}
              style={inputStyle}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField errorFields={errorFields} id="field-height" label="키 (cm)" required>
              <input
                className="kl-input"
                placeholder="ex) 178"
                value={form.height}
                onChange={e => setField('height', e.target.value)}
                style={inputStyle}
              />
            </FormField>
            <FormField errorFields={errorFields} id="field-weight" label="체중 (kg)" required>
              <input
                className="kl-input"
                placeholder="ex) 72"
                value={form.weight}
                onChange={e => setField('weight', e.target.value)}
                style={inputStyle}
              />
            </FormField>
          </div>

          <FormField errorFields={errorFields} id="field-residence" label="거주지" required>
            <input
              className="kl-input"
              placeholder="ex) 부산 수영구"
              value={form.residence}
              onChange={e => setField('residence', e.target.value)}
              style={inputStyle}
            />
          </FormField>

          <FormField errorFields={errorFields} id="field-workplace" label="회사명 / 직무" required>
            <textarea
              className="kl-input"
              placeholder={`ex) 수액병원, 간호사\n링크은행, 은행원`}
              value={form.workplace}
              onChange={e => setField('workplace', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px', lineHeight: '1.6' }}
            />
          </FormField>

          <FormField errorFields={errorFields} label="겹치고 싶지 않은 지인 (선택)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(form.avoidList || []).map((entry, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, padding: '12px', flex: '2', minWidth: 0, fontSize: '0.85rem' }}
                    value={entry.name || ''}
                    onChange={e => setForm(p => ({
                      ...p,
                      avoidList: p.avoidList.map((v, i) => i === idx ? { ...v, name: e.target.value } : v)
                    }))}
                    placeholder="이름"
                  />
                  <input
                    style={{ ...inputStyle, padding: '12px', flex: '1', minWidth: 0, fontSize: '0.85rem' }}
                    value={entry.birthYear || ''}
                    onChange={e => setForm(p => ({
                      ...p,
                      avoidList: p.avoidList.map((v, i) => i === idx ? { ...v, birthYear: e.target.value } : v)
                    }))}
                    placeholder="년생"
                  />
                  <input
                    style={{ ...inputStyle, padding: '12px', flex: '2', minWidth: 0, fontSize: '0.85rem' }}
                    value={entry.workplace || ''}
                    onChange={e => setForm(p => ({
                      ...p,
                      avoidList: p.avoidList.map((v, i) => i === idx ? { ...v, workplace: e.target.value } : v)
                    }))}
                    placeholder="직장"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, avoidList: p.avoidList.filter((_, i) => i !== idx) }))}
                    style={{ flexShrink: 0, background: '#FFF0EE', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FF6F61' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, avoidList: [...(p.avoidList || []), { name: '', birthYear: '', workplace: '' }] }))}
                style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '10px', border: '1.5px dashed #FFDBE9', background: 'transparent', color: '#FF6F61', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                + 추가
              </button>
            </div>
          </FormField>

          <FormField errorFields={errorFields} label="이상형 (최대 5가지)">
            <textarea
              className="kl-input"
              placeholder={'ex) 자기관리하는, 비흡연, 173이상, 94~00년 등 자유롭게 적어주세요.'}
              value={form.idealType}
              onChange={e => setField('idealType', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', lineHeight: '1.6' }}
            />
          </FormField>

          <FormField errorFields={errorFields} label="비선호형 (최대 5가지)">
            <textarea
              className="kl-input"
              placeholder={'ex) 키, 몸매, 흡연 및 음주여부, 경제력, 원하지 않는 나이대 등 자유롭게 적어주세요.'}
              value={form.nonIdealType}
              onChange={e => setField('nonIdealType', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', lineHeight: '1.6' }}
            />
          </FormField>

          <FormField errorFields={errorFields} id="field-smoking" label="흡연 유무" required>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['비흡연', '전자담배', '연초'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setField('smoking', opt)}
                  style={{
                    padding: '10px 18px', borderRadius: '100px', cursor: 'pointer',
                    border: form.smoking === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5',
                    background: form.smoking === opt ? '#FFF5F4' : '#fff',
                    color: form.smoking === opt ? '#FF6F61' : '#AAA',
                    fontWeight: '700', fontSize: '0.85rem', transition: 'all 0.15s'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </FormField>

          <FormField errorFields={errorFields} id="field-drinking" label="음주 빈도" required>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['안 마심', '가끔 (월 1~2회)', '주 1~2회', '즐겨 마시는 편'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setField('drinking', opt)}
                  style={{
                    padding: '10px 18px', borderRadius: '100px', cursor: 'pointer',
                    border: form.drinking === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5',
                    background: form.drinking === opt ? '#FFF5F4' : '#fff',
                    color: form.drinking === opt ? '#FF6F61' : '#AAA',
                    fontWeight: '700', fontSize: '0.85rem', transition: 'all 0.15s'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </FormField>

          <FormField errorFields={errorFields} id="field-religion" label="종교" required>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['무교', '기독교', '천주교', '불교', '기타'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setField('religion', opt)}
                  style={{
                    padding: '10px 18px', borderRadius: '100px', cursor: 'pointer',
                    border: form.religion === opt ? '2px solid #FF6F61' : '1px solid #FFE8E5',
                    background: form.religion === opt ? '#FFF5F4' : '#fff',
                    color: form.religion === opt ? '#FF6F61' : '#AAA',
                    fontWeight: '700', fontSize: '0.85rem', transition: 'all 0.15s'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </FormField>

          <FormField errorFields={errorFields} id="field-drink" label="희망 음료" required>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['아이스 아메리카노', '복숭아 아이스티', '얼그레이', '페퍼민트', '카라멜 블랙티', '물', '따뜻한 음료'].map(d => {
                const currentDrinks = form.drink || [];
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
                      setField('drink', next);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: '700',
                      cursor: isWarmDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                      background: selected ? '#FF6F61' : (isWarmDisabled ? '#F1F5F9' : '#fff'),
                      color: selected ? '#fff' : (isWarmDisabled ? '#94A3B8' : '#64748B'),
                      border: selected ? '1.5px solid #FF6F61' : '1.5px solid #E2E8F0',
                    }}
                  >
                    {d === '따뜻한 음료' ? '따뜻한 음료 (중복 선택 가능)' : d}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField errorFields={errorFields} label="특이사항 / 키링크에게 바라는 점">
            <textarea
              className="kl-input"
              placeholder="알러지 여부나 기타 요청사항"
              value={form.etc}
              onChange={e => setField('etc', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px', lineHeight: '1.6' }}
            />
          </FormField>

          <FormField errorFields={errorFields} id="field-photos" label={`본인 사진 업로드 (${photos.length}/5)`} required>
            <div style={{ background: '#FFFDFD', border: '1.5px dashed #FFDBE9', borderRadius: '16px', padding: '24px' }}>
              <p style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.6, marginBottom: '20px', fontWeight: '500' }}>
                과도한 보정이나 마스크 착용 사진은 지양해주세요.<br/>
                <strong style={{ color: '#FF6F61' }}>얼굴과 전신 사진이 포함되도록<br />자유롭게 총 5장까지 등록가능</strong>
              </p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {photos.map((src, i) => (
                  <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #FFDBE9', boxShadow: '0 4px 12px rgba(255,111,97,0.1)' }}>
                    <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="profile" />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button type="button" onClick={() => photoInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: '14px', border: '1.5px dashed #FFDBE9', background: '#FFFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFDBE9', gap: '4px' }}>
                    <Upload size={24} />
                    <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>추가</span>
                  </button>
                )}
              </div>
            </div>
            <input ref={photoInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </FormField>

          <FormField errorFields={errorFields} label="재직 증명 (선택)">
            <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.6, marginBottom: '16px' }}>
                <strong style={{ color: '#FF6F61' }}>지금 당장 서류가 없으신가요? 일단 비워두고 신청하셔도 됩니다! (선발 후 제출 가능)</strong><br />
                신뢰할 수 있는 모임을 위해 서류(재직증명서, 급여명세서, 건강보험, 사원증, 명함 등) 중 하나를 업로드해 주세요.
              </p>
              
              {(verificationPreview || form.employmentProof) && (
                <div style={{ marginBottom: '16px', padding: '12px', background: '#fff', borderRadius: '12px', border: '1px solid #FFE8E5', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(verificationPreview.startsWith('data:image') || form.employmentProof.startsWith('data:image') || form.employmentProof.startsWith('http')) ? (
                    <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                      <img src={verificationPreview || form.employmentProof} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={24} color="#94A3B8" />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155' }}>{verificationFileName || '등록된 증빙 서류'}</p>
                    <p style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <CheckCircle2 size={12} /> {verificationFile ? '업로드 준비 완료' : '인증 대기 중'}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setVerificationFile(null); setVerificationPreview(''); setField('employmentProof', ''); }} style={{ padding: '8px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>
              )}

              <p style={{ fontSize: '0.82rem', color: '#0F172A', fontWeight: '800', marginBottom: '16px' }}>
                <strong>"업로드하신 모든 서류는 철저히 암호화되어 안전하게 보호됩니다."</strong>
              </p>
              
              <button 
                type="button"
                onClick={() => verifyInputRef.current?.click()} 
                style={{ padding: '10px 20px', borderRadius: '10px', background: '#fff', border: '1.5px solid #CBD5E1', color: '#475569', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Upload size={16} /> 파일 변경
              </button>
              <input ref={verifyInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleVerifyUpload} />
            </div>
          </FormField>
        </div>

        {/* ─── Submit Button (Guest) ─── */}
        {!currentUser && renderSubmitButton()}

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#bbb', marginTop: '12px', lineHeight: 1.6 }}>
          신청 후 관리자 검토를 거쳐 확정 안내 문자를 드립니다.<br />
          이미 가입하신 분은{' '}
          <Link href="/login" style={{ color: '#FF6F61', fontWeight: '700', textDecoration: 'none' }}>로그인</Link>
          {' '}후 신청해 주세요.
        </p>
      </div>

      {/* ─── Duplicate Account Modal ─── */}
      {dupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#fff', borderRadius: '28px', width: '100%', maxWidth: '400px', padding: '36px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <button onClick={() => setDupModal(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: '#FFF0EE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: '1.8rem' }}>🔍</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', marginBottom: '10px' }}>이미 가입된 번호예요!</h2>
              <p style={{ color: '#666', fontSize: '0.88rem', lineHeight: 1.7 }}>
                <strong style={{ color: '#111' }}>{dupModal.phone}</strong> 번호로<br />
                이미 가입된 계정이 있습니다.
              </p>
            </div>

            {dupModal.provider === 'kakao' && (
              <button
                onClick={() => { setDupModal(null); handleKakaoLoginFunnel(); }}
                style={{ width: '100%', padding: '15px', background: '#FEE500', border: 'none', borderRadius: '100px', fontWeight: '800', fontSize: '0.95rem', color: '#3c1e1e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#3c1e1e"><path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" /></svg>
                카카오로 로그인하고 신청 완료하기 💛
              </button>
            )}

            {dupModal.provider === 'google' && (
              <button
                onClick={() => { setDupModal(null); handleGoogleLoginFunnel(); }}
                style={{ width: '100%', padding: '15px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '100px', fontWeight: '800', fontSize: '0.95rem', color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                구글로 로그인하고 신청 완료하기
              </button>
            )}

            {dupModal.provider === 'email' && (
              <Link
                href={`/login?redirect=/apply/fast`}
                style={{ display: 'block', width: '100%', padding: '15px', background: '#FF6F61', border: 'none', borderRadius: '100px', fontWeight: '800', fontSize: '0.95rem', color: '#fff', textDecoration: 'none', textAlign: 'center', marginBottom: '10px', boxSizing: 'border-box' }}
              >
                아이디/비밀번호로 로그인하기
              </Link>
            )}

            <button
              onClick={() => setDupModal(null)}
              style={{ width: '100%', padding: '12px', background: '#f8fafc', border: 'none', borderRadius: '100px', fontWeight: '600', fontSize: '0.85rem', color: '#888', cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ─── Signup Funnel Modal ─── */}
      {funnelModal && (
        <div 
          onClick={() => {
            setFunnelModal(false);
            if (window.history.state?.funnelOpen) window.history.back(); // popstate 트리거로 일원화
            else saveNonMemberApplication(undefined);
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: '600px', padding: '32px 24px 40px', boxShadow: '0 -20px 60px rgba(0,0,0,0.12)' }}
          >
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '100px', margin: '0 auto 24px' }} />

            {!nonMemberWarning ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#FF6F61', marginBottom: '16px' }}>[신청 완료!]</h3>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#111', marginBottom: '10px', lineHeight: 1.3 }}>
                    1초 만에 가입 완료하고<br />5,000원 할인쿠폰 받기!
                  </h2>
                  <p style={{ color: '#777', fontSize: '0.88rem', lineHeight: 1.7 }}>
                    가입하시면 <strong style={{ color: '#FF6F61' }}>내가 받은 호감 득표수</strong>까지<br />
                    모두 확인하실 수 있어요
                  </p>
                </div>

                {/* Social login buttons (Styled like SocialAuth) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
                  <button
                    onClick={handleKakaoLoginFunnel}
                    disabled={socialLoading}
                    style={{ width: '54px', height: '54px', background: '#FEE500', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
                    title="카카오 로그인"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#3c1e1e"><path d="M12 2C6.48 2 2 5.92 2 10.8c0 3.12 1.75 5.87 4.38 7.53L5.44 22l4.35-2.3c.72.2 1.45.3 2.21.3 5.52 0 10-3.93 10-8.8S17.52 2 12 2z" /></svg>
                  </button>

                  <button
                    onClick={handleGoogleLoginFunnel}
                    disabled={socialLoading}
                    style={{ width: '54px', height: '54px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
                    title="구글 로그인"
                  >
                    {socialLoading ? <Loader2 size={24} className="animate-spin" /> : (
                      <svg width="24" height="24" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div style={{ height: '1px', background: '#f1f5f9', marginBottom: '20px' }} />

                <button
                  onClick={() => setNonMemberWarning(true)}
                  style={{ width: '100%', padding: '14px', background: 'transparent', border: 'none', color: '#aaa', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer' }}
                >
                  다음에 하기 (비회원으로 진행)
                </button>
              </>
            ) : (
              <>
                <div style={{ padding: '0 10px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#111', marginBottom: '12px' }}>비회원 신청 완료</h2>
                    <p style={{ fontSize: '0.9rem', color: '#666', lineHeight: 1.5 }}>
                      신청이 성공적으로 접수되었습니다.<br/>
                      비회원 로그인 시 사용할 비밀번호는<br/>
                      <strong style={{ color: '#111' }}>휴대폰 번호 뒷 4자리</strong>로 자동 설정되었습니다.
                    </p>
                  </div>

                  <div style={{ background: '#FFF8E7', borderRadius: '16px', padding: '20px', marginBottom: '24px', border: '1px solid #FFE9A0' }}>
                    <p style={{ fontWeight: '800', color: '#B45309', marginBottom: '12px', fontSize: '0.9rem' }}>⚠️ 비회원 로그인 시 제한사항</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {[
                        '내가 받은 호감 득표수를 조회할 수 없습니다.',
                        '매칭 성공/실패 여부만 확인 가능합니다.',
                      ].map(item => (
                        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', color: '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                          <X size={14} color="#EF4444" style={{ marginTop: '2px', flexShrink: 0 }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      onClick={() => {
                        sessionStorage.removeItem('kl_fast_apply_backup');
                        setFunnelModal(false);
                        setSubmitted(true);
                      }}
                      style={{ width: '100%', padding: '15px', background: '#475569', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                    >
                      닫기 (그대로 사용)
                    </button>
                    <button
                      onClick={() => setPinModalOpen(true)}
                      style={{ width: '100%', padding: '15px', background: '#fff', color: '#FF6F61', border: '1px solid #FF6F61', borderRadius: '14px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                    >
                      비밀번호 설정
                    </button>
                    <button
                      onClick={() => setNonMemberWarning(false)}
                      style={{ width: '100%', padding: '13px', background: '#FFF0EE', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '0.95rem', color: '#FF6F61', cursor: 'pointer' }}
                    >
                      ← 소셜 로그인으로 돌아가기
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Non-Member PIN Setup Modal ─── */}
      {pinModalOpen && (
        <div 
          onClick={() => {
            setPinModalOpen(false);
            setFunnelModal(false);
            if (window.history.state?.funnelOpen) window.history.back();
            else saveNonMemberApplication(undefined);
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '20px' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '360px', padding: '32px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', textAlign: 'center' }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111', marginBottom: '8px' }}>비회원 로그인 비밀번호 설정</h2>
            <p style={{ color: '#777', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '24px', wordBreak: 'keep-all' }}>
              <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>(설정하지 않으시면 휴대폰 번호 뒷자리 4개로 자동 설정됩니다.)</span>
            </p>

            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input
                type={showGuestPin ? 'text' : 'password'}
                maxLength={4}
                value={guestPin}
                onChange={e => setGuestPin(e.target.value.replace(/\\D/g, ''))}
                placeholder="숫자 4자리 입력"
                style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #e2e8f0', background: '#f8fafc', fontSize: '1.2rem', fontWeight: '800', textAlign: 'center', letterSpacing: '0.2em', outline: 'none', transition: 'border-color 0.2s', paddingRight: '48px' }}
                onFocus={e => (e.target.style.borderColor = '#FF6F61')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
              <button
                type="button"
                onClick={() => setShowGuestPin(!showGuestPin)}
                style={{
                  position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {showGuestPin ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                disabled={guestPin.length > 0 && guestPin.length < 4}
                onClick={() => {
                  setPinModalOpen(false);
                  saveNonMemberApplication(guestPin.length === 4 ? guestPin : undefined);
                }}
                style={{ width: '100%', padding: '15px', background: guestPin.length === 4 ? '#FF6F61' : '#f1f5f9', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '0.95rem', color: guestPin.length === 4 ? '#fff' : '#64748b', cursor: (guestPin.length > 0 && guestPin.length < 4) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {guestPin.length === 4 ? '이 비밀번호로 설정하기' : '기본(휴대폰 뒷자리)으로 진행'}
              </button>
              <button
                onClick={() => setPinModalOpen(false)}
                style={{ width: '100%', padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small helper components ── */
function FormField({ id, label, required, errorFields, children }: { id?: string; label: string; required?: boolean; errorFields?: string[]; children: React.ReactNode }) {
  const hasError = id && errorFields?.includes(id);
  return (
    <div id={id} style={{ 
      marginBottom: '24px', 
      padding: hasError ? '16px' : '0', 
      border: hasError ? '1.5px solid #EF4444' : 'none', 
      borderRadius: hasError ? '16px' : '0', 
      background: hasError ? '#FEF2F2' : 'transparent', 
      transition: 'all 0.2s' 
    }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: hasError ? '#EF4444' : '#555', marginBottom: '8px' }}>
        {label} {required && <span style={{ color: '#FF6F61' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, appearance: 'none', paddingRight: '40px', cursor: 'pointer', color: value ? '#111' : '#aaa' }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} color="#aaa" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: '12px',
  border: '1.5px solid #e8ecf0', background: '#f8fafc',
  fontSize: '0.9rem', fontWeight: '600', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
  fontFamily: 'inherit',
};

export default function FastApplyPage({ initialSessions }: { initialSessions?: any[] }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 40, height: 40, border: '4px solid #FF6F61', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>}>
      <FastApplyContent initialSessions={initialSessions} />
    </Suspense>
  );
}
