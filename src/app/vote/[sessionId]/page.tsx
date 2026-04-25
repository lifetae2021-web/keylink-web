'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { subscribeSession } from '@/lib/firestore/sessions';
import { getMyVote, submitVote, getAllVotesBySession } from '@/lib/firestore/votes';
import { getApplicationBySession } from '@/lib/firestore/applications';
import { Session, Application, VoteChoice } from '@/lib/types';
import { Heart, Lock, CheckCircle2, ChevronLeft, User, Eye, EyeOff, MessageSquare, BarChart2, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Candidate {
  userId: string;
  name: string;
  age: number;
  job: string;
  residence: string;
  gender: 'male' | 'female';
  photos?: string[];
}

function SectionCard({ number, icon, title, required, children }: {
  number: number;
  icon: React.ReactNode;
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-slate-50">
        <div className="w-8 h-8 rounded-full bg-[#FF6F61] flex items-center justify-center text-white font-black text-sm shrink-0">
          {number}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#FF6F61]">{icon}</span>
          <h2 className="font-extrabold text-slate-800 text-base">
            {title}
            {required && <span className="text-[#FF6F61] ml-1">*</span>}
          </h2>
        </div>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [realName, setRealName] = useState('');
  const [myAlias, setMyAlias] = useState('');
  const [finalCheck, setFinalCheck] = useState(false);
  const [disclosureMode, setDisclosureMode] = useState<'public' | 'anonymous'>('public');
  const [feedback, setFeedback] = useState('');
  const [nextEventOpt, setNextEventOpt] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showVoteStatus, setShowVoteStatus] = useState(false);
  const [voteStatusData, setVoteStatusData] = useState<{
    submitted: { name: string; alias: string; gender: 'male' | 'female' }[];
    pending: { name: string; alias: string; gender: 'male' | 'female' }[];
  } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.uid);

      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists() && userSnap.data()?.role === 'admin') {
        setIsAdmin(true);
      }

      const app = await getApplicationBySession(user.uid, sessionId);
      if (!app || app.status !== 'confirmed') {
        toast.error('참가 확정된 사용자만 투표할 수 있습니다.');
        router.push('/mypage');
        return;
      }
      setMyApplication(app);
      setRealName(app.name || '');
      if (app.slotNumber) {
        const prefix = app.gender === 'male' ? '키링남' : '키링녀';
        setMyAlias(`${prefix} ${app.slotNumber}호`);
      }

      const existingVote = await getMyVote(sessionId, user.uid);
      if (existingVote) { setHasVoted(true); }

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

    const unsubSession = subscribeSession(sessionId, setSession);
    return () => { unsub(); unsubSession(); };
  }, [sessionId]);

  const handleOpenVoteStatus = async () => {
    setShowVoteStatus(true);
    if (voteStatusData) return;
    setLoadingStatus(true);
    try {
      const [allAppsSnap, votes] = await Promise.all([
        getDocs(query(
          collection(db, 'applications'),
          where('sessionId', '==', sessionId),
          where('status', '==', 'confirmed')
        )),
        getAllVotesBySession(sessionId),
      ]);

      const submittedUserIds = new Set(votes.map(v => v.userId));

      const submitted: { name: string; alias: string; gender: 'male' | 'female' }[] = [];
      const pending: { name: string; alias: string; gender: 'male' | 'female' }[] = [];

      allAppsSnap.docs.forEach(d => {
        const data = d.data();
        const gender = data.gender as 'male' | 'female';
        const prefix = gender === 'male' ? '키링남' : '키링녀';
        const alias = data.slotNumber ? `${prefix} ${data.slotNumber}호` : prefix;
        const entry = { name: data.name, alias, gender };
        if (submittedUserIds.has(data.userId)) {
          submitted.push(entry);
        } else {
          pending.push(entry);
        }
      });

      submitted.sort((a, b) => a.alias.localeCompare(b.alias));
      pending.sort((a, b) => a.alias.localeCompare(b.alias));
      setVoteStatusData({ submitted, pending });
    } catch (e) {
      toast.error('현황을 불러오지 못했습니다.');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleChoiceSelect = (priority: 1 | 2 | 3, targetUserId: string) => {
    setChoices(prev => {
      const next = { ...prev };
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
    if (!myAlias) { toast.error('본인 호수를 선택해주세요.'); return; }
    if (Object.keys(choices).length === 0 && !nextEventOpt) {
      toast.error('호감 가는 이성을 선택해주세요.');
      return;
    }
    if (!feedback.trim()) { toast.error('참여 후기를 필수로 작성해주세요.'); return; }
    if (!userId) return;

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
        finalCheck: true, // 체크 항목 생략됨 (자동 동의)
        disclosureMode,
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
    <div className="min-h-screen bg-[#FFF5F3] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#FF6F61] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isEventDay = session ? (
    new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) ===
    session.eventDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
  ) : false;

  if (session?.status !== 'voting' && !isEventDay) {
    return (
      <div className="min-h-screen bg-[#FFF5F3] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-6">
          <Lock size={36} className="text-slate-300" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-3">투표가 아직 열리지 않았습니다</h1>
        <p className="text-slate-400 font-medium mb-8 leading-relaxed">
          행사 당일 운영진이 투표를 활성화하면<br />이 페이지에서 투표하실 수 있습니다.
        </p>
        <Link href="/mypage" className="px-8 py-3 rounded-2xl bg-[#FF6F61] text-white font-bold">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="min-h-screen bg-[#FFF5F3] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-3">투표 완료!</h1>
        <p className="text-slate-400 font-medium mb-8 leading-relaxed">
          투표가 성공적으로 제출되었습니다.<br />매칭 결과는 행사 후 마이페이지에서 확인하실 수 있습니다.
        </p>
        <Link href="/mypage" className="px-8 py-3 rounded-2xl bg-[#FF6F61] text-white font-bold">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const maxLimit = session?.voteConfig?.maxSelection || 3;
  const questionText = session?.voteConfig?.questionText || `오늘 가장 호감 갔던 이성을 ${maxLimit}명까지 골라주세요.`;
  const q1Label = session?.voteConfig?.q1Label || '실명';
  const q2Label = session?.voteConfig?.q2Label || '본인 호수';
  const q3Label = session?.voteConfig?.q3Label || '호감 가는 이성 선택';
  const q4Label = session?.voteConfig?.q4Label || '최종 라인업 및 메모를 확인하셨나요?';
  const q5Label = session?.voteConfig?.q5Label || '후기';
  const regionLabel = session?.region === 'busan' ? '부산' : '창원';

  return (
    <div className="min-h-screen bg-[#FFF5F3] pb-24">

      {/* 관리자 투표 현황 팝업 */}
      {isAdmin && showVoteStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-[#FF6F61]" />
                <h2 className="font-black text-slate-800 text-base">투표 제출 현황</h2>
              </div>
              <button onClick={() => setShowVoteStatus(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {loadingStatus ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-[#FF6F61] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : voteStatusData ? (
                <>
                  <div>
                    <p className="text-xs font-black text-green-600 mb-2">
                      제출 완료 ({voteStatusData.submitted.length}명)
                    </p>
                    {voteStatusData.submitted.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">아직 없습니다.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {voteStatusData.submitted.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-100">
                            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                            <span className="text-sm font-bold text-slate-700">{p.alias}</span>
                            <span className="text-xs text-slate-400 ml-auto">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-rose-500 mb-2">
                      미제출 ({voteStatusData.pending.length}명)
                    </p>
                    {voteStatusData.pending.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">모두 제출 완료!</p>
                    ) : (
                      <div className="space-y-1.5">
                        {voteStatusData.pending.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-300 shrink-0" />
                            <span className="text-sm font-bold text-slate-700">{p.alias}</span>
                            <span className="text-xs text-slate-400 ml-auto">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            {!loadingStatus && voteStatusData && (
              <div className="px-5 py-3 border-t border-slate-100">
                <button
                  onClick={() => { setVoteStatusData(null); handleOpenVoteStatus(); }}
                  className="w-full py-2 rounded-xl text-sm font-bold text-[#FF6F61] border border-[#FF6F61]/30 hover:bg-[#FFF5F4] transition-colors"
                >
                  새로고침
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full bg-gradient-to-b from-[#FF6F61] to-[#FF8C7E] pt-20 pb-10 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <Heart size={120} fill="white" className="absolute -top-6 -left-6 text-white" />
          <Heart size={80} fill="white" className="absolute bottom-0 right-4 text-white" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-4">
            <Heart size={28} fill="white" className="text-white" />
          </div>
          <p className="text-white/70 font-bold text-sm mb-1">{regionLabel} 키링크 {session?.episodeNumber}기</p>
          <h1 className="text-2xl font-black text-white">호감도 투표</h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-[600px] mx-auto px-4 -mt-4 space-y-4 relative z-10">

        {/* 섹션 1: 실명 및 호수 확인 */}
        <SectionCard number={1} icon={<User size={16} />} title="실명 및 본인 호수" required>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-14 flex items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-600 text-lg cursor-not-allowed">
              {realName || '정보 없음'}
            </div>
            <div className="flex-1 h-14 flex items-center justify-center rounded-2xl border-2 border-[#FF6F61] bg-[#FF6F61] text-white font-black text-lg shadow-sm shadow-pink-200">
              {myAlias || '호수 정보 없음'}
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-400 font-medium text-center">배정받으신 본인의 정보입니다. 수정이 불가합니다.</p>
        </SectionCard>

        {/* 섹션 2: 이성 선택 */}
        <SectionCard number={2} icon={<Heart size={16} />} title={q3Label} required>
          <p className="text-sm text-slate-400 font-medium mb-4">{questionText}</p>

          {/* 선택 진행 상황 */}
          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: maxLimit }, (_, i) => i + 1).map(p => (
              <div
                key={p}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  choices[p] ? 'bg-[#FF6F61]' : 'bg-slate-100'
                }`}
              />
            ))}
            <span className={`text-xs font-black ml-1 ${Object.keys(choices).length > 0 ? 'text-[#FF6F61]' : 'text-slate-300'}`}>
              {Object.keys(choices).length}/{maxLimit}
            </span>
          </div>

          <div className="space-y-2">
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
                      const nextP = [1, 2, 3, 4, 5].find(p => !choices[p]);
                      if (nextP) handleChoiceSelect(nextP as any, candidate.userId);
                    }
                  }}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    priority
                      ? 'border-[#FF6F61] bg-[#FFF5F4]'
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  {/* 순위 또는 번호 */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                    priority ? 'bg-[#FF6F61] text-white' : 'bg-white border-2 border-slate-200 text-slate-400'
                  }`}>
                    {priority ? <Heart size={16} fill="white" /> : idx + 1}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 text-left">
                    <p className={`font-black text-sm ${priority ? 'text-[#FF6F61]' : 'text-slate-700'}`}>
                      {label} {idx + 1}호
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      {candidate.age}세 · {candidate.job} · {candidate.residence?.split(' ')[0]}
                    </p>
                  </div>

                  {priority && <CheckCircle2 size={20} className="text-[#FF6F61] shrink-0" />}
                </div>
              );
            })}

            {/* 다음 인연 기대 */}
            <div
              onClick={() => setNextEventOpt(!nextEventOpt)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                nextEventOpt ? 'border-[#FF6F61] bg-[#FFF5F4]' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                nextEventOpt ? 'bg-[#FF6F61]' : 'bg-white border-2 border-slate-200'
              }`}>
                <Heart size={14} fill={nextEventOpt ? 'white' : 'none'} className={nextEventOpt ? 'text-white' : 'text-slate-300'} />
              </div>
              <p className={`flex-1 text-left font-black text-sm ${nextEventOpt ? 'text-[#FF6F61]' : 'text-slate-500'}`}>
                다음 새로운 인연을 기대할게요 ❤️
              </p>
              {nextEventOpt && <CheckCircle2 size={20} className="text-[#FF6F61] shrink-0" />}
            </div>
          </div>
        </SectionCard>

        {/* 섹션 3: 공개 모드 */}
        <SectionCard number={3} icon={<Eye size={16} />} title="호감 공개 여부" required>
          <p className="text-sm text-slate-400 font-medium mb-4">결과 발표 시 적용될 나의 공개 모드입니다.</p>
          <div className="space-y-2">
            {[
              {
                id: 'public',
                label: '공개 모드',
                desc: '상대방에게 내 호수를 공개합니다',
                icon: <Eye size={18} />,
              },
              {
                id: 'anonymous',
                label: '익명 모드',
                desc: "상대방에게 '익명'으로 보이며, 나를 선택한 상대방이 공개모드라도 나에게는 무조건 '익명'으로 표시됩니다.",
                icon: <EyeOff size={18} />,
              },
            ].map(opt => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  disclosureMode === opt.id
                    ? 'border-[#FF6F61] bg-[#FFF5F4]'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="disclosure"
                  checked={disclosureMode === opt.id}
                  onChange={() => setDisclosureMode(opt.id as any)}
                  className="w-4 h-4 accent-[#FF6F61] shrink-0"
                />
                <span className={`shrink-0 ${disclosureMode === opt.id ? 'text-[#FF6F61]' : 'text-slate-400'}`}>
                  {opt.icon}
                </span>
                <div className="flex flex-col text-left">
                  <p className={`font-black text-sm ${disclosureMode === opt.id ? 'text-[#FF6F61]' : 'text-slate-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs font-medium text-slate-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* 섹션 4: 후기 */}
        <SectionCard number={4} icon={<MessageSquare size={16} />} title={q5Label} required>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="오늘 행사는 어떠셨나요? 소중한 후기를 들려주세요!"
            className="w-full h-28 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#FF6F61] focus:bg-white focus:ring-0 outline-none font-medium text-slate-700 transition-all resize-none text-sm"
          />
        </SectionCard>

        {/* 제출 */}
        <div className="pt-2 pb-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-black text-lg text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #FF6F61, #FF9A8B)' }}
          >
            {submitting ? '제출 중...' : '투표 제출하기'}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400 font-medium">
            제출된 데이터는 매칭 시스템 연산에만 활용되며 안전하게 보호됩니다.
          </p>
        </div>

        <button
          onClick={() => router.push('/mypage')}
          className="flex items-center justify-center gap-1 w-full text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors pb-4"
        >
          <ChevronLeft size={16} /> 마이페이지로 이동
        </button>

      </div>
    </div>
  );
}
