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
import { Heart, Lock, CheckCircle2, ArrowLeft, Star, User, Home, ShieldCheck, MessageSquare, ClipboardList, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Candidate {
  userId: string;
  name: string;
  age: number;
  job: string;
  residence: string;
  gender: 'male' | 'female';
  photos?: string[]; // v8.1.7
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
  const [reasons, setReasons] = useState<Record<string, string>>({}); // userId → reason (v8.1.1)
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // v8.1.7: 네이버 폼 스타일 신규 상태
  const [realName, setRealName] = useState('');
  const [myAlias, setMyAlias] = useState('');
  const [finalCheck, setFinalCheck] = useState(false);
  const [disclosureMode, setDisclosureMode] = useState<'public' | 'anonymous'>('public'); // v8.1.7
  const [feedback, setFeedback] = useState('');
  const [nextEventOpt, setNextEventOpt] = useState(false); // "다음 인연 기대" 옵션

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
        // users 컬렉션에서 프로필 추가 정보(사진 등) 가져오기
        const userSnap = await getDoc(doc(db, 'users', appData.userId));
        const userData = userSnap.data();
        
        candidateList.push({
          userId: appData.userId,
          name: appData.name,
          age: appData.age,
          job: appData.job,
          residence: appData.residence,
          gender: appData.gender,
          photos: userData?.photos || [],
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
    if (!realName.trim()) { toast.error('실명을 적어주세요.'); return; }
    if (!myAlias) { toast.error('모든 필수 항목을 입력해 주세요 (본인 호수 선택)'); return; }
    if (Object.keys(choices).length === 0 && !nextEventOpt) {
      toast.error('모든 필수 항목을 입력해 주세요 (이성 선택)');
      return;
    }
    if (!finalCheck) { toast.error('최종 확인 체크가 필요합니다.'); return; }
    if (!userId) return;

    if (!confirm('투표를 제출하시겠습니까?')) return;

    setSubmitting(true);
    try {
      const voteChoices: VoteChoice[] = Object.entries(choices).map(([p, uid]) => ({
        priority: Number(p) as 1 | 2 | 3,
        targetUserId: uid,
        reason: reasons[uid] || '',
      }));
      
      await submitVote(sessionId, userId, voteChoices, {
        realName,
        myAlias,
        finalCheck,
        disclosureMode, // v8.1.7
        feedback
      });
      
      setHasVoted(true);
      toast.success('🎉 투표가 완료되었습니다!');
    } catch (e: any) {
      toast.error(e.message || '오류 발생');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FFFAF9] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // 투표 활성화 로직: v7.9.9 행사 당일 체크 + v8.1.7 퀵 토글 상태 체크
  const isEventDay = session ? (
    new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) === 
    session.eventDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
  ) : false;
  
  if (session?.status !== 'voting' && !isEventDay) {
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

  // v8.1.7: 동적 설정값 추출 (네이버 폼 커스텀 라벨 포함)
  const maxLimit = session?.voteConfig?.maxSelection || 3;
  const questionText = session?.voteConfig?.questionText || '오늘 가장 호감 갔던 이성을 3명까지 골라주세요.';
  const q1Label = session?.voteConfig?.q1Label || '실명을 적어주세요';
  const q2Label = session?.voteConfig?.q2Label || '본인의 호를 체크해주세요';
  const q3Label = session?.voteConfig?.q3Label || '호감가는 이성 선택';
  const q4Label = session?.voteConfig?.q4Label || '매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?';
  const q5Label = session?.voteConfig?.q5Label || '후기';
  
  const priorityList = Array.from({ length: maxLimit }, (_, i) => i + 1);

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
    <div className="min-h-screen bg-[#F0F2F5] pb-20">
      {/* Naver Form Style Header */}
      <div className="w-full bg-[#FF6F61] h-32 md:h-48 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 transform -rotate-12"><Heart size={80} fill="white" /></div>
          <div className="absolute bottom-5 right-20 transform rotate-12"><Heart size={60} fill="white" /></div>
        </div>
        <div className="text-white text-center z-10 px-4">
          <div className="flex justify-center mb-2"><Heart size={32} fill="white" /></div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight underline decoration-pink-300 underline-offset-8 decoration-4">
            {session?.region === 'busan' ? '부산' : '창원'} 키링크 {session?.episodeNumber}기 만족도 및 호감도 설문
          </h1>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto -mt-6 md:-mt-10 px-4 relative z-20">
        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden mb-8">
          <div className="p-6 md:p-8 space-y-12">
            
            {/* 1. 실명 확인 */}
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-[#FF6F61] font-black text-lg">1.</span>
                <label className="text-lg font-extrabold text-slate-800">{q1Label} <span className="text-[#FF6F61]">*</span></label>
              </div>
              <input 
                type="text" 
                value={realName}
                onChange={e => setRealName(e.target.value)}
                placeholder="본인의 성함을 입력해주세요"
                className="w-full h-14 px-5 rounded-xl border-2 border-slate-100 focus:border-[#FF6F61] focus:ring-0 outline-none font-bold text-slate-700 transition-colors"
              />
            </section>

            {/* 2. 본인 호수 선택 */}
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-[#FF6F61] font-black text-lg">2.</span>
                <label className="text-lg font-extrabold text-slate-800">{q2Label} <span className="text-[#FF6F61]">*</span></label>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                  <button 
                    key={num}
                    onClick={() => setMyAlias(`${myApplication?.gender === 'male' ? '키링남' : '키링녀'} ${num}호`)}
                    className={`h-16 rounded-2xl border-2 font-black text-lg transition-all ${
                      myAlias.includes(`${num}호`)
                        ? 'border-[#FF6F61] bg-[#FFF5F4] text-[#FF6F61]'
                        : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {num}호
                  </button>
                ))}
              </div>
            </section>

            {/* 3. 이성 선택 */}
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-[#FF6F61] font-black text-lg">3.</span>
                <label className="text-lg font-extrabold text-slate-800">
                  {q3Label} <span className="text-[#FF6F61]">*</span>
                </label>
              </div>
              
              <div className="space-y-3">
                {candidates.map((candidate, idx) => {
                  const priority = Object.entries(choices).find(([, uid]) => uid === candidate.userId)?.[0];
                  const label = candidate.gender === 'male' ? '키링남' : '키링녀';
                  
                  return (
                    <div 
                      key={candidate.userId} 
                      onClick={() => {
                        if (priority) {
                          setChoices(prev => {
                            const next = { ...prev };
                            delete next[Number(priority)];
                            return next;
                          });
                        } else if (Object.keys(choices).length < maxLimit) {
                          const nextP = [1,2,3,4,5].find(p => !choices[p]);
                          if (nextP) handleChoiceSelect(nextP as any, candidate.userId);
                        }
                      }}
                      className={`group flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        priority ? 'border-[#FF6F61] bg-[#FFF5F4]' : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                        priority ? 'bg-[#FF6F61] text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {priority ? `${priority}위` : idx + 1}
                      </div>

                      {candidate.photos && candidate.photos[0] && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                          <img src={candidate.photos[0]} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="flex-1 text-left">
                        <p className={`font-black ${priority ? 'text-[#FF6F61]' : 'text-slate-700'}`}>{label} {idx + 1}호</p>
                        <p className="text-[0.7rem] font-bold text-slate-400">{candidate.age}세 · {candidate.job} · {candidate.residence}</p>
                      </div>
                      {priority && <CheckCircle2 size={20} className="text-[#FF6F61]" />}
                    </div>
                  );
                })}

                {/* 다음 인연 기대 옵션 */}
                <div 
                  onClick={() => setNextEventOpt(!nextEventOpt)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    nextEventOpt ? 'border-[#FF6F61] bg-[#FFF5F4]' : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 text-slate-500 shrink-0`}>
                    <Heart size={16} fill={nextEventOpt ? '#FF6F61' : 'none'} className={nextEventOpt ? 'text-[#FF6F61]' : ''} />
                  </div>
                  <p className={`flex-1 text-left font-black ${nextEventOpt ? 'text-[#FF6F61]' : 'text-slate-700'}`}>다음 새로운 인연을 기대할게요❤️</p>
                  {nextEventOpt && <CheckCircle2 size={20} className="text-[#FF6F61]" />}
                </div>
              </div>
            </section>

            {/* 4. 최종 확인 */}
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-[#FF6F61] font-black text-lg">4.</span>
                <label className="text-lg font-extrabold text-slate-800">{q4Label.split('\n')[0]} <span className="text-[#FF6F61]">*</span></label>
              </div>
              {q4Label.includes('\n') && <p className="text-sm font-bold text-slate-400 leading-relaxed pl-6 whitespace-pre-wrap text-left">{q4Label.split('\n').slice(1).join('\n')}</p>}
              <label className="flex items-center gap-3 p-5 rounded-2xl bg-[#F8FAFC] border-2 border-slate-100 cursor-pointer transition-colors hover:border-slate-200">
                <input 
                  type="checkbox" 
                  checked={finalCheck}
                  onChange={e => setFinalCheck(e.target.checked)}
                  className="w-5 h-5 accent-[#FF6F61]"
                />
                <span className="font-black text-slate-700 text-sm">네, 확인했습니다.</span>
              </label>
            </section>

            {/* 4.5 호감 공개 여부 선택 (v8.1.7) */}
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-[#FF6F61] font-black text-lg">4.5</span>
                <label className="text-lg font-extrabold text-slate-800">상대방에게 나의 호감을 어떻게 표시할까요? <span className="text-[#FF6F61]">*</span></label>
              </div>
              <p className="text-sm font-bold text-slate-400 leading-relaxed pl-6">결과 발표 시 적용될 나의 공개 모드입니다.</p>
              
              <div className="space-y-3 pl-6">
                {[
                  { id: 'public', label: '공개 모드', desc: '상대방에게 내 이름을 공개합니다 (나를 선택한 사람의 이름도 볼 수 있습니다)' },
                  { id: 'anonymous', label: '익명 모드', desc: "상대방에게 '익명'으로 표시합니다 (나를 선택한 사람도 '익명'으로 보입니다)" }
                ].map(opt => (
                  <label key={opt.id} className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    disclosureMode === opt.id ? 'border-[#FF6F61] bg-[#FFF5F4]' : 'border-slate-50 bg-slate-50 hover:border-slate-200'
                  }`}>
                    <input 
                      type="radio" 
                      name="disclosure" 
                      checked={disclosureMode === opt.id}
                      onChange={() => setDisclosureMode(opt.id as any)}
                      className="w-5 h-5 accent-[#FF6F61]"
                    />
                    <div>
                      <p className={`font-black text-sm ${disclosureMode === opt.id ? 'text-[#FF6F61]' : 'text-slate-700'}`}>{opt.label}</p>
                      <p className="text-[0.7rem] font-bold text-slate-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* 5. 후기 작성 */}
            <section className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="text-[#FF6F61] font-black text-lg">5.</span>
                <label className="text-lg font-extrabold text-slate-800">{q5Label}</label>
              </div>
              <textarea 
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="오늘 행사는 어떠셨나요? 소중한 후기를 들려주세요!"
                className="w-full h-32 p-5 rounded-2xl border-2 border-slate-100 focus:border-[#FF6F61] focus:ring-0 outline-none font-bold text-slate-700 transition-colors resize-none"
              />
            </section>

          </div>
          
          <div className="p-8 bg-[#FAFBFC] border-t border-slate-100">
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-16 rounded-2xl font-black text-xl text-white shadow-xl shadow-pink-100 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF6F61, #FF8A8A)' }}
            >
              {submitting ? '제출 중...' : '설문 제출하기'}
            </button>
            <p className="mt-4 text-center text-[0.7rem] text-slate-400 font-bold">
              제출된 데이터는 매칭 시스템 연산에만 활용되며 안전하게 보호됩니다.
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => router.push('/mypage')}
          className="flex items-center justify-center gap-2 w-full text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
        >
          <ChevronLeft size={16} /> 마이페이지로 이동
        </button>
      </div>
    </div>
  );
}
