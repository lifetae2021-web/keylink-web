'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { subscribeSession } from '@/lib/firestore/sessions';
import { getMyVote, submitVote } from '@/lib/firestore/votes';
import { getMyLatestApplication } from '@/lib/firestore/applications';
import { Session, Application, VoteChoice } from '@/lib/types';
import { Heart, Lock, CheckCircle2, ArrowLeft, Star } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Candidate {
  userId: string;
  name: string;
  age: number;
  job: string;
  residence: string;
  gender: 'male' | 'female';
}

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [choices, setChoices] = useState<Record<number, string>>({}); // priority → userId
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.uid);

      // 신청서 확인
      const app = await getMyLatestApplication(user.uid);
      if (!app || app.sessionId !== sessionId || app.status !== 'confirmed') {
        toast.error('참가 확정된 사용자만 투표할 수 있습니다.');
        router.push('/mypage');
        return;
      }
      setMyApplication(app);

      // 이미 투표했는지 확인
      const existingVote = await getMyVote(sessionId, user.uid);
      if (existingVote) { setHasVoted(true); }

      // 같은 기수 이성 참여자 목록 조회
      const oppositeGender = app.gender === 'male' ? 'female' : 'male';
      const q = query(
        collection(db, 'applications'),
        where('sessionId', '==', sessionId),
        where('status', '==', 'confirmed'),
        where('gender', '==', oppositeGender)
      );
      const snap = await getDocs(q);
      const candidateList: Candidate[] = [];
      for (const d of snap.docs) {
        const appData = d.data();
        // users 컬렉션에서 프로필 추가 정보 가져오기
        candidateList.push({
          userId: appData.userId,
          name: appData.name,
          age: appData.age,
          job: appData.job,
          residence: appData.residence,
          gender: appData.gender,
        });
      }
      setCandidates(candidateList);
      setLoading(false);
    });

    // 세션 실시간 구독
    const unsubSession = subscribeSession(sessionId, setSession);
    return () => { unsub(); unsubSession(); };
  }, [sessionId]);

  const handleChoiceSelect = (priority: 1 | 2 | 3, targetUserId: string) => {
    setChoices(prev => {
      const next = { ...prev };
      // 이미 다른 순위에 같은 사람이 선택되어 있으면 제거
      Object.keys(next).forEach(p => {
        if (next[Number(p)] === targetUserId && Number(p) !== priority) {
          delete next[Number(p)];
        }
      });
      next[priority] = targetUserId;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(choices).length < 1) {
      toast.error('최소 1명 이상 선택해 주세요.');
      return;
    }
    if (!userId) return;
    if (!confirm('투표를 제출하시겠습니까? 한 번 제출하면 수정할 수 없습니다.')) return;

    setSubmitting(true);
    try {
      const voteChoices: VoteChoice[] = Object.entries(choices).map(([p, uid]) => ({
        priority: Number(p) as 1 | 2 | 3,
        targetUserId: uid,
      }));
      await submitVote(sessionId, userId, voteChoices);
      setHasVoted(true);
      toast.success('🎉 투표가 완료되었습니다!');
    } catch (e: any) {
      toast.error(e.message || '투표 제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FFFAF9] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // 세션이 투표 활성화 상태가 아닌 경우
  if (session?.status !== 'voting') {
    return (
      <div className="min-h-screen bg-[#FFFAF9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-[28px] bg-gray-100 flex items-center justify-center mb-6">
          <Lock size={36} className="text-gray-300" />
        </div>
        <h1 className="text-2xl font-black text-gray-800 mb-3">투표가 아직 열리지 않았습니다</h1>
        <p className="text-gray-400 font-medium mb-8">
          행사 당일 운영진이 투표를 활성화하면 이 페이지에서 투표하실 수 있습니다.<br />
          현재 세션 상태: <strong className="text-gray-600">{session?.status || '불명'}</strong>
        </p>
        <Link href="/mypage" className="px-6 py-3 rounded-2xl bg-pink-500 text-white font-bold">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  // 이미 투표한 경우
  if (hasVoted) {
    return (
      <div className="min-h-screen bg-[#FFFAF9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-[28px] bg-green-50 flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-gray-800 mb-3">투표 완료!</h1>
        <p className="text-gray-400 font-medium mb-8">
          투표가 성공적으로 제출되었습니다.<br />매칭 결과는 행사 후 마이페이지에서 확인하실 수 있습니다.
        </p>
        <Link href="/mypage" className="px-6 py-3 rounded-2xl bg-pink-500 text-white font-bold">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFAF9]" style={{ paddingTop: '100px', paddingBottom: '120px' }}>
      <div className="max-w-lg mx-auto px-4">

        {/* 헤더 */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-pink-50 mb-6">
            <Heart size={32} className="text-pink-500" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">오늘의 인연 선택</h1>
          <p className="text-gray-400 font-medium text-sm leading-relaxed">
            마음에 드는 분을 1~3순위로 선택해 주세요.<br />
            상대방도 나를 선택하면 매칭이 성사됩니다! 🌸
          </p>
        </header>

        {/* 선택 현황 */}
        <div className="flex gap-3 mb-8 justify-center">
          {([1, 2, 3] as const).map(p => (
            <div
              key={p}
              className={`flex-1 py-3 rounded-2xl text-center text-sm font-black transition-all ${
                choices[p]
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-200'
                  : 'bg-white border-2 border-dashed border-gray-200 text-gray-300'
              }`}
            >
              <Star size={14} className="inline mr-1" fill={choices[p] ? 'white' : 'none'} />
              {p}순위
              {choices[p] && (
                <div className="text-xs mt-0.5 opacity-80">
                  {candidates.find(c => c.userId === choices[p])?.name || ''}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 후보자 목록 */}
        <div className="space-y-3 mb-10">
          {candidates.length === 0 ? (
            <div className="text-center py-12 text-gray-300 font-semibold">
              이성 참여자 정보를 불러오는 중...
            </div>
          ) : candidates.map((candidate, index) => {
            const selectedPriority = Object.entries(choices).find(([, uid]) => uid === candidate.userId)?.[0];
            const isSelected = !!selectedPriority;

            return (
              <div
                key={candidate.userId}
                className={`rounded-2xl p-5 border-2 transition-all ${
                  isSelected
                    ? 'border-pink-300 bg-pink-50/50 shadow-md shadow-pink-100'
                    : 'border-gray-100 bg-white hover:border-pink-100'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-black text-gray-800 text-base">
                      No.{index + 1}
                    </span>
                    {isSelected && (
                      <span className="ml-2 px-2.5 py-0.5 rounded-full bg-pink-500 text-white text-xs font-black">
                        {selectedPriority}순위 ✓
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    ['나이', `${candidate.age}세`],
                    ['직업', candidate.job],
                    ['거주지', candidate.residence],
                  ].map(([label, value]) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</p>
                      <p className="text-sm font-bold text-gray-700">{value || '-'}</p>
                    </div>
                  ))}
                </div>

                {/* 순위 선택 버튼 */}
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(p => {
                    const isThisRankSelected = choices[p] === candidate.userId;
                    const isRankTaken = !!choices[p] && choices[p] !== candidate.userId;
                    return (
                      <button
                        key={p}
                        onClick={() => handleChoiceSelect(p, candidate.userId)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                          isThisRankSelected
                            ? 'bg-pink-500 text-white shadow-sm'
                            : isRankTaken
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-500 hover:bg-pink-50 hover:text-pink-500'
                        }`}
                        disabled={isRankTaken && !isThisRankSelected}
                      >
                        {p}순위
                        {isThisRankSelected && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 제출 버튼 (Fixed) */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-100">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(choices).length === 0}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: Object.keys(choices).length > 0
                  ? 'linear-gradient(135deg, #FF6F61, #FF9A9E)'
                  : '#F3F4F6',
                color: Object.keys(choices).length > 0 ? '#fff' : '#9CA3AF',
                boxShadow: Object.keys(choices).length > 0 ? '0 8px 24px rgba(255,111,97,0.35)' : 'none',
              }}
            >
              {submitting ? '제출 중...' : `${Object.keys(choices).length}명 선택 완료 — 투표 제출`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
