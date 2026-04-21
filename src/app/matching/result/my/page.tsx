'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, Trophy, Clock, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Star, ShieldCheck, Mail, User, Info, Frown, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CherryBlossoms from '@/components/CherryBlossoms';

// Types
type GisuStatus = 'matched' | 'unmatched' | 'pending' | 'confirmed';

interface GisuSession {
  id: string;
  episode: number;
  date: string;
  title: string;
  status: GisuStatus;
  voteCount: number;
  partner?: {
    gender: 'male' | 'female';
    number: string;
    age: string;
    job: string;
    height: string;
    residence: string;
    batch: string;
  };
  myChoices: {
    priority: number;
    partnerName: string;
    job: string;
  }[];
}

// Mock Data
const MOCK_HISTORY: GisuSession[] = [
  {
    id: 'gisu-120',
    episode: 120,
    date: '2026-04-26',
    title: '부산 로테이션 소개팅',
    status: 'matched',
    voteCount: 4,
    partner: {
      gender: 'female',
      number: '3',
      age: '95년생',
      job: '공공기관',
      height: '165cm',
      residence: '부산 수영구',
      batch: '120기'
    },
    myChoices: [
      { priority: 1, partnerName: '키링녀 3호', job: '공공기관' },
      { priority: 2, partnerName: '키링녀 1호', job: '개인사업자' },
      { priority: 3, partnerName: '키링녀 5호', job: '마케터' }
    ]
  },
  {
    id: 'gisu-119',
    episode: 119,
    date: '2026-04-19',
    title: '부산 로테이션 소개팅',
    status: 'unmatched',
    voteCount: 2,
    myChoices: [
      { priority: 1, partnerName: '키링녀 7호', job: '금융권' },
      { priority: 2, partnerName: '키링녀 4호', job: '사무직' },
      { priority: 3, partnerName: '키링녀 2호', job: '의료계' }
    ]
  },
  {
    id: 'gisu-118',
    episode: 118,
    date: '2026-04-12',
    title: '부산 로테이션 소개팅',
    status: 'pending',
    voteCount: 0,
    myChoices: []
  },
  {
    id: 'gisu-117',
    episode: 117,
    date: '2026-04-05',
    title: '부산 로테이션 소개팅',
    status: 'confirmed',
    voteCount: 0,
    myChoices: []
  },
  {
    id: 'gisu-116',
    episode: 116,
    date: '2026-03-29',
    title: '부산 로테이션 소개팅',
    status: 'matched',
    voteCount: 5,
    partner: {
      gender: 'female',
      number: '8',
      age: '94년생',
      job: '보건인력',
      height: '159cm',
      residence: '부산 남구',
      batch: '116기'
    },
    myChoices: [
      { priority: 1, partnerName: '키링녀 8호', job: '보건인력' },
      { priority: 2, partnerName: '키링녀 6호', job: '디자이너' },
      { priority: 3, partnerName: '키링녀 4호', job: '사무직' }
    ]
  },
  {
    id: 'gisu-115',
    episode: 115,
    date: '2026-03-22',
    title: '부산 로테이션 소개팅',
    status: 'unmatched',
    voteCount: 1,
    myChoices: [
      { priority: 1, partnerName: '키링녀 2호', job: '공무원' },
      { priority: 2, partnerName: '키링녀 5호', job: '회사원' },
      { priority: 3, partnerName: '키링녀 1호', job: '프리랜서' }
    ]
  }
];

