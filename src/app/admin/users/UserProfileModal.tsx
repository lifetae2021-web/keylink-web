'use client';

import { X, User, MapPin, Heart, Ruler, Cigarette, Wine, Info, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface UserProfileModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

// ── 재사용 섹션 헤더
const SectionLabel = ({ children }: { children: string }) => (
  <p className="text-[10px] uppercase tracking-[0.18em] font-black text-[#FF7E7E] mb-3">{children}</p>
);

// ── 개별 정보 행
const InfoRow = ({
  icon: Icon,
  label,
  value,
  iconColor = '#FF7E7E',
}: {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
  iconColor?: string;
}) => (
  <div className="flex items-center gap-4">
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${iconColor}18` }}
    >
      <Icon size={17} color={iconColor} />
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</span>
      <span className="text-[0.88rem] text-slate-800 font-semibold truncate">
        {value || <span className="text-slate-300 font-normal">미입력</span>}
      </span>
    </div>
  </div>
);

export default function UserProfileModal({ user, isOpen, onClose }: UserProfileModalProps) {
  if (!user) return null;

  const age = user.birthDate
    ? new Date().getFullYear() - parseInt(user.birthDate.split('-')[0]) + 1
    : null;

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
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden bg-white border border-slate-200 rounded-[2rem] shadow-2xl flex flex-col"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 z-20 p-2 rounded-full bg-white text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all border border-slate-200 shadow-sm"
            >
              <X size={18} />
            </button>

            <div className="overflow-y-auto">

              {/* ── 헤더 / 커버 ── */}
              <div className="relative h-60 bg-slate-100 border-b border-slate-200 overflow-hidden">
                {(user.photoUrl || user.photoURL) ? (
                  <img
                    src={user.photoUrl || user.photoURL}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={100} strokeWidth={1} className="text-slate-300" />
                  </div>
                )}
                {/* gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />

                {/* 이름 오버레이 */}
                <div className="absolute bottom-6 left-8 space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{user.name || '이름 없음'}</h3>
                    {user.status === 'verified' && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                        <ShieldCheck size={11} /> 인증 완료
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className={user.gender === 'male' ? 'text-blue-500' : 'text-rose-500'}>
                      {user.gender === 'male' ? '남성' : '여성'}
                    </span>
                    {age && (<><span className="text-slate-300">·</span><span className="text-slate-600">{age}세</span></>)}
                    {(user.job || user.occupation) && (
                      <><span className="text-slate-300">·</span><span className="text-slate-700">{user.job || user.occupation}</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 본문 ── */}
              <div className="p-8 space-y-6">

                {/* 섹션 1: 기본 정보 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <SectionLabel>기본 정보</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={MapPin}   label="거주지"   value={user.location}  iconColor="#FF7E7E" />
                    <InfoRow icon={Heart}    label="MBTI"     value={user.mbti}      iconColor="#A78BFA" />
                    <InfoRow icon={Ruler}    label="키"       value={user.height ? `${user.height}cm` : null} iconColor="#38BDF8" />
                    <InfoRow icon={Info}     label="종교"     value={user.religion}  iconColor="#FB923C" />
                  </div>
                </div>

                {/* 섹션 2: 라이프스타일 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <SectionLabel>라이프스타일</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={Cigarette} label="흡연 여부" value={user.smoking}  iconColor="#64748B" />
                    <InfoRow icon={Wine}      label="음주 여부" value={user.drinking} iconColor="#8B5CF6" />
                  </div>
                </div>

                {/* 섹션 3: 자기 소개 */}
                <div className="space-y-2">
                  <SectionLabel>자기 소개</SectionLabel>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-700 text-[0.9rem] leading-relaxed font-medium min-h-[80px]">
                    {user.about || <span className="text-slate-300">자기소개가 아직 작성되지 않았습니다.</span>}
                  </div>
                </div>

                {/* 섹션 4: 계정 정보 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                    <Mail size={16} className="text-[#FF7E7E] flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">이메일</span>
                      <span className="text-[0.8rem] text-slate-800 font-semibold truncate">{user.email || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                    <Calendar size={16} className="text-[#FF7E7E] flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">가입일</span>
                      <span className="text-[0.8rem] text-slate-800 font-semibold">
                        {user.createdAt?.seconds
                          ? format(new Date(user.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 섹션 5: 활동 지표 */}
                <div className="space-y-2">
                  <SectionLabel>활동 지표</SectionLabel>
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col items-center py-4 rounded-2xl bg-sky-50 border border-sky-200">
                      <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest mb-1">총 참여</span>
                      <span className="text-2xl font-black text-sky-700">{user.participationCount || 0}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center py-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">매칭 성공</span>
                      <span className="text-2xl font-black text-emerald-700">{user.matchCount || 0}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center py-4 rounded-2xl bg-rose-50 border border-rose-200">
                      <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">노쇼/지각</span>
                      <span className="text-2xl font-black text-rose-700">{user.noShowCount || 0}</span>
                    </div>
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
