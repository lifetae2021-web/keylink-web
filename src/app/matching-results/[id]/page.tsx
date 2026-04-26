'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Heart, ArrowLeft, Trophy, Sparkles, ShieldCheck, Star, Users, MapPin, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CherryBlossoms from '@/components/CherryBlossoms';

import { getUserMatchResult, getUserVoteStats } from '@/lib/firestore/userMatching';

interface ResultData {
  isMatched: boolean;
  partner?: {
    gender: 'male' | 'female';
    number: string;
    age: string;
    job: string;
    height: string;
    residence: string;
    batch: string;
  };
}

export default function MatchingResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [result, setResult] = useState<ResultData | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [myChoices, setMyChoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // 1. Fetch User Name
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (userSnap.exists()) {
            setUserName(userSnap.data().name || '영훈');
          }

          // 2. Fetch Matching Result
          const matchResult = await getUserMatchResult(currentUser.uid, sessionId);
          if (matchResult) {
            setResult({
              isMatched: matchResult.matched,
              partner: matchResult.matched && matchResult.partnerProfile ? {
                gender: matchResult.partnerProfile.gender as any,
                number: matchResult.partnerProfile.number || '?',
                age: matchResult.partnerProfile.age || '미입력',
                job: matchResult.partnerProfile.job || '미입력',
                height: matchResult.partnerProfile.height || '미입력',
                residence: matchResult.partnerProfile.residence || '미입력',
                batch: matchResult.partnerProfile.batch || '알 수 없음'
              } : undefined
            });
          } else {
            setResult(null);
          }

          // 3. Fetch Stats & Choices
          const stats = await getUserVoteStats(currentUser.uid, sessionId);
          setVoteCount(stats.receivedCount);
          setMyChoices(stats.myChoices.map(v => ({
            priority: v.priority,
            partnerName: v.targetUserName || '알 수 없음',
            job: '확인 중' 
          })));

        } catch (error) {
          console.error("Error fetching detail data:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    );
  }

  if (!user || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">로그인이 필요하거나 결과가 없습니다.</h1>
        <Link href="/matching-results" className="text-pink-500 font-bold border-b border-pink-500 pb-1 flex items-center gap-2">
          <ArrowLeft size={18} /> 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] pt-24 pb-20 px-6 relative overflow-hidden">
      <CherryBlossoms />
      <div className="max-w-3xl mx-auto relative z-10">
        
        {/* Back Link */}
        <div className="mb-10">
          <Link href="/matching-results" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 rounded-full text-sm font-bold text-gray-500 shadow-sm hover:shadow-md transition-all">
            <ArrowLeft size={18} /> 전체 목록
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* 1. Main Outcome Section */}
          {result.isMatched ? (
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-rose-400 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl rotate-[-4deg]">
                <Heart size={48} fill="white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">
                축하합니다!<br/>소중한 <span className="text-pink-500">인연</span>이 닿았습니다.
              </h2>
              <p className="text-gray-500 font-semibold mb-10">상대방도 {userName}님을 선택하셨습니다.</p>

              {/* Partner Card */}
              {result.partner && (
                <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-2xl shadow-pink-100/50 mb-12 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <Sparkles className="text-pink-200" size={32} />
                  </div>
                  
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8 p-3 bg-gray-50 rounded-2xl text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider">
                     <span>기수</span>
                     <span>{result.partner.gender === 'male' ? '카랑남' : '키링녀'}</span>
                     <span>나이</span>
                     <span>직업</span>
                     <span>키</span>
                     <span>거주지</span>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 items-center text-center">
                    <div className="font-bold text-gray-500">{result.partner.batch}</div>
                    <div className="font-black text-pink-500 text-base md:text-lg whitespace-nowrap">
                      {result.partner.gender === 'male' ? '카랑남' : '키링녀'} {result.partner.number}호
                    </div>
                    <div className="font-bold text-gray-800">{result.partner.age}</div>
                    <div className="font-black text-blue-500">{result.partner.job}</div>
                    <div className="font-bold text-gray-500">{result.partner.height}</div>
                    <div className="font-bold text-gray-800">{result.partner.residence}</div>
                  </div>

                  <div className="mt-10 p-5 bg-pink-50/50 rounded-3xl border border-pink-100 italic font-bold text-pink-500 text-sm">
                    "상대방의 구체적인 연락처와 성함은 운영진을 통해 안전하게 전달될 예정입니다."
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-6 shadow-sm">
                <Heart size={40} />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-4 leading-tight px-4">
                아쉽지만 이번 기수에는<br/>인연이 닿지 않았습니다.
              </h2>
              <p className="text-gray-500 font-semibold px-4">
                {userName}님의 진면목을 알아볼 새로운 인연이<br/>다음 기수에서 기다리고 있습니다! 🌸
              </p>
            </div>
          )}

          {/* 2. Popularity Index Section */}
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 text-gray-50">
              <Star size={80} fill="currentColor" />
            </div>
            
            <h4 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <Trophy size={20} className="text-amber-400" /> 이번 기수 내가 받은 호감
            </h4>

            <div className="flex items-center gap-6 mb-6">
              <div className="text-6xl font-black text-pink-500 tracking-tighter">
                {voteCount}<span className="text-2xl ml-1 text-pink-300">표</span>
              </div>
              <div className="flex-1 text-gray-500 font-bold leading-relaxed text-sm">
                "이번 기수에서 {userName}님은 총 {voteCount}표를 받으셨습니다. 숫자는 단지 통계일 뿐, {userName}님의 매력은 다음 기수에서 더 빛날 거예요! 조금만 더 용기를 내어보세요. ✨"
              </div>
            </div>
          </div>

          {/* 3. My Choices Section */}
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-12">
            <h4 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
               <Heart size={20} className="text-pink-500" /> 내가 선택한 호감 상대
            </h4>
            
            <div className="grid gap-3">
              {myChoices.map((choice) => (
                <div key={choice.targetUserId || choice.priority} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-pink-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-xs ${choice.priority === 1 ? 'bg-pink-500' : 'bg-gray-300'}`}>
                      {choice.priority}
                    </span>
                    <span className="font-black text-gray-900">{choice.partnerName}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-500">{choice.job}</span>
                </div>
              ))}
              {myChoices.length === 0 && (
                <div className="text-center py-6 text-gray-400 font-bold p-4 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  선택하신 상대가 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center gap-4 p-6 bg-pink-50 rounded-3xl border border-pink-100">
            <ShieldCheck size={24} className="text-pink-500 shrink-0" />
            <p className="text-xs md:text-sm font-bold text-pink-600 leading-relaxed">
              키링크의 매칭 시스템은 신원 검증이 완료된 참가자들의 투명한 투표를 기반으로 이루어집니다. 본 데이터는 본인에게만 안전하게 공개됩니다.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