export default function MyMatchingDashboard() {
  const [selectedGisuId, setSelectedGisuId] = useState(MOCK_HISTORY[0].id);
  const selectedSession = MOCK_HISTORY.find(s => s.id === selectedGisuId) || MOCK_HISTORY[0];

  const getStatusBadge = (status: GisuStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full border border-blue-100 uppercase">참가확정</span>;
      case 'pending':
        return <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100 uppercase tracking-tighter">집계중</span>;
      case 'matched':
        return <span className="px-2.5 py-0.5 bg-green-50 text-green-600 text-[10px] font-black rounded-full border border-green-100 uppercase">매칭성공</span>;
      case 'unmatched':
        return <span className="px-2.5 py-0.5 bg-gray-50 text-gray-400 text-[10px] font-black rounded-full border border-gray-100 uppercase">미매칭</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] pt-24 pb-20 px-6 relative overflow-hidden">
      <CherryBlossoms />
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="mb-10 text-center">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-pink-50 text-pink-500 rounded-full text-[11px] font-black tracking-wider border border-pink-100 mb-4 uppercase">
            My Dashboard
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">내 매칭 리포트</h1>
          <p className="text-gray-500 font-semibold leading-relaxed">참여하신 기수별 히스토리와 매칭 결과를 확인하세요.</p>
        </div>

        {/* 1. Participation History Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} /> 참여 히스토리
            </h3>
            <span className="text-[10px] font-black text-pink-300">최근 6개 기수</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {MOCK_HISTORY.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedGisuId(session.id)}
                className={`flex flex-col items-center p-4 rounded-[24px] border transition-all ${
                  selectedGisuId === session.id
                    ? 'bg-white border-pink-500 shadow-xl shadow-pink-100/50 scale-[1.03]'
                    : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-pink-200 opacity-60 hover:opacity-100'
                }`}
              >
                <span className={`text-xs font-black mb-2 ${selectedGisuId === session.id ? 'text-pink-500' : 'text-gray-400'}`}>
                  {session.episode}기
                </span>
                <div className="mb-3">
                  {getStatusBadge(session.status)}
                </div>
                <span className="text-[10px] text-gray-400 font-bold tracking-tight">
                  {session.date.split('-').slice(1).join('.')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Detail Section Area */}
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedGisuId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <DetailView session={selectedSession} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function DetailView({ session }: { session: GisuSession }) {
  if (session.status === 'confirmed') return <ConfirmedView session={session} />;
  if (session.status === 'pending') return <PendingView session={session} />;
  if (session.status === 'matched') return <MatchedView session={session} />;
  return <UnmatchedView session={session} />;
}

function MatchedView({ session }: { session: GisuSession }) {
  return (
    <div>
      {/* Matched Outcome */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-gradient-to-br from-pink-400 to-rose-400 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl rotate-[-4deg]">
          <Heart size={40} fill="white" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 leading-tight">
          축하합니다!<br/>소중한 <span className="text-pink-500">인연</span>이 닿았습니다.
        </h2>
        <p className="text-gray-500 text-sm font-semibold mb-8">상대방도 회원님을 선택하셨습니다.</p>

        {/* Partner Card */}
        {session.partner && (
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-2xl shadow-pink-100/50 mb-8 overflow-hidden relative text-left">
            <div className="absolute top-0 right-0 p-4">
              <Sparkles className="text-pink-200" size={32} />
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8 p-3 bg-gray-50 rounded-2xl text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-tighter text-center">
               <span>기수</span>
               <span>{session.partner.gender === 'male' ? '카랑남' : '키링녀'}</span>
               <span>나이</span>
               <span>직업</span>
               <span>키</span>
               <span>거주지</span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 items-center text-center">
              <div className="font-bold text-gray-500 text-sm">{session.partner.batch}</div>
              <div className="font-black text-pink-500 text-sm md:text-base whitespace-nowrap">
                {session.partner.gender === 'male' ? '카랑남' : '키링녀'} {session.partner.number}호
              </div>
              <div className="font-bold text-gray-800 text-sm">{session.partner.age}</div>
              <div className="font-black text-blue-500 text-sm">{session.partner.job}</div>
              <div className="font-bold text-gray-500 text-sm">{session.partner.height}</div>
              <div className="font-bold text-gray-800 text-sm leading-tight">{session.partner.residence}</div>
            </div>

            <div className="mt-10 p-5 bg-pink-50/50 rounded-3xl border border-pink-100 italic font-bold text-pink-500 text-[11px] text-center">
              "상대방의 구체적인 연락처와 성함은 운영진을 통해 안전하게 전달될 예정입니다."
            </div>
          </div>
        )}
      </div>

      <VoteStats session={session} />
      <MyChoices session={session} />
    </div>
  );
}

function UnmatchedView({ session }: { session: GisuSession }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-6 shadow-sm">
        <Frown size={32} />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">
        아쉽지만 이번 기수에는<br/>인연이 닿지 않았습니다.
      </h2>
      <p className="text-gray-500 text-sm font-semibold mb-10 leading-relaxed px-10">
        회원님의 진면목을 알아볼 새로운 인연이<br/>다음 기수에서 기다리고 있습니다! 🌸
      </p>

      <VoteStats session={session} />
      <MyChoices session={session} />
    </div>
  );
}

function PendingView({ session }: { session: GisuSession }) {
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6 shadow-sm animate-pulse">
        <Timer size={32} />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-4 leading-tight">
        현재 매칭 결과를<br/>집계 중입니다 ✨
      </h2>
      <p className="text-gray-500 text-sm font-semibold mb-10 leading-relaxed px-10">
        성비와 선호도를 바탕으로 최적의 매칭을 조율하고 있습니다.<br/>완료 시 카카오톡으로 개별 안내를 드립니다.
      </p>
      
      <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg text-left">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black text-gray-400">데이터 실시간 분석 현황</span>
          <span className="text-xs font-black text-amber-500">85% 완료</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="w-[85%] h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ConfirmedView({ session }: { session: GisuSession }) {
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6 shadow-sm">
        <CheckCircle2 size={32} />
      </div>
      <h2 className="text-2xl font-black text-gray-900 mb-4">참가 확정</h2>
      <p className="text-gray-500 text-sm font-semibold mb-10 leading-relaxed">
        행사 참여 신청 및 결제가 완료되었습니다.<br/>행사 당일 매칭 시스템이 활성화됩니다!
      </p>
      <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg text-left flex items-start gap-4">
        <Info className="text-blue-400 mt-1" size={20} />
        <div>
           <p className="text-sm font-black text-gray-800 mb-1">매칭 가이드 안내</p>
           <p className="text-xs text-gray-500 leading-relaxed">매칭 순위 1, 2, 3순위를 행사 종료 후 30분 이내에 입력해 주시면 더욱 정확한 결과 도출이 가능합니다.</p>
        </div>
      </div>
    </div>
  );
}

