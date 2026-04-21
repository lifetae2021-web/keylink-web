'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Trophy, Clock, CheckCircle2, ArrowRight, Sparkles, Star, ShieldCheck, Mail, Info, Frown, Timer } from 'lucide-react';
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
    date: '2026.04.26',
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
    date: '2026.04.19',
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
    date: '2026.04.12',
    title: '부산 로테이션 소개팅',
    status: 'pending',
    voteCount: 0,
    myChoices: []
  },
  {
    id: 'gisu-117',
    episode: 117,
    date: '2026.04.05',
    title: '부산 로테이션 소개팅',
    status: 'confirmed',
    voteCount: 0,
    myChoices: []
  },
  {
    id: 'gisu-116',
    episode: 116,
    date: '2026.03.29',
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
    date: '2026.03.22',
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] pt-32 pb-24 px-6 md:px-12 relative overflow-hidden">
      <CherryBlossoms />
      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Title Section */}
        <header className="mb-20 text-center">
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="inline-flex items-center gap-2 px-5 py-2 bg-white text-gray-400 rounded-full text-xs font-bold shadow-sm mb-6"
           >
            Apple-Style Premium Dashboard
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight"
          >
            내 매칭 리포트
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg font-medium max-w-xl mx-auto"
          >
            시간을 넘어 이어지는 당신의 소중한 인연과<br/>참여 히스토리를 한곳에서 만나보세요.
          </motion.p>
        </header>

        {/* Dynamic Layout Components with space-y-16 */}
        <div className="space-y-20">
          
          {/* Section 1: History Cards */}
          <section>
            <div className="flex items-center justify-between mb-8 px-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                참여 히스토리
              </h2>
              <span className="text-xs font-medium text-gray-400">옆으로 스크롤하여 더보기</span>
            </div>
            
            <div className="flex overflow-x-auto pb-8 gap-5 no-scrollbar scroll-smooth px-4 -mx-4">
              {MOCK_HISTORY.map((session) => (
                <HistoryCard 
                  key={session.id} 
                  session={session} 
                  isSelected={selectedGisuId === session.id}
                  onClick={() => setSelectedGisuId(session.id)}
                />
              ))}
            </div>
          </section>

          {/* Section 2: Detail View Area */}
          <section className="bg-white rounded-[48px] p-12 md:p-20 shadow-sm border border-white relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedGisuId}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.5, ease: "circOut" }}
              >
                <DetailView session={selectedSession} />
              </motion.div>
            </AnimatePresence>
          </section>

          {/* Section 3: Popularity & Choices Dashboard */}
          <section className="grid md:grid-cols-2 gap-8">
            <VoteMetricCard count={selectedSession.voteCount} />
            <MyChoicesCard choices={selectedSession.myChoices} />
          </section>

        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function HistoryCard({ session, isSelected, onClick }: { session: GisuSession, isSelected: boolean, onClick: () => void }) {
  const getStatusBadge = (status: GisuStatus) => {
    const styles = {
      matched: "bg-green-50 text-green-500",
      unmatched: "bg-gray-100 text-gray-400",
      pending: "bg-amber-50 text-amber-500",
      confirmed: "bg-blue-50 text-blue-500"
    };
    const labels = {
      matched: "매칭성공",
      unmatched: "미매칭",
      pending: "집계중",
      confirmed: "참가확정"
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex-shrink-0 w-44 p-6 rounded-[32px] transition-all relative ${
        isSelected 
        ? "bg-white shadow-xl shadow-gray-200/50 border-2 border-pink-100" 
        : "bg-white/50 border border-transparent opacity-60 hover:opacity-100"
      }`}
    >
      <div className="absolute top-4 right-4">
        {getStatusBadge(session.status)}
      </div>
      <div className="mt-8 text-left">
        <p className={`text-base font-black mb-1 ${isSelected ? "text-pink-500" : "text-gray-400"}`}>
          {session.episode}기
        </p>
        <p className="text-xs text-gray-400 font-bold tracking-tight">
          {session.date}
        </p>
      </div>
    </motion.button>
  );
}

function DetailView({ session }: { session: GisuSession }) {
  if (session.status === 'confirmed') return <ConfirmedView />;
  if (session.status === 'pending') return <PendingView />;
  if (session.status === 'matched') return <MatchedView partner={session.partner!} />;
  return <UnmatchedView />;
}

function MatchedView({ partner }: { partner: GisuSession['partner'] & {} }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-pink-50 text-pink-500 rounded-[28px] mb-10">
        <Heart size={40} fill="currentColor" />
      </div>
      <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-8 leading-tight">
        축하합니다!<br/>소중한 <span className="text-pink-500">인연</span>이 닿았습니다.
      </h2>
      
      <div className="mt-16 bg-pink-50/30 rounded-[40px] p-10 md:p-14 border border-pink-100 overflow-hidden relative">
        <div className="absolute top-10 right-10 opacity-20"><Sparkles size={100} className="text-pink-300" /></div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-y-10 gap-x-6 text-left relative z-10">
          <InfoItem label="기수" value={partner.batch} />
          <InfoItem label="매칭상대" value={`${partner.gender === 'male' ? '카랑남' : '키링녀'} ${partner.number}호`} isHighlight />
          <InfoItem label="나이" value={partner.age} />
          <InfoItem label="직업" value={partner.job} isBlue />
          <InfoItem label="키" value={partner.height} />
          <InfoItem label="거주지" value={partner.residence} />
        </div>
        <div className="mt-16 pt-8 border-t border-pink-100/50 text-center font-bold text-pink-400 text-sm">
          "운영진을 통해 상세 연락처가 전달될 예정입니다."
        </div>
      </div>
    </div>
  );
}

function UnmatchedView() {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 text-gray-300 rounded-[28px] mb-10">
        <Frown size={40} />
      </div>
      <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-8 leading-tight">
        아쉽지만 이번 기수에는<br/>인연이 닿지 않았습니다.
      </h2>
      <p className="text-gray-400 text-lg font-medium max-w-lg mx-auto leading-relaxed">
        회원님의 진면목을 알아볼 새로운 인연이<br/>다음 기수에서 기다리고 있습니다! 🌸
      </p>
    </div>
  );
}

function PendingView() {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 text-amber-500 rounded-[28px] mb-10 animate-pulse">
        <Timer size={40} />
      </div>
      <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-8 leading-tight">
        현재 매칭 결과를<br/>집계 중입니다 ✨
      </h2>
      <div className="max-w-md mx-auto mt-16 px-6">
        <div className="flex justify-between mb-4">
          <span className="text-sm font-black text-gray-400">실시간 분석 지수</span>
          <span className="text-sm font-black text-amber-500">85%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="w-[85%] h-full bg-amber-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ConfirmedView() {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 text-blue-500 rounded-[28px] mb-10">
        <CheckCircle2 size={40} />
      </div>
      <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-8 leading-tight">참가 확정</h2>
      <p className="text-gray-400 text-lg font-medium mb-12">신청 및 결제가 완료되었습니다.<br/>최고의 매칭을 위해 준비 중입니다!</p>
      <div className="inline-flex items-start gap-4 p-6 bg-blue-50/50 rounded-3xl border border-blue-50 text-left max-w-lg">
        <Info className="text-blue-400 mt-1 shrink-0" size={20} />
        <p className="text-sm text-gray-500 font-medium leading-relaxed">매칭 순위를 행사 종료 후 30분 이내에 입력해 주시면 더욱 정확한 매칭이 가능합니다.</p>
      </div>
    </div>
  );
}

function VoteMetricCard({ count }: { count: number }) {
  return (
    <div className="bg-white p-12 rounded-[48px] shadow-sm flex flex-col justify-between relative overflow-hidden group border border-white">
      <div className="absolute top-10 right-10 text-gray-50 group-hover:text-pink-50/50 transition-colors">
        <Star size={100} fill="currentColor" />
      </div>
      <div className="relative z-10">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-10 flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" /> Received Votes
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-8xl font-black text-pink-500 tracking-tighter">{count}</span>
          <span className="text-2xl font-black text-pink-200">표</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 font-bold mt-12 relative z-10">"통계는 단지 숫자일 뿐입니다. 당신 자체로 완벽합니다."</p>
    </div>
  );
}

function MyChoicesCard({ choices }: { choices: GisuSession['myChoices'] }) {
  return (
    <div className="bg-white p-12 rounded-[48px] shadow-sm border border-white">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-10 flex items-center gap-2">
        <Heart size={16} className="text-pink-500" /> Your Choices
      </h3>
      {choices.length > 0 ? (
        <div className="space-y-4">
          {choices.map((c) => (
            <div key={c.priority} className="flex items-center justify-between p-5 bg-gray-50/50 rounded-2xl border border-transparent hover:border-pink-100 transition-all">
              <div className="flex items-center gap-4">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs ${c.priority === 1 ? 'bg-pink-500' : 'bg-gray-200'}`}>
                  {c.priority}
                </span>
                <span className="font-bold text-gray-700">{c.partnerName}</span>
              </div>
              <span className="text-xs font-black text-blue-400">{c.job}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-40 flex flex-col items-center justify-center text-gray-300 gap-4">
          <Mail size={32} />
          <p className="text-xs font-bold">참여 데이터가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, isHighlight, isBlue }: { label: string, value: string, isHighlight?: boolean, isBlue?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-lg font-black tracking-tight ${isHighlight ? "text-pink-500" : isBlue ? "text-blue-500" : "text-gray-800"}`}>
        {value}
      </p>
    </div>
  );
}
