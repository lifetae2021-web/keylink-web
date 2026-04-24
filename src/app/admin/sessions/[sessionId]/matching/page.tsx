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

  // ─── 매칭 알고리즘 실행 (서버사이드 호출) ───
  const runAlgorithm = async () => {
    if (!confirm('매칭 알고리즘을 실행하시겠습니까? 기존 결과가 덮어씌워집니다.')) return;
    
    const user = auth.currentUser;
    if (!user) {
      toast.error('인증 세션이 만료되었습니다. 다시 로그인해 주세요.');
      return;
    }

    setRunning(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/sessions/${sessionId}/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '매칭 연산 중 오류가 발생했습니다.');
      }

      setResult(data.result);
      toast.success(`매칭 완료! ${data.stats.coupleCount}쌍 성공, ${data.stats.unmatchedCount}명 미매칭`);
      
      // 데이터 리로드 (승인 버튼 활성화를 위해)
      loadData();
    } catch (e: any) {
      console.error('Matching API Error:', e);
      toast.error(e.message || '알고리즘 실행 중 오류가 발생했습니다.');
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
          <Link href={`/admin/applications`} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
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
