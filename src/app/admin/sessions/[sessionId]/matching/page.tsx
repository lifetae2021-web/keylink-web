'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getSession } from '@/lib/firestore/sessions';
import { getAllVotesBySession } from '@/lib/firestore/votes';
import { Session, Vote, Application, MatchingAlgorithmResult } from '@/lib/types';
import { ArrowLeft, Play, CheckCircle2, AlertCircle, Heart, UserX, Trophy, Gift, RefreshCw, Users, BarChart3, ClipboardList, ChevronDown, ChevronUp, MessageSquare, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function MatchingAdminPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<MatchingAlgorithmResult | null>(null);
  const [participantMap, setParticipantMap] = useState<Record<string, Application>>({});
  const [votes, setVotes] = useState<Vote[]>([]);
  const [voteDetailOpen, setVoteDetailOpen] = useState(false);

  // 성별별 투표 데이터 분류 및 정렬 (호수 순)
  const { maleVotes, femaleVotes } = useMemo(() => {
    const realVotes = votes.filter(v => v.userId && !v.userId.startsWith('system_'));
    const m = realVotes.filter(v => participantMap[v.userId]?.gender === 'male');
    const f = realVotes.filter(v => participantMap[v.userId]?.gender === 'female');

    const sortBySlot = (a: Vote, b: Vote) => {
      const slotA = participantMap[a.userId]?.slotNumber || 999;
      const slotB = participantMap[b.userId]?.slotNumber || 999;
      return slotA - slotB;
    };

    return {
      maleVotes: m.sort(sortBySlot),
      femaleVotes: f.sort(sortBySlot)
    };
  }, [votes, participantMap]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/admin/login'); return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists() || snap.data().role !== 'admin') { router.push('/'); return; }
      loadData();
    });
    return () => unsub();
  }, [sessionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await getSession(sessionId);
      setSession(s);

      // orderBy 없이 클라이언트 정렬로 변경 (복합 인덱스 의존성 제거)
      const [appsSnap, fetchedVotes] = await Promise.all([
        getDocs(query(
          collection(db, 'applications'),
          where('sessionId', '==', sessionId),
          where('status', '==', 'confirmed')
        )),
        getAllVotesBySession(sessionId)
      ]);

      const confirmed: Application[] = appsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          sessionId: data.sessionId,
          name: data.name,
          age: data.age,
          gender: data.gender,
          job: data.job,
          residence: data.residence,
          phone: data.phone ?? '',
          status: data.status,
          paymentConfirmed: data.paymentConfirmed ?? false,
          slotNumber: data.slotNumber,
          appliedAt: data.appliedAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        } as Application;
      });

      const map: Record<string, Application> = {};
      confirmed.forEach(a => { map[a.userId] = a; });
      setParticipantMap(map);
      setVotes(fetchedVotes);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const receivedVotesMap = useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(participantMap).forEach(uid => { map[uid] = 0; });
    votes.forEach(vote => {
      vote.choices.forEach(choice => {
        if (map[choice.targetUserId] !== undefined) {
          map[choice.targetUserId]++;
        }
      });
    });
    return map;
  }, [votes, participantMap]);

  const submissionStats = useMemo(() => {
    const totalParticipants = Object.keys(participantMap).length;
    const votedUserIds = new Set(votes.map(v => v.userId));

    const submittedUsers: Application[] = [];
    const pendingUsers: Application[] = [];

    Object.values(participantMap).forEach(app => {
      if (votedUserIds.has(app.userId)) {
        submittedUsers.push(app);
      } else {
        pendingUsers.push(app);
      }
    });

    return {
      total: totalParticipants,
      submitted: submittedUsers,
      pending: pendingUsers,
      percent: totalParticipants > 0 ? Math.round((submittedUsers.length / totalParticipants) * 100) : 0
    };
  }, [participantMap, votes]);

  const handleGiveFakeVote = async (targetUserId: string) => {
    if (!confirm('이 참가자에게 시스템 권한으로 익명 하트(1표)를 은밀히 선물하시겠습니까?')) return;
    try {
      const fakeVoteId = `sys_fake_${Date.now()}_${targetUserId}`;
      await setDoc(doc(db, 'votes', fakeVoteId), {
        sessionId,
        userId: `system_anonymous_${Date.now()}`,
        choices: [{ priority: 1, targetUserId, reason: '시스템 익명 하트 선물' }],
        realName: '익명', myAlias: '0호',
        disclosureMode: 'anonymous',
        feedback: '위로의 하트',
        submittedAt: Timestamp.now()
      });
      toast.success('익명 하트 발송 완료!');
      loadData();
    } catch (e: any) {
      toast.error('하트 발송 실패: ' + e.message);
    }
  };

  const runAlgorithm = async () => {
    if (!confirm('매칭 알고리즘을 실행하시겠습니까? 기존 결과가 덮어씌워집니다.')) return;
    const user = auth.currentUser;
    if (!user) { toast.error('인증 세션이 만료되었습니다. 다시 로그인해 주세요.'); return; }
    setRunning(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/sessions/${sessionId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '매칭 연산 중 오류가 발생했습니다.');
      setResult(data.result);
      toast.success(`매칭 완료! ${data.stats.coupleCount}쌍 성공, ${data.stats.unmatchedCount}명 미매칭`);
      loadData();
    } catch (e: any) {
      toast.error(e.message || '알고리즘 실행 중 오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  };

  const approveResults = async () => {
    if (!result) return;
    if (!confirm('매칭 결과를 최종 승인하시겠습니까? 참가자들의 마이페이지에 즉시 공개됩니다.')) return;
    setApproving(true);
    try {
      const allIds = [
        ...result.matchedPairs.flatMap(p => [`${sessionId}_${p.userAId}`, `${sessionId}_${p.userBId}`]),
        ...result.unmatchedUserIds.map(uid => `${sessionId}_${uid}`),
      ];
      await Promise.all(allIds.map(id =>
        updateDoc(doc(db, 'matchingResults', id), { status: 'approved', approvedAt: Timestamp.now() })
      ));
      await updateDoc(doc(db, 'sessions', sessionId), { status: 'completed' });
      toast.success('✅ 최종 승인 완료! 참가자 마이페이지에 결과가 공개되었습니다.');
      setSession(prev => prev ? { ...prev, status: 'completed' } : prev);
    } catch (e: any) {
      toast.error('승인 중 오류: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  const renderVoteCard = (vote: Vote) => {
    const voter = participantMap[vote.userId];
    const isMale = voter?.gender === 'male';
    return (
      <div key={vote.userId} className="p-5 hover:bg-slate-50/50 transition-colors">
        {/* 투표자 정보 */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${
            isMale ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
          }`}>
            {voter?.slotNumber ? `${voter.slotNumber}호` : (voter?.name?.[0] || '?')}
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm">
              {voter?.name || vote.userId}
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                isMale ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
              }`}>
                {isMale ? '남' : '여'} {voter?.slotNumber ? `${voter.slotNumber}호` : ''}
              </span>
              {vote.disclosureMode === 'anonymous' && (
                <span className="ml-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 inline-flex items-center gap-1">
                  <EyeOff size={10} /> 익명 모드
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 선택한 상대방 */}
        <div className="mb-3">
          <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
            <Heart size={11} className="text-[#FF6F61]" /> 선택한 이성
          </p>
          <div className="flex flex-wrap gap-2">
            {vote.choices && vote.choices.length > 0 ? (
              vote.choices
                .slice()
                .sort((a, b) => {
                  const targetA = participantMap[a.targetUserId]?.slotNumber || 999;
                  const targetB = participantMap[b.targetUserId]?.slotNumber || 999;
                  return targetA - targetB;
                })
                .map((choice, idx) => {
                  const target = participantMap[choice.targetUserId];
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 text-xs font-bold rounded-lg border border-pink-100"
                    >
                      <Heart size={10} fill="currentColor" />
                      {target?.name || choice.targetUserId}
                      {target?.slotNumber && (
                        <span className="text-pink-400 font-normal">{target.slotNumber}호</span>
                      )}
                    </span>
                  );
                })
            ) : (
              <span className="text-xs text-slate-400">선택 없음</span>
            )}
          </div>
        </div>

        {/* 후기 */}
        {vote.feedback && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
              <MessageSquare size={11} /> 행사 후기
            </p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{vote.feedback}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#FF6F61] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Link href="/admin/events" className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeft size={20} className="text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900">매칭 엔진</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {session?.title || sessionId} · 상태: <span className="font-bold text-[#FF6F61]">{session?.status}</span>
            </p>
          </div>
          <button
            onClick={loadData}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={14} /> 새로고침
          </button>
        </div>

        {/* 투표 상세 내역 */}
        {votes.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setVoteDetailOpen(v => !v)}
              className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <ClipboardList size={18} className="text-violet-500" />
                투표 상세 내역
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 ml-1">
                  {votes.filter(v => !v.userId.startsWith('system_')).length}건
                </span>
              </h2>
              {voteDetailOpen
                ? <ChevronUp size={18} className="text-slate-400" />
                : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {voteDetailOpen && (
              <div className="border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                {/* 키링남 (왼쪽) */}
                <div className="divide-y divide-slate-100">
                  <div className="px-6 py-3 bg-blue-50/50 border-b border-slate-100">
                    <p className="text-xs font-black text-blue-600 flex items-center gap-1.5 uppercase tracking-wider">
                      <Users size={14} /> 키링남 투표 ({maleVotes.length})
                    </p>
                  </div>
                  {maleVotes.length > 0 ? (
                    maleVotes.map(vote => renderVoteCard(vote))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">제출된 투표가 없습니다.</div>
                  )}
                </div>

                {/* 키링녀 (오른쪽) */}
                <div className="divide-y divide-slate-100">
                  <div className="px-6 py-3 bg-pink-50/50 border-b border-slate-100">
                    <p className="text-xs font-black text-pink-600 flex items-center gap-1.5 uppercase tracking-wider">
                      <Users size={14} /> 키링녀 투표 ({femaleVotes.length})
                    </p>
                  </div>
                  {femaleVotes.length > 0 ? (
                    femaleVotes.map(vote => renderVoteCard(vote))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">제출된 투표가 없습니다.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 알고리즘 실행 카드 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <Play size={17} className="text-[#FF6F61]" /> 매칭 알고리즘 실행
          </h2>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            투표 데이터를 기반으로 <strong className="text-slate-600">상호 선택 (어느 순위든 서로 선택)</strong> 방식으로 매칭 쌍을 계산합니다.<br />
            결과는 '대기(pending)' 상태로 저장되며, 검토 후 최종 승인 시 참가자에게 공개됩니다.
          </p>
          <button
            onClick={runAlgorithm}
            disabled={running || session?.status === 'completed'}
            className="flex items-center gap-3 px-8 py-3.5 bg-[#FF6F61] hover:bg-[#ff5746] text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-100"
          >
            <Play size={18} fill="white" />
            {running ? '알고리즘 실행 중...' : '매칭 알고리즘 실행'}
          </button>
          {session?.status === 'completed' && (
            <p className="mt-3 text-emerald-600 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} /> 이 기수는 이미 최종 승인되었습니다.
            </p>
          )}
        </div>

        {/* 결과 미리보기 */}
        {result && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '매칭 성공 쌍', value: result.matchedPairs.length, icon: <Heart size={22} className="text-[#FF6F61]" />, cls: 'text-[#FF6F61]' },
                { label: '미매칭', value: result.unmatchedUserIds.length, icon: <UserX size={22} className="text-slate-400" />, cls: 'text-slate-500' },
                { label: '총 투표 참여자', value: result.matchedPairs.length * 2 + result.unmatchedUserIds.length, icon: <Trophy size={22} className="text-amber-500" />, cls: 'text-amber-600' },
              ].map(({ label, value, icon, cls }) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                  <div className="flex justify-center mb-3">{icon}</div>
                  <p className={`text-3xl font-black ${cls}`}>{value}</p>
                  <p className="text-slate-400 text-xs font-semibold mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* 매칭 쌍 목록 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-pink-50">
                <h3 className="font-extrabold text-[#FF6F61] flex items-center gap-2">
                  <Heart size={16} fill="currentColor" /> 매칭 성공 ({result.matchedPairs.length}쌍)
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {result.matchedPairs.map((pair, i) => {
                  const a = participantMap[pair.userAId];
                  const b = participantMap[pair.userBId];
                  return (
                    <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <span className="font-bold text-sm text-slate-800">
                        {a?.slotNumber ? `${a.gender === 'male' ? '남' : '여'} ${a.slotNumber}호` : ''} {a?.name || pair.userAId}
                      </span>
                      <Heart size={16} className="text-[#FF6F61] mx-4" fill="currentColor" />
                      <span className="font-bold text-sm text-slate-800">
                        {b?.slotNumber ? `${b.gender === 'male' ? '남' : '여'} ${b.slotNumber}호` : ''} {b?.name || pair.userBId}
                      </span>
                    </div>
                  );
                })}
                {result.matchedPairs.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">매칭된 쌍이 없습니다.</div>
                )}
              </div>
            </div>

            {/* 미매칭 목록 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-extrabold text-slate-600 flex items-center gap-2">
                  <Users size={16} /> 미매칭 인원 ({result.unmatchedUserIds.length}명) — 0표 방지 시스템
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {result.unmatchedUserIds.map((uid) => {
                  const u = participantMap[uid];
                  const voteCount = receivedVotesMap[uid] || 0;
                  return (
                    <div key={uid} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-800">
                          {u?.slotNumber ? `${u.gender === 'male' ? '남' : '여'} ${u.slotNumber}호` : ''} {u?.name || uid}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${voteCount === 0 ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-slate-100 text-slate-500'}`}>
                          받은 표: {voteCount}개
                        </span>
                      </div>
                      <button
                        onClick={() => handleGiveFakeVote(uid)}
                        disabled={session?.status === 'completed'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-pink-50 text-[#FF6F61] border border-pink-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                      >
                        <Gift size={13} /> + 익명 하트 주기
                      </button>
                    </div>
                  );
                })}
                {result.unmatchedUserIds.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">미매칭 인원이 없습니다.</div>
                )}
              </div>
            </div>

            {/* 최종 승인 버튼 */}
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <AlertCircle size={22} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-amber-600 mb-1.5">최종 승인 전 꼭 확인하세요</h3>
                  <p className="text-slate-500 text-sm mb-5 leading-relaxed">
                    승인 즉시 참가자들의 마이페이지에 매칭 결과가 공개됩니다.<br />
                    한 번 승인된 결과는 되돌릴 수 없습니다.
                  </p>
                  <button
                    onClick={approveResults}
                    disabled={approving}
                    className="flex items-center gap-2.5 px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-md shadow-amber-100"
                  >
                    <CheckCircle2 size={18} />
                    {approving ? '승인 처리 중...' : '매칭 결과 최종 승인 및 공개'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
