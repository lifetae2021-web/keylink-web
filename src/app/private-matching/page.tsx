'use client';
import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HeartHandshake, UserSearch, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivateMatchingLandingPage() {
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
            <p className="text-slate-700 text-xs mt-1 font-bold">지금 신청하면 남녀 모두 매칭 수수료 무료!</p>
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

          <div className="bg-slate-50 rounded-xl p-5 mb-8">
            <h3 className="text-[0.85rem] font-bold text-slate-500 mb-3 text-center">매칭 성공 시 1회 진행비</h3>
            <div className="flex justify-center items-center gap-8">
              <div className="text-center">
                <p className="text-xs font-bold text-blue-500 mb-1">남성</p>
                <p className="text-xl font-black text-slate-800">39,000<span className="text-sm font-bold text-slate-500 ml-1">원</span></p>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center">
                <p className="text-xs font-bold text-rose-500 mb-1">여성</p>
                <p className="text-xl font-black text-slate-800">10,000<span className="text-sm font-bold text-slate-500 ml-1">원</span></p>
              </div>
            </div>
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
