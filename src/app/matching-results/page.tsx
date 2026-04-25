'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { format } from 'date-fns';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Heart, Trophy, Clock, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { getUserParticipations } from '@/lib/firestore/userMatching';

interface MatchingRound {
  id: string;
  episode: number;
  date: string;
  title: string;
  status: 'confirmed' | 'pending' | 'published';
  sessionId: string;
}

export default function MatchingResultsListPage() {
  const [user, setUser] = useState<any>(null);
  const [rounds, setRounds] = useState<MatchingRound[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const participations = await getUserParticipations(currentUser.uid);
          const roundsData: MatchingRound[] = participations.map(p => ({
            id: p.application.id,
            sessionId: p.session.id,
            episode: p.session.episodeNumber,
            date: format(p.session.eventDate, 'yyyy-MM-dd'),
            title: `${p.session.region === 'busan' ? '부산' : '창원'} 로테이션 소개팅`,
            status: p.status as any
          }));
          setRounds(roundsData);
        } catch (error) {
          console.error("Error fetching matching rounds:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const getStatusBadge = (status: MatchingRound['status']) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100 flex items-center gap-1"><CheckCircle2 size={12} /> 참가 확정</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full border border-amber-100 flex items-center gap-1"><Clock size={12} /> 매칭 집계 중</span>;
      case 'published':
        return <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-100 flex items-center gap-1"><Trophy size={12} /> 결과 확인 가능</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-pink-500" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <Heart className="text-pink-200 mb-4" size={60} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h1>
        <p className="text-gray-500 mb-6 font-medium">매칭 결과 확인을 위해 로그인을 진행해 주세요.</p>
        <Link href="/login" className="px-8 py-3 bg-pink-500 text-white font-bold rounded-2xl shadow-lg shadow-pink-200 hover:bg-pink-600 transition-all">로그인하러 가기</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-pink-50 text-pink-500 rounded-full text-xs font-black tracking-wider border border-pink-100 mb-4 uppercase">
            History
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">내 매칭 결과 히스토리</h1>
          <p className="text-gray-500 font-semibold text-lg leading-relaxed">참여하신 기수별 매칭 결과를 모아두었습니다.</p>
        </div>

        {/* List */}
        <div className="grid gap-4">
          {rounds.map((round) => (
            <motion.div
              key={round.id}
              whileHover={{ y: -4 }}
              className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-pink-200 transition-all group"
            >
              <Link href={round.status === 'published' ? `/matching-results/${round.sessionId}` : '#'} className={round.status === 'published' ? 'cursor-pointer' : 'cursor-default'}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-pink-50 group-hover:text-pink-500 transition-colors">
                      <Heart size={28} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-black text-pink-500">{round.episode}기</span>
                        {getStatusBadge(round.status)}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">{round.title}</h3>
                      <p className="text-sm text-gray-400 font-medium">{round.date}</p>
                    </div>
                  </div>

                  {round.status === 'published' ? (
                    <div className="flex items-center gap-2 text-pink-500 font-black text-sm group-hover:translate-x-1 transition-transform">
                      자세히 보기 <ArrowRight size={18} />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300 font-bold tracking-tight">집계 완료 시 안내 드립니다</div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Empty State Mock */}
        {rounds.length === 0 && (
          <div className="text-center py-20 bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-100">
            <Heart className="mx-auto text-gray-200 mb-4" size={48} />
            <p className="text-gray-400 font-bold">참여하신 매칭 기수가 없습니다.</p>
            <Link href="/events" className="mt-6 inline-block text-pink-500 font-black text-sm border-b-2 border-pink-500 pb-1">이달의 행사 보러가기</Link>
          </div>
        )}
      </div>
    </div>
  );
}
