'use client';

import { X, User, MapPin, Briefcase, Heart, Height, Cigarette, Wine, Info, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface UserProfileModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ user, isOpen, onClose }: UserProfileModalProps) {
  if (!user) return null;

  const age = user.birthDate ? new Date().getFullYear() - parseInt(user.birthDate.split('-')[0]) + 1 : '-';

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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-[#0A0A0B] border border-white/10 rounded-2xl shadow-2xl flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white transition-colors border border-white/5"
            >
              <X size={20} />
            </button>

            <div className="overflow-y-auto custom-scrollbar">
              {/* Header / Cover Image */}
              <div className="relative h-64 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-white/10 overflow-hidden">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10">
                    <User size={120} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] to-transparent" />
                <div className="absolute bottom-6 left-8 flex items-end gap-5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-3xl font-black text-white">{user.name || '미입력'}</h3>
                      {user.status === 'verified' && (
                        <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[10px] font-bold">
                          <ShieldCheck size={12} /> 인증 완료
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
                      <span>{user.gender === 'male' ? '남성' : '여성'}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{age}세</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{user.job || user.occupation || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Identity Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-white/40">
                      <MapPin size={18} />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold">거주지</span>
                        <span className="text-sm text-white font-medium">{user.location || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                      <Heart size={18} />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold">MBTI</span>
                        <span className="text-sm text-white font-medium uppercase">{user.mbti || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                      <div className="w-[18px] h-[18px] flex items-center justify-center text-[11px] font-bold">Tall</div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold">키</span>
                        <span className="text-sm text-white font-medium">{user.height ? `${user.height}cm` : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-white/40">
                      <Info size={18} />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold">종교</span>
                        <span className="text-sm text-white font-medium">{user.religion || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                      <Cigarette size={18} />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold">흡연 여부</span>
                        <span className="text-sm text-white font-medium">{user.smoking || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                      <Wine size={18} />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold">음주 여부</span>
                        <span className="text-sm text-white font-medium">{user.drinking || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest font-black text-[#FF6F61]">Self Introduction</h4>
                  <div className="p-5 rounded-xl bg-white/5 border border-white/5 italic text-white/80 leading-relaxed text-sm">
                    {user.about || "자기소개 문구가 작성되지 않았습니다."}
                  </div>
                </div>

                {/* Contact Detail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 text-white/40">
                    <Mail size={16} />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold">Email Address</span>
                      <span className="text-xs text-white/80">{user.email || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 text-white/40">
                    <Calendar size={16} />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold">Joined Date</span>
                      <span className="text-xs text-white/80">
                        {user.createdAt?.seconds ? format(new Date(user.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics Summary */}
                <div className="flex items-center gap-2 pt-4">
                  <div className="flex-1 flex flex-col items-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[9px] font-black text-blue-400 uppercase mb-1">Total Participation</span>
                    <span className="text-xl font-black text-white">{user.participationCount || 0}</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[9px] font-black text-emerald-400 uppercase mb-1">Match Success</span>
                    <span className="text-xl font-black text-white">{user.matchCount || 0}</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="text-[9px] font-black text-rose-400 uppercase mb-1">No-Show / Late</span>
                    <span className="text-xl font-black text-white">{user.noShowCount || 0}</span>
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
