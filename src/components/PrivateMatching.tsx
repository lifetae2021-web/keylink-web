'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, where, query, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { CheckCircle, Upload, X, AlertCircle, ArrowRight, UserCheck, Search, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PrivateMatching() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false); // v8.12.8: 중복 신청 체크
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Deep Info, 3: Success

  const [form, setForm] = useState({
    name: '',
    gender: '' as 'male' | 'female' | '',
    birthDate: '',
    phone: '',
    job: '',
    residence: '',
    maritalStatus: false, // true means single
    idealType1: '',
    idealType2: '',
    idealType3: '',
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [idProof, setIdProof] = useState<string>('');
  const [jobProof, setJobProof] = useState<string>('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);
  const jobProofInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ uid: currentUser.uid, ...userData });
            
            // Auto-sync data
            setForm(prev => ({
              ...prev,
              name: userData.name || '',
              gender: userData.gender || '',
              birthDate: userData.birthDate || '',
              phone: userData.phone || '',
              job: userData.job || userData.workplace?.split(',')[0] || '',
              residence: userData.residence || userData.location || '',
            }));

            // v8.12.8: 중복 신청 여부 체크
            const q = query(collection(db, 'private_applications'), where('userId', '==', currentUser.uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
              setHasApplied(true);
            }

          } else {
            setUser({ uid: currentUser.uid });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("유저 정보를 불러오는데 실패했습니다.");
        }
      } else {
        toast.error("로그인이 필요한 서비스입니다.");
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>, isArray: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('파일 크기는 5MB 이내여야 합니다.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (isArray) {
          setPhotos(prev => [...prev, e.target?.result as string].slice(0, 5)); // Max 5 photos
        } else {
          setter(e.target?.result as string);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadFileToStorage = async (dataUrl: string, path: string) => {
    if (!dataUrl.startsWith('data:')) return dataUrl; // Already a URL
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!form.maritalStatus) return toast.error('법적 미혼 상태임을 확인해주세요.');
    if (!form.idealType1 || !form.idealType2 || !form.idealType3) return toast.error('이상형 조건을 모두 입력해주세요.');
    if (photos.length < 3) return toast.error('본인 사진을 최소 3장 이상 업로드해주세요.');
    if (!idProof) return toast.error('신분증 사본을 업로드해주세요.');
    if (!jobProof) return toast.error('재직증명서를 업로드해주세요.');

    setIsSubmitting(true);

    try {
      // 1. Upload photos
      const uploadedPhotos = await Promise.all(
        photos.map((photo, i) => uploadFileToStorage(photo, `private_matching/${user.uid}/photo_${Date.now()}_${i}.jpg`))
      );

      // 2. Upload proofs
      const uploadedIdProof = await uploadFileToStorage(idProof, `private_matching/${user.uid}/idProof_${Date.now()}.jpg`);
      const uploadedJobProof = await uploadFileToStorage(jobProof, `private_matching/${user.uid}/jobProof_${Date.now()}.jpg`);

      // 3. Save to private_applications collection
      await addDoc(collection(db, 'private_applications'), {
        userId: user.uid,
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        phone: form.phone,
        job: form.job,
        residence: form.residence,
        maritalStatus: form.maritalStatus,
        idealTypeConditions: [form.idealType1, form.idealType2, form.idealType3],
        photos: uploadedPhotos,
        idProofUrl: uploadedIdProof,
        jobProofUrl: uploadedJobProof,
        status: 'pending_consult', // 상담대기
        appliedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setStep(3); // Success step
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('신청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center pt-[80px]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>;
  }

  // v8.12.8: 이미 신청한 경우 예외 처리
  if (hasApplied) {
    return (
      <div className="min-h-screen bg-slate-50 pt-[100px] md:pt-[120px] pb-24 px-5">
        <div className="max-w-md mx-auto bg-white rounded-[32px] p-8 md:p-10 text-center shadow-sm border border-slate-100">
          <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-purple-500" />
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-4">이미 신청하셨습니다!</h2>
          <p className="text-sm md:text-base text-slate-500 mb-8 leading-relaxed font-medium">
            이미 1:1 프라이빗 매칭을 신청하신 상태입니다.<br />
            진행 상황은 마이페이지에서 확인하실 수 있습니다.
          </p>
          <button 
            onClick={() => router.push('/matching-results')}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-colors mb-3"
          >
            내 매칭 현황 확인하기
          </button>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-xl transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-[80px] pb-24">
      <div className="max-w-xl mx-auto px-5">
        
        {/* Progress Bar */}
        {step < 3 && (
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-800 mb-2">1:1 매칭 신청서 작성</h1>
            <div className="flex gap-2">
              <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-purple-500' : 'bg-slate-200'}`}></div>
              <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-purple-500' : 'bg-slate-200'}`}></div>
            </div>
            <p className="text-xs font-bold text-purple-600 mt-2 text-right">{step} / 2 단계</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {step === 1 && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100">
                <UserCheck className="text-purple-600 shrink-0" size={24} />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">기본 정보 연동 완료</h3>
                  <p className="text-xs text-slate-500 mt-1">기존 프로필 데이터가 안전하게 연동되었습니다. 수정이 필요한 경우 마이페이지에서 변경해주세요.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">이름</label>
                    <input type="text" value={form.name} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">성별</label>
                    <input type="text" value={form.gender === 'male' ? '남성' : form.gender === 'female' ? '여성' : ''} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">생년월일</label>
                    <input type="text" value={form.birthDate} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">연락처</label>
                    <input type="text" value={form.phone} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">직업</label>
                  <input type="text" value={form.job} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">거주지</label>
                  <input type="text" value={form.residence} disabled className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700" />
                </div>
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full mt-8 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-colors"
              >
                다음 단계로 <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><Search size={20} className="text-purple-500" /> 이상형 정보</h3>
                <p className="text-sm text-slate-500 mt-1">1:1 매칭을 위해 원하는 이상형의 조건을 구체적으로 작성해주세요. (우선순위 순)</p>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold text-purple-600 mb-1.5">1순위 조건 (필수)</label>
                  <input 
                    type="text" 
                    value={form.idealType1}
                    onChange={e => setForm(f => ({...f, idealType1: e.target.value}))}
                    placeholder="예: 키 175cm 이상, 다정한 성격" 
                    className="w-full bg-white border border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 mb-1.5">2순위 조건 (필수)</label>
                  <input 
                    type="text" 
                    value={form.idealType2}
                    onChange={e => setForm(f => ({...f, idealType2: e.target.value}))}
                    placeholder="예: 비흡연자, 안정적인 직장" 
                    className="w-full bg-white border border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-600 mb-1.5">3순위 조건 (필수)</label>
                  <input 
                    type="text" 
                    value={form.idealType3}
                    onChange={e => setForm(f => ({...f, idealType3: e.target.value}))}
                    placeholder="예: 같은 지역 거주, 취미가 비슷한 사람" 
                    className="w-full bg-white border border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all" 
                  />
                </div>
              </div>

              <hr className="border-slate-100 my-6" />

              <div className="mb-6">
                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><ImageIcon size={20} className="text-purple-500" /> 프로필 사진 (3~5장)</h3>
                <p className="text-sm text-slate-500 mt-1">상대방에게 신뢰를 줄 수 있는 얼굴이 잘 나온 사진을 올려주세요. (최소 3장)</p>
              </div>

              <div className="flex gap-3 flex-wrap mb-8">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={photo} className="w-full h-full object-cover" alt="profile" />
                    <button 
                      onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button 
                    onClick={() => photoInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition-colors"
                  >
                    <Upload size={20} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">추가</span>
                  </button>
                )}
                <input type="file" ref={photoInputRef} onChange={e => handleFileChange(e, () => {}, true)} accept="image/*" multiple className="hidden" />
              </div>

              <hr className="border-slate-100 my-6" />

              <div className="mb-6">
                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><ShieldCheck size={20} className="text-purple-500" /> 신원 인증</h3>
                <p className="text-sm text-slate-500 mt-1">안전한 매칭을 위해 필수 서류를 업로드해주세요.</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="font-bold text-sm text-slate-800">신분증 사본 <span className="text-[10px] text-rose-500 font-medium ml-1">(뒷자리는 가리고 업로드)</span></p>
                      <p className="text-xs text-slate-500">주민등록증, 운전면허증 등</p>
                    </div>
                    <button 
                      onClick={() => idProofInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                    >
                      {idProof ? '변경' : '업로드'}
                    </button>
                  </div>
                  {idProof && <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={14} /> 업로드 완료</p>}
                  <input type="file" ref={idProofInputRef} onChange={e => handleFileChange(e, setIdProof)} accept="image/*" className="hidden" />
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="font-bold text-sm text-slate-800">재직 증명 서류</p>
                      <p className="text-xs text-slate-500">재직증명서, 급여명세서, 건강보험자격득실 등</p>
                    </div>
                    <button 
                      onClick={() => jobProofInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                    >
                      {jobProof ? '변경' : '업로드'}
                    </button>
                  </div>
                  {jobProof && <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle size={14} /> 업로드 완료</p>}
                  <input type="file" ref={jobProofInputRef} onChange={e => handleFileChange(e, setJobProof)} accept="image/*" className="hidden" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.maritalStatus}
                    onChange={e => setForm(f => ({...f, maritalStatus: e.target.checked}))}
                    className="mt-1 w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">[필수] 법적 미혼 상태임을 확인합니다.</p>
                    <p className="text-xs text-slate-500 mt-1">허위 사실 기재 시 서비스 이용이 영구 정지되며, 법적 책임이 발생할 수 있습니다.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-colors"
                >
                  이전
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-2/3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-purple-200 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> 제출 중...</span>
                  ) : (
                    '매칭 신청 완료하기'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-8 md:p-12 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-4">신청이 완료되었습니다!</h2>
              <p className="text-sm md:text-base text-slate-500 mb-8 leading-relaxed font-medium">
                키링크 전문 매니저가 프로필을 검토한 후,<br className="hidden md:block" />
                작성해주신 이상형 조건에 맞는 분을 찾아<br className="hidden md:block" />
                순차적으로 연락드리겠습니다.
              </p>
              <button 
                onClick={() => router.push('/mypage')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-colors"
              >
                마이페이지로 이동
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
