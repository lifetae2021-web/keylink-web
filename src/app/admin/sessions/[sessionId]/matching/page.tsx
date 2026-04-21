'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getSession } from '@/lib/firestore/sessions';
import { getAllVotesBySession } from '@/lib/firestore/votes';
import { getApplicationsByStatus } from '@/lib/firestore/applications';
import { Session, Vote, Application, MatchingAlgorithmResult, MatchPair } from '@/lib/types';
import { ArrowLeft, Play, CheckCircle2, AlertCircle, Heart, UserX, Trophy } from 'lucide-react';
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

      // 참가 확정자 목록 로드 (이름 표시용)
      const confirmed = await getApplicationsByStatus(sessionId, 'confirmed');
      const map: Record<string, Application> = {};
      confirmed.forEach(a => { map[a.userId] = a; });
      setParticipantMap(map);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ─── 매칭 알고리즘 실행 ───
  const runAlgorithm = async () => {
    if (!confirm('매칭 알고리즘을 실행하시겠습니까? 기존 결과가 덮어씌워집니다.')) return;
    setRunning(true);
    try {
      // 1. 모든 투표 데이터 가져오기
      const votes = await getAllVotesBySession(sessionId);
      if (votes.length === 0) {
        toast.error('투표 데이터가 없습니다. 투표가 완료된 후 실행해 주세요.');
        return;
      }

      // 2. userId → 선택한 targetUserIds 맵 생성
      const choiceMap: Record<string, Set<string>> = {};
      const voteCountMap: Record<string, number> = {};

      votes.forEach(vote => {
        choiceMap[vote.userId] = new Set(vote.choices.map(c => c.targetUserId));
        vote.choices.forEach(c => {
          voteCountMap[c.targetUserId] = (voteCountMap[c.targetUserId] || 0) + 1;
        });
      });

      // 3. 상호 선택 매칭 알고리즘
      const matched = new Set<string>();
      const matchedPairs: MatchPair[] = [];

      votes.forEach(voteA => {
        if (matched.has(voteA.userId)) return;
        const aChoices = choiceMap[voteA.userId] || new Set();
        
        for (const targetId of aChoices) {
          if (matched.has(targetId)) continue;
          const bChoices = choiceMap[targetId] || new Set();
          
          // 상호 선택 확인: A가 B를 선택 AND B가 A를 선택
          if (bChoices.has(voteA.userId)) {
            matchedPairs.push({ userAId: voteA.userId, userBId: targetId });
            matched.add(voteA.userId);
            matched.add(targetId);
            break; // A는 첫 번째 상호 매칭 상대와만 매칭
          }
        }
      });

      const unmatchedUserIds = votes
        .map(v => v.userId)
        .filter(uid => !matched.has(uid));

      const algorithmResult: MatchingAlgorithmResult = {
        sessionId,
        matchedPairs,
        unmatchedUserIds,
        voteCountMap,
        calculatedAt: new Date(),
      };

      // 4. matchingResults 컬렉션에 임시 저장 (status: 'pending')
      const batch: { id: string; userId: string; partnerId: string | null; matched: boolean }[] = [
        ...matchedPairs.flatMap(pair => [
          { id: `${sessionId}_${pair.userAId}`, userId: pair.userAId, partnerId: pair.userBId, matched: true },
          { id: `${sessionId}_${pair.userBId}`, userId: pair.userBId, partnerId: pair.userAId, matched: true },
        ]),
        ...unmatchedUserIds.map(uid => ({
          id: `${sessionId}_${uid}`, userId: uid, partnerId: null, matched: false,
        })),
      ];

      await Promise.all(batch.map(entry =>
        setDoc(doc(db, 'matchingResults', entry.id), {
          sessionId,
          userId: entry.userId,
          matched: entry.matched,
          partnerId: entry.partnerId,
          receivedVotes: voteCountMap[entry.userId] || 0,
          status: 'pending',
          approvedAt: null,
        })
      ));

      setResult(algorithmResult);
      toast.success(`매칭 완료! ${matchedPairs.length}쌍 성공, ${unmatchedUserIds.length}명 미매칭`);
    } catch (e: any) {
      console.error(e);
      toast.error('알고리즘 실행 중 오류: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  // ─── 최종 승인 ───
  const approveResults = async () => {
    if (!result) return;
    if (!confirm('매칭 결과를 최종 승인하시겠습니까? 참가자들의 마이페이지에 즉시 공개됩니다.')) return;
    setApproving(true);
    try {
      // 모든 matchingResult의 status → 'approved'
      const allIds = [
        ...result.matchedPairs.flatMap(p => [
          `${sessionId}_${p.userAId}`,
          `${sessionId}_${p.userBId}`,
        ]),
        ...result.unmatchedUserIds.map(uid => `${sessionId}_${uid}`),
      ];

      await Promise.all(allIds.map(id =>
        updateDoc(doc(db, 'matchingResults', id), {
          status: 'approved',
          approvedAt: Timestamp.now(),
        })
      ));

      // 세션 상태를 'completed'로 변경
      await updateDoc(doc(db, 'sessions', sessionId), { status: 'completed' });

      toast.success('✅ 최종 승인 완료! 참가자 마이페이지에 결과가 공개되었습니다.');
      setSession(prev => prev ? { ...prev, status: 'completed' } : prev);
    } catch (e: any) {
      toast.error('승인 중 오류: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/admin/sessions/${sessionId}/applicants`} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-black">매칭 엔진 — {session?.title || sessionId}</h1>
            <p className="text-gray-400 text-sm mt-1">상태: {session?.status} | 행사일: {session?.eventDate.toLocaleDateString('ko-KR')}</p>
          </div>
        </div>

        {/* 알고리즘 실행 카드 */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 mb-6">
          <h2 className="text-lg font-black mb-2">매칭 알고리즘 실행</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            투표 데이터를 기반으로 <strong className="text-white">상호 선택 (어느 순위든 서로 선택)</strong> 방식으로 매칭 쌍을 계산합니다.<br />
            결과는 '대기(pending)' 상태로 저장되며, 검토 후 최종 승인 시 참가자에게 공개됩니다.
          </p>
          <button
            onClick={runAlgorithm}
            disabled={running || session?.status === 'completed'}
            className="flex items-center gap-3 px-8 py-4 bg-pink-600 hover:bg-pink-500 rounded-2xl font-black text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={22} fill="white" />
            {running ? '알고리즘 실행 중...' : '매칭 알고리즘 실행'}
          </button>
          {session?.status === 'completed' && (
            <p className="mt-3 text-green-400 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} /> 이 기수는 이미 최종 승인되었습니다.
            </p>
          )}
        </div>

        {/* 결과 미리보기 */}
        {result && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: '매칭 성공 쌍', value: result.matchedPairs.length, icon: <Heart size={24} className="text-pink-400" />, color: '#EC4899' },
                { label: '미매칭', value: result.unmatchedUserIds.length, icon: <UserX size={24} className="text-gray-400" />, color: '#9CA3AF' },
                { label: '총 투표 참여자', value: result.matchedPairs.length * 2 + result.unmatchedUserIds.length, icon: <Trophy size={24} className="text-amber-400" />, color: '#F59E0B' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-center">
                  <div className="flex justify-center mb-3">{icon}</div>
                  <p className="text-3xl font-black" style={{ color }}>{value}</p>
                  <p className="text-gray-400 text-xs font-semibold mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* 매칭 쌍 목록 */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 mb-6 overflow-hidden">
              <div className="p-5 border-b border-gray-800">
                <h3 className="font-black text-pink-400">💕 매칭 성공 ({result.matchedPairs.length}쌍)</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {result.matchedPairs.map((pair, i) => {
                  const a = participantMap[pair.userAId];
                  const b = participantMap[pair.userBId];
                  return (
                    <div key={i} className="p-4 flex items-center justify-between">
                      <span className="font-bold text-sm">{a?.name || pair.userAId} ({a?.gender === 'male' ? '남' : '여'})</span>
                      <Heart size={16} className="text-pink-400 mx-4" fill="currentColor" />
                      <span className="font-bold text-sm">{b?.name || pair.userBId} ({b?.gender === 'male' ? '남' : '여'})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 최종 승인 버튼 */}
            <div className="bg-gray-900 rounded-2xl p-8 border border-amber-500/30">
              <div className="flex items-start gap-4">
                <AlertCircle size={24} className="text-amber-400 mt-1 shrink-0" />
                <div>
                  <h3 className="font-black text-amber-400 mb-2">최종 승인 전 꼭 확인하세요</h3>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    승인 즉시 참가자들의 마이페이지에 매칭 결과가 공개됩니다.<br />
                    한 번 승인된 결과는 되돌릴 수 없습니다.
                  </p>
                  <button
                    onClick={approveResults}
                    disabled={approving}
                    className="flex items-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-2xl font-black transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={20} />
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
