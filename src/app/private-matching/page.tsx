'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, HeartHandshake, UserSearch, ArrowRight, Sparkles, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivateMatchingLandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-5 text-center">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6 text-purple-600">
          <Lock size={40} />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-3">로그인이 필요합니다</h1>
        <p className="text-slate-500 mb-8 max-w-xs break-keep">
          1:1 프라이빗 매칭 서비스는 회원 전용 서비스입니다. 로그인 후 맞춤 혜택을 확인해보세요.
        </p>
        <Link 
          href="/login"
          className="w-full max-w-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  const isMale = userData?.gender === 'male';
  const isFemale = userData?.gender === 'female';

  return (
    <div className="min-h-screen bg-slate-50 pt-[80px] pb-24">
      {/* Hero Section */}
      <section className="px-5 py-12 relative overflow-hidden bg-white border-b border-slate-200">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-300 blur-3xl"></div>
          <div className="absolute top-40 -left-20 w-72 h-72 rounded-full bg-pink-300 blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-md mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold mb-6">
              <Sparkles size={14} /> 프리미엄 서비스 오픈
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-4 leading-tight tracking-tight">
              원하는 이상형만<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">콕 집어서 만나는 1:1 매칭</span>
            </h1>
            <p className="text-slate-500 text-[0.95rem] mb-8 font-medium break-keep leading-relaxed">
              가입비 0원, 오직 매칭 성공 시에만 결제하는<br />가장 합리적이고 안전한 프라이빗 소개팅
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-md mx-auto px-5 mt-[-20px] relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100"
        >
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 text-center">
            <p className="text-rose-600 font-black text-sm">🎉 한시적 오픈 이벤트 🎉</p>
            <p className="text-slate-700 text-xs mt-1 font-bold">지금 신청하면 매칭 수수료 무료!</p>
          </div>

          <h2 className="text-lg font-black text-slate-800 mb-5">키링크 1:1 매칭의 특별함</h2>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <HeartHandshake className="text-blue-500" size={24} />
              </div>
              <div>
                <h3 className="text-[0.95rem] font-bold text-slate-800 mb-1">합리적인 비용 시스템</h3>
                <p className="text-[0.8rem] text-slate-500 font-medium break-keep leading-relaxed">
                  수백만 원의 가입비 없이, 프로필을 받고 매칭이 성사되었을 때만 1회성 결제가 진행됩니다.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-purple-500" size={24} />
              </div>
              <div>
                <h3 className="text-[0.95rem] font-bold text-slate-800 mb-1">여성 프라이버시 100% 보호</h3>
                <p className="text-[0.8rem] text-slate-500 font-medium break-keep leading-relaxed">
                  여성분의 프로필은 불특정 다수에게 공개되지 않으며, 본인이 수락한 남성에게만 제한적으로 전달됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <UserSearch className="text-emerald-500" size={24} />
              </div>
              <div>
                <h3 className="text-[0.95rem] font-bold text-slate-800 mb-1">데이터 기반 1:1 밀착 매칭</h3>
                <p className="text-[0.8rem] text-slate-500 font-medium break-keep leading-relaxed">
                  입력해주신 3가지 핵심 이상형 조건을 바탕으로, 전문 매니저가 데이터를 분석하여 최적의 상대를 제안합니다.
                </p>
              </div>
            </div>
          </div>

          <hr className="my-6 border-slate-100" />

          <div className="bg-slate-50 rounded-2xl p-8 mb-8 text-center relative overflow-hidden border-2 border-rose-100 shadow-inner">
            <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl shadow-sm tracking-tighter">
              OPEN EVENT
            </div>
            <h3 className="text-[0.9rem] font-bold text-slate-500 mb-5">매칭 성공 시 1회 진행비</h3>
            
            {isMale && (
              <div className="flex flex-col items-center">
                <p className="text-[0.7rem] font-black text-blue-500 mb-2 px-3 py-1 bg-blue-50 rounded-full">남성 회원 혜택</p>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 text-sm line-through decoration-slate-300 font-bold mb-1">정가 39,000원</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-rose-600 tracking-tighter">0</span>
                    <span className="text-xl font-black text-rose-600">원</span>
                  </div>
                </div>
                <p className="mt-3 text-[0.75rem] font-bold text-rose-500 animate-bounce">지금 신청하면 무료 매칭 가능!</p>
              </div>
            )}
            
            {isFemale && (
              <div className="flex flex-col items-center">
                <p className="text-[0.7rem] font-black text-rose-500 mb-2 px-3 py-1 bg-rose-50 rounded-full">여성 회원 혜택</p>
                <div className="flex flex-col items-center">
                  <span className="text-slate-400 text-sm line-through decoration-slate-300 font-bold mb-1">정가 10,000원</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-rose-600 tracking-tighter">0</span>
                    <span className="text-xl font-black text-rose-600">원</span>
                  </div>
                </div>
                <p className="mt-3 text-[0.75rem] font-bold text-rose-500 animate-bounce">지금 신청하면 무료 매칭 가능!</p>
              </div>
            )}
            
            {!isMale && !isFemale && (
              <div className="py-4">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-500 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-slate-400 text-xs font-bold">회원님을 위한 혜택 확인 중...</p>
              </div>
            )}
          </div>

          <Link 
            href="/private-matching/apply"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-purple-200 transition-all transform hover:scale-[1.02]"
          >
            1:1 매칭 무료로 신청하기 <ArrowRight size={20} />
          </Link>
          <p className="text-center text-xs text-slate-400 mt-4 font-medium">기존 신청 내역이 있다면 자동으로 정보가 연동됩니다.</p>
        </motion.div>
      </div>
    </div>
  );
}
