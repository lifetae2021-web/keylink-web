'use client';

import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, getDoc, query, where, setDoc, updateDoc, Timestamp, doc } from 'firebase/firestore';
import { getAllVotesBySession } from '@/lib/firestore/votes';
import { Session, Vote, Application, MatchingAlgorithmResult } from '@/lib/types';
import {
  X, Play, CheckCircle2, AlertCircle, Heart, UserX, Trophy, Gift,
  RefreshCw, Users, ClipboardList, ChevronDown, ChevronUp, MessageSquare, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  session: Session;
  onClose: () => void;
}

export default function MatchingDrawer({ session, onClose }: Props) {
  const sessionId = session.id;

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<MatchingAlgorithmResult | null>(null);
  const [participantMap, setParticipantMap] = useState<Record<string, Application>>({});
  const [votes, setVotes] = useState<Vote[]>([]);
  const [voteDetailOpen, setVoteDetailOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(session.status);

  const { maleVotes, femaleVotes } = useMemo(() => {
    const realVotes = votes.filter(v => v.userId && !v.userId.startsWith('system_'));
    const sortBySlot = (a: Vote, b: Vote) => {
      const slotA = participantMap[a.userId]?.slotNumber || 999;
      const slotB = participantMap[b.userId]?.slotNumber || 999;
      return slotA - slotB;
    };
    return {
      maleVotes: realVotes.filter(v => participantMap[v.userId]?.gender === 'male').sort(sortBySlot),
      femaleVotes: realVotes.filter(v => participantMap[v.userId]?.gender === 'female').sort(sortBySlot),
    };
  }, [votes, participantMap]);

  const receivedVotesMap = useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(participantMap).forEach(uid => { map[uid] = 0; });
    votes.forEach(vote => {
      vote.choices.forEach(choice => {
        if (map[choice.targetUserId] !== undefined) map[choice.targetUserId]++;
      });
    });
    return map;
  }, [votes, participantMap]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsSnap, fetchedVotes] = await Promise.all([
        getDocs(query(collection(db, 'applications'), where('sessionId', '==', sessionId), where('status', '==', 'confirmed'))),
        getAllVotesBySession(sessionId),
      ]);

      const map: Record<string, Application> = {};
      appsSnap.docs.forEach(d => {
        const data = d.data();
        map[data.userId] = {
          id: d.id, userId: data.userId, sessionId: data.sessionId,
          name: data.name, age: data.age, gender: data.gender, job: data.job,
          residence: data.residence, phone: data.phone ?? '', status: data.status,
          paymentConfirmed: data.paymentConfirmed ?? false, slotNumber: data.slotNumber,
          appliedAt: data.appliedAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        } as Application;
      });
      setParticipantMap(map);
      setVotes(fetchedVotes);

      // 요약 문서 직접 읽기
      const summarySnap = await getDoc(doc(db, 'matchingSummaries', sessionId));
      if (summarySnap.exists()) {
        const d = summarySnap.data();
        setResult({
          sessionId,
          matchedPairs: d.matchedPairs ?? [],
          unmatchedUserIds: d.unmatchedUserIds ?? [],
          voteCountMap: d.voteCountMap ?? {},
          calculatedAt: d.calculatedAt?.toDate?.() ?? new Date(),
        });
      } else {
        // 결과 없으면 자동 실행
        await runAlgorithmCore();
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [sessionId]);

  const runAlgorithmCore = async () => {
    const user = auth.currentUser;
    if (!user) { toast.error('인증 세션이 만료되었습니다. 다시 로그인해 주세요.'); return; }
    setRunning(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/sessions/${sessionId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '매칭 연산 중 오류가 발생했습니다.');
      setResult(data.result);
      toast.success(`매칭 완료! ${data.stats.coupleCount}쌍 성공, ${data.stats.unmatchedCount}명 미매칭`);
      const refreshedVotes = await getAllVotesBySession(sessionId);
      setVotes(refreshedVotes);
    } catch (e: any) {
      toast.error(e.message || '알고리즘 실행 중 오류가 발생했습니다.');
    } finally { setRunning(false); }
  };

  const runAlgorithm = async () => {
    if (!confirm('매칭 알고리즘을 실행하시겠습니까? 기존 결과가 덮어씌워집니다.')) return;
    await runAlgorithmCore();
  };

  const approveResults = async () => {
    if (!result) return;
    if (!confirm('매칭 결과를 최종 승인하시겠습니까? 참가자들의 마이페이지에 즉시 공개됩니다.')) return;
    setApproving(true);
    try {
      await Promise.all([
        updateDoc(doc(db, 'matchingSummaries', sessionId), { status: 'approved', approvedAt: Timestamp.now() }),
        updateDoc(doc(db, 'sessions', sessionId), { status: 'completed' }),
      ]);
      toast.success('✅ 최종 승인 완료! 참가자 마이페이지에 결과가 공개되었습니다.');
      setSessionStatus('completed');
    } catch (e: any) {
      toast.error('승인 중 오류: ' + e.message);
    } finally { setApproving(false); }
  };

  const handleGiveFakeVote = async (targetUserId: string) => {
    if (!confirm('이 참가자에게 시스템 권한으로 익명 하트(1표)를 은밀히 선물하시겠습니까?')) return;
    try {
      const fakeVoteId = `sys_fake_${Date.now()}_${targetUserId}`;
      await setDoc(doc(db, 'votes', fakeVoteId), {
        sessionId, userId: `system_anonymous_${Date.now()}`,
        choices: [{ priority: 1, targetUserId, reason: '시스템 익명 하트 선물' }],
        realName: '익명', myAlias: '0호', disclosureMode: 'anonymous',
        feedback: '위로의 하트', submittedAt: Timestamp.now(),
      });
      toast.success('익명 하트 발송 완료!');
      loadData();
    } catch (e: any) { toast.error('하트 발송 실패: ' + e.message); }
  };

  const renderVoteCard = (vote: Vote) => {
    const voter = participantMap[vote.userId];
    const isMale = voter?.gender === 'male';
    return (
      <div key={vote.userId} className="p-5 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${isMale ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
            {voter?.slotNumber ? `${voter.slotNumber}호` : (voter?.name?.[0] || '?')}
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm">
              {voter?.name || vote.userId}
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${isMale ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
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
        <div className="mb-3">
          <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
            <Heart size={11} className="text-[#FF6F61]" /> 선택한 이성
          </p>
          <div className="flex flex-wrap gap-2">
            {vote.choices && vote.choices.length > 0 ? (
              vote.choices.slice().sort((a, b) => {
                const sA = participantMap[a.targetUserId]?.slotNumber || 999;
                const sB = participantMap[b.targetUserId]?.slotNumber || 999;
                return sA - sB;
              }).map((choice, idx) => {
                const target = participantMap[choice.targetUserId];
                return (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 text-xs font-bold rounded-lg border border-pink-100">
                    <Heart size={10} fill="currentColor" />
                    {target?.name || choice.targetUserId}
                    {target?.slotNumber && <span className="text-pink-400 font-normal">{target.slotNumber}호</span>}
                  </span>
                );
              })
            ) : <span className="text-xs text-slate-400">선택 없음</span>}
          </div>
        </div>
        {vote.feedback && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"><MessageSquare size={11} /> 행사 후기</p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{vote.feedback}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 오버레이 */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* 드로어 */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-50 z-50 flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Trophy size={18} className="text-pink-500" /> 매칭 엔진
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {session.title} · 상태: <span className="font-bold text-[#FF6F61]">{sessionStatus}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
              <RefreshCw size={15} className="text-slate-500" />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#FF6F61] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* 투표 상세 내역 */}
              {votes.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setVoteDetailOpen(v => !v)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <ClipboardList size={16} className="text-violet-500" />
                      투표 상세 내역
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                        {maleVotes.length + femaleVotes.length}건
                      </span>
                    </h3>
                    {voteDetailOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>
                  {voteDetailOpen && (
                    <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
                      <div className="divide-y divide-slate-100">
                        <div className="px-4 py-2 bg-blue-50/50">
                          <p className="text-xs font-black text-blue-600 flex items-center gap-1"><Users size={12} /> 키링남 ({maleVotes.length})</p>
                        </div>
                        {maleVotes.length > 0 ? maleVotes.map(renderVoteCard) : <div className="p-6 text-center text-slate-400 text-xs">제출된 투표가 없습니다.</div>}
                      </div>
                      <div className="divide-y divide-slate-100">
                        <div className="px-4 py-2 bg-pink-50/50">
                          <p className="text-xs font-black text-pink-600 flex items-center gap-1"><Users size={12} /> 키링녀 ({femaleVotes.length})</p>
                        </div>
                        {femaleVotes.length > 0 ? femaleVotes.map(renderVoteCard) : <div className="p-6 text-center text-slate-400 text-xs">제출된 투표가 없습니다.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 알고리즘 실행 */}
              {!result ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 mb-1">
                    <Play size={15} className="text-[#FF6F61]" /> 매칭 알고리즘 실행
                  </h3>
                  <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                    투표 데이터를 기반으로 <strong className="text-slate-600">상호 선택</strong> 방식으로 매칭 쌍을 계산합니다.<br />
                    결과는 '대기(pending)' 상태로 저장되며, 검토 후 최종 승인 시 참가자에게 공개됩니다.
                  </p>
                  <button
                    onClick={runAlgorithm}
                    disabled={running || sessionStatus === 'completed'}
                    className="flex items-center gap-2 px-6 py-3 bg-[#FF6F61] hover:bg-[#ff5746] text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-100"
                  >
                    <Play size={16} fill="white" />
                    {running ? '알고리즘 실행 중...' : '매칭 알고리즘 실행'}
                  </button>
                  {sessionStatus === 'completed' && (
                    <p className="mt-3 text-emerald-600 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> 이 기수는 이미 최종 승인되었습니다.
                    </p>
                  )}
                </div>
              ) : (
                sessionStatus !== 'completed' && (
                  <div className="flex justify-end">
                    <button
                      onClick={runAlgorithm}
                      disabled={running}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
                      {running ? '실행 중...' : '투표매칭 재실행'}
                    </button>
                  </div>
                )
              )}

              {/* 결과 */}
              {result && (
                <>
                  {/* 요약 카드 */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '매칭 성공 쌍', value: result.matchedPairs.length, icon: <Heart size={20} className="text-[#FF6F61]" />, cls: 'text-[#FF6F61]' },
                      { label: '미매칭', value: result.unmatchedUserIds.length, icon: <UserX size={20} className="text-slate-400" />, cls: 'text-slate-500' },
                      { label: '미투표자', value: Object.keys(participantMap).length - new Set(votes.filter(v => !v.userId.startsWith('system_')).map(v => v.userId)).size, icon: <Users size={20} className="text-amber-500" />, cls: 'text-amber-600' },
                    ].map(({ label, value, icon, cls }) => (
                      <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                        <div className="flex justify-center mb-2">{icon}</div>
                        <p className={`text-2xl font-black ${cls}`}>{value}</p>
                        <p className="text-slate-400 text-[0.65rem] font-semibold mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* 매칭 쌍 */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 bg-pink-50">
                      <h3 className="font-extrabold text-[#FF6F61] text-sm flex items-center gap-2">
                        <Heart size={14} fill="currentColor" /> 매칭 성공 ({result.matchedPairs.length}쌍)
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {result.matchedPairs.map((pair, i) => {
                        const a = participantMap[pair.userAId];
                        const b = participantMap[pair.userBId];
                        return (
                          <div key={i} className="px-5 py-3.5 flex items-center hover:bg-slate-50 transition-colors">
                            <div className="flex-1 flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${a?.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                {a?.gender === 'male' ? '남' : '여'} {a?.slotNumber}호
                              </span>
                              <span className="font-bold text-sm text-slate-800">{a?.name || pair.userAId}</span>
                            </div>
                            <Heart size={14} className="text-[#FF6F61] mx-4 shrink-0" fill="currentColor" />
                            <div className="flex-1 flex items-center justify-end gap-2">
                              <span className="font-bold text-sm text-slate-800">{b?.name || pair.userBId}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${b?.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                {b?.gender === 'male' ? '남' : '여'} {b?.slotNumber}호
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {result.matchedPairs.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">매칭된 쌍이 없습니다.</div>
                      )}
                    </div>
                  </div>

                  {/* 미매칭 */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-extrabold text-slate-600 text-sm flex items-center gap-2">
                        <Users size={14} /> 미매칭 인원 ({result.unmatchedUserIds.length}명)
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[...result.unmatchedUserIds]
                        .sort((a, b) => {
                          const ua = participantMap[a];
                          const ub = participantMap[b];
                          if (ua?.gender !== ub?.gender) return ua?.gender === 'male' ? -1 : 1;
                          return (ua?.slotNumber || 999) - (ub?.slotNumber || 999);
                        })
                        .map(uid => {
                        const u = participantMap[uid];
                        const voteCount = receivedVotesMap[uid] || 0;
                        return (
                          <div key={uid} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${u?.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                {u?.gender === 'male' ? '남' : '여'} {u?.slotNumber}호
                              </span>
                              <span className="font-bold text-sm text-slate-800">{u?.name || uid}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${voteCount === 0 ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-slate-100 text-slate-500'}`}>
                                받은 표: {voteCount}개
                              </span>
                            </div>
                            <button
                              onClick={() => handleGiveFakeVote(uid)}
                              disabled={sessionStatus === 'completed'}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-pink-50 text-[#FF6F61] border border-pink-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                            >
                              <Gift size={12} /> + 익명 하트
                            </button>
                          </div>
                        );
                      })}
                      {result.unmatchedUserIds.length === 0 && (
                        <div className="p-6 text-center text-slate-400 text-sm">미매칭 인원이 없습니다.</div>
                      )}
                    </div>
                  </div>

                  {/* 미투표자 */}
                  {(() => {
                    const votedIds = new Set(votes.filter(v => !v.userId.startsWith('system_')).map(v => v.userId));
                    const nonVoters = Object.values(participantMap).filter(p => !votedIds.has(p.userId));
                    if (nonVoters.length === 0) return null;
                    return (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-amber-50">
                          <h3 className="font-extrabold text-amber-600 text-sm flex items-center gap-2">
                            <Users size={14} /> 미투표자 ({nonVoters.length}명)
                          </h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {nonVoters
                            .sort((a, b) => (a.slotNumber || 999) - (b.slotNumber || 999))
                            .map(p => (
                              <div key={p.userId} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${p.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                  {p.gender === 'male' ? '남' : '여'} {p.slotNumber}호
                                </span>
                                <span className="font-bold text-sm text-slate-800">{p.name}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 최종 승인 */}
                  {sessionStatus !== 'completed' && (
                    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
                      <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <h3 className="font-extrabold text-amber-600 mb-1 text-sm">최종 승인 전 꼭 확인하세요</h3>
                          <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                            승인 즉시 참가자들의 마이페이지에 매칭 결과가 공개됩니다.<br />
                            한 번 승인된 결과는 되돌릴 수 없습니다.
                          </p>
                          <button
                            onClick={approveResults}
                            disabled={approving}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-md shadow-amber-100"
                          >
                            <CheckCircle2 size={16} />
                            {approving ? '승인 처리 중...' : '매칭 결과 최종 승인 및 공개'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {sessionStatus === 'completed' && (
                    <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center">
                      <p className="text-emerald-700 font-extrabold text-sm flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} /> 최종 승인 완료 — 참가자 마이페이지에 공개됨
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
