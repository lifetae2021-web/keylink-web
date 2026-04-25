'use client';

import { X, User, ShieldCheck, Phone, Camera, MapPin, Briefcase, Users2, Wine, Cigarette, Info, Coffee, Heart, HeartOff, Mail, Calendar, Ruler, Weight, ExternalLink, History, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

interface UserProfileModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

// ── 상세 정보 행 (마이페이지 스타일)
const DetailRow = ({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon: any }) => {
  const isEmpty = !value || value === '미입력';
  return (
    <div className="flex items-center py-4 border-b border-slate-50 last:border-0 group">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FF7E7E]/10 transition-colors">
        <Icon size={18} className="text-slate-400 group-hover:text-[#FF7E7E] transition-colors" />
      </div>
      <div className="ml-4 flex-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={`text-[0.92rem] font-bold mt-0.5 ${isEmpty ? 'text-slate-300 italic font-normal' : 'text-slate-800'}`}>
          {isEmpty ? '미입력' : value}
        </p>
      </div>
    </div>
  );
};

// ── 긴 텍스트 박스
const TextBox = ({ label, value, icon: Icon, color }: { label: string; value?: string; icon: any; color: string }) => {
  const isEmpty = !value || value === '미입력';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color }} />
        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
      </div>
      <div className={`p-4 rounded-2xl text-[0.88rem] leading-relaxed font-semibold border ${isEmpty ? 'bg-slate-50 border-slate-100 text-slate-300 italic' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}>
        {isEmpty ? '작성된 내용이 없습니다.' : value}
      </div>
    </div>
  );
};

export default function UserProfileModal({ user: initialUser, isOpen, onClose }: UserProfileModalProps) {
  const [user, setUser] = useState(initialUser);
  const [isUpdating, setIsUpdating] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Sync state with props when modal opens or user changes
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setPhotoIndex(0);
    }
  }, [initialUser, isOpen]);

  if (!user) return null;

  const handleToggleVerify = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const newStatus = !user.isVerified;
      const userRef = doc(db, 'users', user.uid || user.id);
      const updateData: any = { isVerified: newStatus };
      if (newStatus) updateData.status = 'verified'; // 승인 시 상태도 함께 변경
      
      await updateDoc(userRef, updateData);
      setUser((prev: any) => ({ ...prev, ...updateData }));
      toast.success(newStatus ? '재직 인증 및 승인이 완료되었습니다.' : '인증이 취소되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('상태 변경에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveWorkplace = async (latestWorkplace: string) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', user.uid || user.id);
      const updateData: any = { admin_job: latestWorkplace, job: latestWorkplace, isJobReviewed: true };
      
      await updateDoc(userRef, updateData);
      setUser((prev: any) => ({ ...prev, ...updateData }));
      toast.success('유저가 입력한 직업이 마스터 정보로 반영되고 승인되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('직업 마스터 반영에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const age = user.birthDate
    ? new Date().getFullYear() - parseInt(user.birthDate.split('-')[0]) + 1
    : null;

  const photos: string[] = [
    ...(Array.isArray(user.photos) ? user.photos : []),
    ...(!Array.isArray(user.photos) && (user.photoUrl || user.photoURL) ? [user.photoUrl || user.photoURL] : []),
  ].filter(Boolean);
  const currentPhoto = photos[photoIndex] || null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            className="relative w-full max-w-xl max-h-[90vh] overflow-hidden bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl flex flex-col"
          >
            {/* Header Area */}
            <div className="absolute top-6 right-6 z-30">
              <button
                onClick={onClose}
                className="p-2.5 rounded-full bg-white/80 backdrop-blur-md text-slate-400 hover:text-slate-800 transition-all border border-slate-200 shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto kl-scrollbar pb-12">
              
              {/* Profile Image & Name Section */}
              <div className="relative h-72 bg-slate-100 border-b border-slate-100 overflow-hidden">
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                    <User size={80} strokeWidth={1} className="text-slate-200" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />

                {/* 슬라이더 화살표 */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-white/70 backdrop-blur-sm text-slate-700 hover:bg-white transition-all shadow"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-white/70 backdrop-blur-sm text-slate-700 hover:bg-white transition-all shadow"
                    >
                      <ChevronRight size={18} />
                    </button>
                    {/* 페이지 dot */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPhotoIndex(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${i === photoIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                <div className="absolute bottom-6 left-8 right-6">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{user.name || '이름 없음'}</h3>
                    {user.isVerified && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500 text-white rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-sm">
                        <ShieldCheck size={11} fill="white" /> 인증 완료
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className={user.gender === 'male' ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md' : 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md'}>
                      {user.gender === 'male' ? '남성' : '여성'}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-700">{user.birthDate ? `${user.birthDate.includes('-') ? user.birthDate.slice(2,4) : user.birthDate.slice(0,2)}년생` : '??'}</span>
                  </div>
                  <DetailRow label="거주지" value={user.residence || user.location} icon={MapPin} />
                </div>
              </div>

              {/* Detail Content */}
              <div className="px-8 pt-8 space-y-10">
                
                {/* v8.8.8: Audit Logs & Master Data Reflection */}
                {(!user.isJobReviewed && user.user_logs && user.user_logs.length > 0) && (
                  <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle size={18} className="text-rose-500" />
                      <h4 className="text-[0.95rem] font-black text-rose-600 tracking-tight">유저 정보 수정 알림</h4>
                    </div>
                    <p className="text-xs text-rose-500/80 font-bold mb-4">
                      유저가 본인의 프로필 정보를 수정했습니다. 변경된 '회사명/직무'를 확인하시고, 라인업 화면에 공개할 마스터 직업에 편입시켜 주세요.
                    </p>
                    <div className="space-y-2 mb-4">
                      {[...user.user_logs].reverse().slice(0, 3).map((log: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl p-3 shadow-sm border border-rose-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5 max-w-[200px] truncate">{log.changedAt ? new Date(log.changedAt).toLocaleString() : '최근'}</span>
                            <div className="flex items-center gap-2 text-[0.85rem] font-bold text-slate-700">
                              <span className="line-through text-slate-400 max-w-[120px] truncate">{log.oldValue || '비어있음'}</span>
                              <span className="text-xs text-rose-300">→</span>
                              <span className="text-rose-600 max-w-[150px] truncate">{log.newValue}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => handleApproveWorkplace(user.user_logs[user.user_logs.length - 1].newValue)}
                      disabled={isUpdating}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-[0.85rem] transition-all shadow-md shadow-rose-200"
                    >
                      <CheckCircle size={16} /> 변경 내용 마스터 데이터에 반영 및 승인
                    </button>
                  </div>
                )}

                {/* 1. 핵심 연락 정보 */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-6 space-y-1">
                  <DetailRow label="연락처" value={user.phone} icon={Phone} />
                  <DetailRow label="인스타그램" value={user.instaId} icon={Camera} />
                  <DetailRow label="거주지" value={user.residence || user.location} icon={MapPin} />
                </div>

                {/* 2. 신체 및 직업 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-[#FF7E7E] rounded-full" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Physical & Career</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8">
                    <DetailRow label="키" value={user.height ? `${user.height}cm` : null} icon={Ruler} />
                    <DetailRow label="몸무게" value={user.weight ? `${user.weight}kg` : null} icon={Weight} />
                  </div>
                  <DetailRow label="회사명/직무" value={user.workplace || user.jobRole || user.job} icon={Briefcase} />
                  <DetailRow label="출생" value={user.birthDate ? `${user.birthDate.includes('-') ? user.birthDate.slice(2,4) : user.birthDate.slice(0,2)}년생` : null} icon={Calendar} />
                  
                  {/* v7.8.0 재직 증명 확인 섹션 */}
                  <div className="flex items-center justify-between py-4 border-b border-slate-50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <ShieldCheck size={18} className="text-blue-500" />
                      </div>
                      <div className="ml-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">재직 인증 서류</p>
                        {(user.employmentProof || user.verificationUrl) ? (
                          <a href={user.employmentProof || user.verificationUrl} target="_blank" rel="noreferrer" className="text-[0.85rem] font-black text-blue-600 hover:underline flex items-center gap-1">
                            서류 확인하기 <ExternalLink size={12} />
                          </a>
                        ) : (
                          <p className="text-[0.85rem] font-bold text-slate-300 italic">미업로드</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleToggleVerify}
                      disabled={isUpdating}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        user.isVerified 
                          ? 'bg-rose-50 text-rose-500 hover:bg-rose-100' 
                          : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-200'
                      }`}
                    >
                      {isUpdating ? '처리 중...' : user.isVerified ? '인증 취소' : '인증 승인'}
                    </button>
                  </div>

                  <DetailRow label="지인 회피" value={user.avoidAcquaintance} icon={Users2} />
                </div>

                {/* 3. 라이프스타일 및 취향 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-indigo-400 rounded-full" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lifestyle</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8">
                    <DetailRow label="음주 빈도" value={user.drinking} icon={Wine} />
                    <DetailRow label="흡연 여부" value={user.smoking} icon={Cigarette} />
                    <DetailRow label="종교" value={user.religion} icon={Info} />
                    <DetailRow label="희망 음료" value={Array.isArray(user.drink) ? user.drink.join(', ') : user.drink} icon={Coffee} />
                  </div>
                </div>

                {/* 4. 이상형 및 자기소개 (하이라이트) */}
                <div className="space-y-8 pt-4">
                  <TextBox label="이상형 (Ideal Type)" value={user.idealType} icon={Heart} color="#FF6F61" />
                  <TextBox label="비선호형 (Non-Ideal)" value={user.nonIdealType} icon={HeartOff} color="#64748B" />
                  <TextBox label="기타 특이사항" value={user.etc || user.about} icon={Info} color="#A78BFA" />
                </div>

                {/* 5. 계정 메타 정보 */}
                <div className="flex items-center justify-between pt-8 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail size={14} />
                    <span className="text-xs font-bold">{user.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={14} />
                    <span className="text-xs font-bold">
                      가입: {user.createdAt?.seconds ? format(new Date(user.createdAt.seconds * 1000), 'yy.MM.dd') : '-'}
                    </span>
                  </div>
                </div>

                {/* 6. 활동 지표 */}
                <div className="flex gap-4 pt-4">
                  <div className="flex-1 p-4 rounded-3xl bg-blue-50 border border-blue-100 text-center">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">참여</p>
                    <p className="text-xl font-black text-blue-700">{user.participationCount || 0}</p>
                  </div>
                  <div className="flex-1 p-4 rounded-3xl bg-rose-50 border border-rose-100 text-center">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">성공</p>
                    <p className="text-xl font-black text-rose-700">{user.matchCount || 0}</p>
                  </div>
                  <div className="flex-1 p-4 rounded-3xl bg-slate-50 border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">노쇼</p>
                    <p className="text-xl font-black text-slate-700">{user.noShowCount || 0}</p>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