function VoteStats({ session }: { session: GisuSession }) {
  return (
    <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-8 relative overflow-hidden text-left">
      <div className="absolute top-0 right-0 p-6 text-gray-50">
        <Star size={80} fill="currentColor" />
      </div>
      <h4 className="text-base font-black text-gray-900 mb-6 flex items-center gap-2">
        <Trophy size={18} className="text-amber-400" /> 이번 기수 내가 받은 호감
      </h4>
      <div className="flex items-center gap-6">
        <div className="text-5xl font-black text-pink-500 tracking-tighter shrink-0">
          {session.voteCount}<span className="text-xl ml-1 text-pink-300 font-black">표</span>
        </div>
        <div className="text-gray-500 font-bold leading-relaxed text-[11px] md:text-xs">
          "이번 기수에서 회원님은 총 {session.voteCount}표를 받으셨습니다. 숫자는 단지 통계일 뿐, 회원님의 매력은 다음 기수에서 더 빛날 거예요! ✨"
        </div>
      </div>
    </div>
  );
}

function MyChoices({ session }: { session: GisuSession }) {
  if (session.myChoices.length === 0) return null;
  
  return (
    <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-10 text-left">
      <h4 className="text-base font-black text-gray-900 mb-6 flex items-center gap-2">
         <Heart size={18} className="text-pink-500" /> 내가 선택한 호감 상대
      </h4>
      <div className="grid gap-3">
        {session.myChoices.map((choice) => (
          <div key={choice.priority} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-pink-200 transition-all group">
            <div className="flex items-center gap-4">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-[10px] ${choice.priority === 1 ? 'bg-pink-500' : 'bg-gray-300'}`}>
                {choice.priority}
              </span>
              <span className="font-black text-gray-900 text-sm">{choice.partnerName}</span>
            </div>
            <span className="text-[11px] font-bold text-blue-500">{choice.job}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
