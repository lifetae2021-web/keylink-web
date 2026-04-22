'use client';

import { X, User, MapPin, Briefcase, Heart, Ruler, Cigarette, Wine, Info, ShieldCheck, Mail, Calendar } from 'lucide-react';
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white border border-slate-200 rounded-[2rem] shadow-2xl flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 z-10 p-2.5 rounded-full bg-white/80 text-slate-400 hover:text-slate-900 transition-all border border-slate-100 shadow-sm backdrop-blur-sm"
            >
              <X size={20} />
            </button>

            <div className="overflow-y-auto custom-scrollbar">
              {/* Header / Cover Image */}
              <div className="relative h-72 bg-slate-50 border-b border-slate-100 overflow-hidden">
                {(user.photoUrl || user.photoURL) ? (
                  <img
                    src={user.photoUrl || user.photoURL}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <User size={140} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
                <div className="absolute bottom-8 left-10 flex items-end gap-5">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-4xl font-black text-slate-900 tracking-tight">{user.name || '미입력'}</h3>
                      {user.status === 'verified' && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 text-[11px] font-bold shadow-sm">
                          <ShieldCheck size={14} /> 신원 인증 완료
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                      <span className={user.gender === 'male' ? 'text-blue-500' : 'text-rose-500'}>
                        {user.gender === 'male' ? '남성' : '여성'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>{age}세</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-slate-700">{user.job || user.occupation || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-10">
                {/* Identity Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 text-slate-400 group">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF7E7E] transition-colors">
                        <MapPin size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">Residence</span>
                        <span className="text-[0.95rem] text-slate-700 font-bold">{user.location || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 group">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF7E7E] transition-colors">
                        <Heart size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">MBTI Type</span>
                        <span className="text-[0.95rem] text-slate-700 font-bold uppercase">{user.mbti || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 group">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF7E7E] transition-colors">
                        <Ruler size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">Height</span>
                        <span className="text-[0.95rem] text-slate-700 font-bold">{user.height ? `${user.height}cm` : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4 text-slate-400 group">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF7E7E] transition-colors">
                        <Info size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">Religion</span>
                        <span className="text-[0.95rem] text-slate-700 font-bold">{user.religion || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 group">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF7E7E] transition-colors">
                        <Cigarette size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">Smoking</span>
                        <span className="text-[0.95rem] text-slate-700 font-bold">{user.smoking || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 group">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#FF7E7E] transition-colors">
                        <Wine size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-300">Drinking</span>
                        <span className="text-[0.95rem] text-slate-700 font-bold">{user.drinking || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-[#FF7E7E]">Self Introduction</h4>
                  <div className="p-7 rounded-3xl bg-slate-50 border border-slate-100 text-slate-600 leading-relaxed text-[0.92rem] font-medium shadow-inner">
                    {user.about || "자기소개 문구가 아직 작성되지 않았습니다."}
                  </div>
                </div>

                {/* Contact Detail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-slate-50/50 text-slate-400">
                    <Mail size={18} />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-300">Email Address</span>
                      <span className="text-[0.82rem] text-slate-600 font-bold">{user.email || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-slate-50/50 text-slate-400">
                    <Calendar size={18} />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-300">Joined Date</span>
                      <span className="text-[0.82rem] text-slate-600 font-bold">
                        {user.createdAt?.seconds ? format(new Date(user.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metrics Summary */}
                <div className="flex items-center gap-3 pt-6">
                  <div className="flex-1 flex flex-col items-center p-4 rounded-2xl bg-sky-50 border border-sky-100 shadow-sm">
                    <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest mb-1">Participation</span>
                    <span className="text-2xl font-black text-sky-700">{user.participationCount || 0}</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Matching</span>
                    <span className="text-2xl font-black text-emerald-700">{user.matchCount || 0}</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center p-4 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">No-Show</span>
                    <span className="text-2xl font-black text-rose-700">{user.noShowCount || 0}</span>
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
