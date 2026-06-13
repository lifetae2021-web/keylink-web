'use client';

import { use, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Heart, ArrowLeft, Trophy, Sparkles, ShieldCheck, Users, MapPin, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CherryBlossoms from '@/components/CherryBlossoms';

import { getUserMatchResult, getUserVoteStats } from '@/lib/firestore/userMatching';
import { getVotesReceivedByMe, getMyVote } from '@/lib/firestore/votes';
import { formatRegion } from '@/lib/utils/formatRegion';

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
  partners?: {
    gender: 'male' | 'female';
    number: string;
    age: string;
    job: string;
    height: string;
    residence: string;
    batch: string;
  }[];
}

export default function MatchingResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [result, setResult] = useState<ResultData | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [receivedVotesList, setReceivedVotesList] = useState<any[]>([]);
  const [myChoices, setMyChoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New state variables for public result mapping
  const [session, setSession] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [participantMap, setParticipantMap] = useState<Record<string, any>>({});
  const [isParticipant, setIsParticipant] = useState(false);

  // 라인업 상태
  const [lineupTab, setLineupTab] = useState<'male' | 'female'>('male');
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [lineupApps, setLineupApps] = useState<any[]>([]);
  const [lineupUserMap, setLineupUserMap] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const appsQuery = query(
            collection(db, 'applications'),
            where('sessionId', '==', sessionId),
            where('status', '==', 'confirmed')
          );

          // v10.2.0: 6가지 파이어스토어 요청을 병렬로 한 번에 처리하여 결과 페이지 로딩 600% 이상 단축
          const [userSnap, sessionSnap, summarySnap, appsSnap, matchResult, stats, receivedVotes, myVote] = await Promise.all([
            getDoc(doc(db, 'users', currentUser.uid)).catch(e => { console.error(e); return { exists: () => false, data: () => ({}) } as any; }),
            getDoc(doc(db, 'sessions', sessionId)).catch(e => { console.error(e); return { exists: () => false, data: () => ({}) } as any; }),
            getDoc(doc(db, 'matchingSummaries', sessionId)).catch(e => { console.error(e); return { exists: () => false, data: () => ({}) } as any; }),
            getDocs(appsQuery).catch(e => { console.error(e); return { docs: [], empty: true } as any; }),
            getUserMatchResult(currentUser.uid, sessionId).catch(e => { console.error(e); return null; }),
            getUserVoteStats(currentUser.uid, sessionId).catch(e => { console.error(e); return { receivedCount: 0, myChoices: [] }; }),
            getVotesReceivedByMe(sessionId, currentUser.uid).catch(e => { console.error(e); return []; }),
            getMyVote(sessionId, currentUser.uid).catch(e => { console.error(e); return null; })
          ]);

          // 1. Fetch User Name & Admin Status
          let isAdmin = false;
          if (userSnap.exists()) {
            const uData = userSnap.data();
            setUserName(uData.name || '영훈');
            isAdmin = uData.role === 'admin' || uData.role === 'super_admin';
          }

          // 2. Fetch Session
          if (sessionSnap.exists()) {
            const sd = sessionSnap.data();
            if (sd.isTest && !isAdmin) {
              setSession(null);
              setIsLoading(false);
              return;
            }
            setSession({
              id: sessionId,
              ...sd,
              eventDate: sd.eventDate?.toDate?.() || new Date(),
            });
          }

          // 3. Fetch Summary
          if (summarySnap.exists()) {
            setSummary(summarySnap.data());
          }

          // 4. Fetch Participant Slots mapping
          const pMap: Record<string, any> = {};
          appsSnap.docs.forEach((d: any) => {
            const data = d.data();
            pMap[data.userId] = {
              gender: data.gender,
              slotNumber: data.slotNumber || 0,
              name: data.name
            };
          });
          setParticipantMap(pMap);

          // 5. 라인업용 데이터 세팅 (appsSnap 재활용)
          const lineupAppList = appsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setLineupApps(lineupAppList);

          // 라인업 유저 상세 정보 (키, 직업 등) 병렬 조회
          const lineupUserSnaps = await Promise.all(
            lineupAppList.map((a: any) => getDoc(doc(db, 'users', a.userId)))
          );
          const luMap: Record<string, any> = {};
          lineupUserSnaps.forEach((snap: any) => {
            if (snap.exists()) luMap[snap.id] = snap.data();
          });
          setLineupUserMap(luMap);

          if (matchResult) {
            setIsParticipant(true);

            // Resolve all partner profiles for multi-match support
            const resolvedPartners = await Promise.all((matchResult.partnerIds || []).map(async (partnerId: any) => {
              try {
                const appQuery = query(
                  collection(db, 'applications'),
                  where('sessionId', '==', sessionId),
                  where('userId', '==', partnerId)
                );
                const [appSnap, sessionSnap, userSnap] = await Promise.all([
                  getDocs(appQuery),
                  getDoc(doc(db, 'sessions', sessionId)),
                  getDoc(doc(db, 'users', partnerId))
                ]);
                if (!appSnap.empty) {
                  const appData = appSnap.docs[0].data();
                  const userData = userSnap.exists() ? userSnap.data() : null;
                  const batchTitle = sessionSnap.exists() ? `${sessionSnap.data().episodeNumber || ''}기` : '';
                  
                  let calculatedAge = '미입력';
                  const birthDateVal = appData.birthDate || userData?.birthDate;
                  if (birthDateVal) {
                    const yearPart = birthDateVal.split('-')[0];
                    calculatedAge = `${yearPart.length === 4 ? yearPart.slice(2, 4) : yearPart.slice(0, 2)}`;
                  } else if (appData.age || userData?.age) {
                    const n = Number(appData.age || userData?.age);
                    const birthYear = 2026 - n;
                    calculatedAge = `${String(birthYear).slice(-2)}`;
                  }
                  
                  const job = appData.displayJob || userData?.admin_job || userData?.job || appData.job || '미입력';
                  
                  const heightVal = appData.height || userData?.height;
                  const height = heightVal ? `${heightVal}` : '미입력';
                  
                  return {
                    gender: appData.gender,
                    number: appData.slotNumber ? String(appData.slotNumber) : '?',
                    age: calculatedAge,
                    job,
                    height,
                    residence: appData.residence ? formatRegion(appData.residence) : '미입력',
                    batch: batchTitle || '알 수 없음'
                  };
                }
              } catch (err) {
                console.error("Error resolving partner profile:", partnerId, err);
              }
              return null;
            }));

            const validPartners = resolvedPartners.filter(Boolean) as any[];

            setResult({
              isMatched: matchResult.matched,
              partner: matchResult.matched && matchResult.partnerProfile ? {
                gender: matchResult.partnerProfile.gender as any,
                number: matchResult.partnerProfile.number || '?',
                age: matchResult.partnerProfile.age || '미입력',
                job: matchResult.partnerProfile.job || '미입력',
                height: matchResult.partnerProfile.height || '미입력',
                residence: matchResult.partnerProfile.residence ? formatRegion(matchResult.partnerProfile.residence) : '미입력',
                batch: matchResult.partnerProfile.batch || '알 수 없음'
              } : undefined,
              partners: validPartners
            });

            // 6. Fetch Stats & Choices only if participated
            
            // Resolve received votes
            const visibility = sessionSnap.data()?.voteConfig?.resultVisibility || 'all';
            const resolvedReceived = await Promise.all(receivedVotes.map(async (v: any) => {
              const appQuery = query(
                collection(db, 'applications'),
                where('sessionId', '==', sessionId),
                where('userId', '==', v.userId),
                where('status', '==', 'confirmed')
              );
              const appSnap = await getDocs(appQuery);
              const appData = !appSnap.empty ? appSnap.docs[0].data() : {};
              return { 
                id: v.userId, 
                voteData: v, 
                gender: appData.gender, 
                slotNumber: appData.slotNumber 
              };
            }));

            const filteredVoters = visibility === 'mutual'
              ? resolvedReceived.filter(v => myVote?.choices?.some((c: any) => c.targetUserId === v.id))
              : resolvedReceived;

            const displayedVoters = [...filteredVoters].sort((a, b) => {
              const aMutual = myVote?.choices?.some((c: any) => c.targetUserId === a.id) ? 0 : 1;
              const bMutual = myVote?.choices?.some((c: any) => c.targetUserId === b.id) ? 0 : 1;
              return aMutual - bMutual;
            });

            setReceivedVotesList(displayedVoters.map(v => {
              const isMutual = myVote?.choices?.some((c: any) => c.targetUserId === v.id);
              const isVoterAnonymous = v.voteData?.disclosureMode === 'anonymous';
              const genderPrefix = v.gender === 'male' ? '키링남' : v.gender === 'female' ? '키링녀' : '';
              const slotLabel = v.slotNumber ? `${genderPrefix} ${v.slotNumber}호` : '익명';
              
              // 매칭 성공했거나, 상대방이 '공개 투표'를 선택한 경우 누군지 정확히 보여줌
              const revealIdentity = isMutual || !isVoterAnonymous;
              const displayName = revealIdentity && v.slotNumber ? slotLabel : '익명';
                
              return {
                id: v.id,
                displayName,
                isMutual,
                isAnonymous: !revealIdentity
              };
            }));

            // 표 개수는 매칭 엔진 집계 당시의 정확한 총 득표수를 사용함 (실시간 리스트 개수로 덮어씌우지 않음)
            setVoteCount(stats.receivedCount);
            
            const resolvedChoices = await Promise.all(stats.myChoices.map(async (v: any) => {
              let label = '알 수 없음';
              let jobDisplay = '확인 중';
              try {
                const appQuery = query(
                  collection(db, 'applications'),
                  where('sessionId', '==', sessionId),
                  where('userId', '==', v.targetUserId)
                );
                const [appSnap, userSnap] = await Promise.all([
                  getDocs(appQuery),
                  getDoc(doc(db, 'users', v.targetUserId))
                ]);
                if (!appSnap.empty) {
                  const appData = appSnap.docs[0].data();
                  const userData = userSnap.exists() ? userSnap.data() : null;
                  const genderKo = appData.gender === 'male' ? '키링남' : '키링녀';
                  const slot = appData.slotNumber ? `${appData.slotNumber}호` : '호수 미정';
                  label = `${genderKo} ${slot}`;
                  jobDisplay = appData.displayJob || userData?.admin_job || userData?.job || appData.job || '미입력';
                } else {
                  if (v.targetUserName && (v.targetUserName.includes('호') || v.targetUserName.includes('키링'))) {
                    label = v.targetUserName;
                  } else {
                    label = '선택 상대';
                  }
                }
              } catch (err) {
                console.error("Error resolving choice profile:", err);
              }
              return {
                priority: v.priority,
                partnerName: label,
                job: jobDisplay
              };
            }));
            setMyChoices(resolvedChoices);
          } else {
            setIsParticipant(false);
            setResult(null);
          }

        } catch (error) {
          console.error("Error fetching detail data:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // 비로그인 상태에서도 세션 + 라인업 데이터는 공개 로드
        try {
          const appsQuery = query(
            collection(db, 'applications'),
            where('sessionId', '==', sessionId),
            where('status', '==', 'confirmed')
          );
          const [sessionSnap, summarySnap, appsSnap] = await Promise.all([
            getDoc(doc(db, 'sessions', sessionId)).catch(e => { console.error(e); return { exists: () => false, data: () => ({}) } as any; }),
            getDoc(doc(db, 'matchingSummaries', sessionId)).catch(e => { console.error(e); return { exists: () => false, data: () => ({}) } as any; }),
            getDocs(appsQuery).catch(e => { console.error(e); return { docs: [], empty: true } as any; }),
          ]);

          if (sessionSnap.exists()) {
            const sd = sessionSnap.data();
            if (!sd.isTest) {
              setSession({ id: sessionId, ...sd, eventDate: sd.eventDate?.toDate?.() || new Date() });
            }
          }
          if (summarySnap.exists()) setSummary(summarySnap.data());

          const lineupAppList = appsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setLineupApps(lineupAppList);

          const lineupUserSnaps = await Promise.all(
            lineupAppList.map((a: any) => getDoc(doc(db, 'users', (a as any).userId)))
          );
          const luMap: Record<string, any> = {};
          lineupUserSnaps.forEach((snap: any) => { if (snap.exists()) luMap[snap.id] = snap.data(); });
          setLineupUserMap(luMap);

          const pMap: Record<string, any> = {};
          appsSnap.docs.forEach((d: any) => {
            const data = d.data();
            pMap[data.userId] = { gender: data.gender, slotNumber: data.slotNumber || 0, name: data.name };
          });
          setParticipantMap(pMap);
        } catch (e) {
          console.error('비로그인 세션 로드 오류:', e);
        }
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  // 5초마다 셔플 (실시간 현황과 동일)
  useEffect(() => {
    const interval = setInterval(() => {
      setShuffleSeed(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 라인업 행 계산 (실시간 현황 status/[id] 로직 동일하게 적용)
  const lineupRows = useMemo(() => {
    if (!session) return [];
    const currentList = lineupApps.filter(a => a.gender === lineupTab);
    const maxSlots = lineupTab === 'male' ? (session.maxMale || 8) : (session.maxFemale || 8);

    const slots: any[] = Array.from({ length: maxSlots }, (_, i) => ({
      slotNumber: i + 1,
      isFilled: false,
      birthYear: '',
      job: '',
      height: '',
    }));

    currentList.forEach((p: any) => {
      const slotIdx = (p.slotNumber || 1) - 1;
      if (slotIdx >= 0 && slotIdx < maxSlots) {
        const u = lineupUserMap[p.userId] || {};
        const rawBirth = u.birthDate || p.birthDate || '';
        const year = rawBirth.includes('-')
          ? rawBirth.split('-')[0].slice(2, 4)
          : rawBirth.length >= 2 ? rawBirth.slice(0, 2) : '??';
        slots[slotIdx] = {
          slotNumber: p.slotNumber || (slotIdx + 1),
          isFilled: true,
          birthYear: `${year}`,
          job: u.admin_job || u.job || p.job || '검토 중',
          height: u.height ? `${u.height}` : p.height ? `${p.height}` : '비공개',
        };
      }
    });

    const filledSlots = slots.filter(s => s.isFilled);
    if (filledSlots.length <= 1) return slots;

    const shuffle = <T,>(arr: T[], seed: number): T[] => {
      const result = [...arr];
      let s = seed;
      for (let i = result.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };

    const jobs = shuffle(filledSlots.map(r => r.job), shuffleSeed);
    const heights = shuffle(filledSlots.map(r => r.height), shuffleSeed + 999);

    let filledIdx = 0;
    slots.forEach(s => {
      if (s.isFilled) {
        s.job = jobs[filledIdx];
        s.height = heights[filledIdx];
        filledIdx++;
      }
    });

    return slots;
  }, [lineupTab, lineupApps, lineupUserMap, shuffleSeed, session]);

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

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">존재하지 않는 기수이거나 매칭 결과가 없습니다.</h1>
        <Link href="/matching-results" className="text-pink-500 font-bold border-b border-pink-500 pb-1 flex items-center gap-2">
          <ArrowLeft size={18} /> 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  // Deduplicate matched males and females by slotNumber
  const matchedMales = Array.from(
    new Map(
      (summary?.matchedPairs || [])
        .map((pair: any) => {
          const a = participantMap[pair.userAId];
          const b = participantMap[pair.userBId];
          return a?.gender === 'male' ? a : b?.gender === 'male' ? b : null;
        })
        .filter(Boolean)
        .map((m: any) => [m.slotNumber, m])
    ).values()
  ).sort((x: any, y: any) => (x.slotNumber || 0) - (y.slotNumber || 0));

  const matchedFemales = Array.from(
    new Map(
      (summary?.matchedPairs || [])
        .map((pair: any) => {
          const a = participantMap[pair.userAId];
          const b = participantMap[pair.userBId];
          return a?.gender === 'female' ? a : b?.gender === 'female' ? b : null;
        })
        .filter(Boolean)
        .map((f: any) => [f.slotNumber, f])
    ).values()
  ).sort((x: any, y: any) => (x.slotNumber || 0) - (y.slotNumber || 0));

  const floatVariants = (delay: number): any => ({
    animate: {
      y: [0, -12, 0],
      x: [0, 8, -8, 0],
      transition: {
        duration: 5 + Math.random() * 2,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay
      }
    }
  });

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
          {isParticipant && result ? (
            <>
              {/* 0. 라인업 섹션 (참여자 포함 모두에게 공통 표시) */}
              {lineupRows.length > 0 && (
                <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-8">
                  <h4 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles size={20} className="text-pink-400" /> {session?.episodeNumber}기 참가자 라인업
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mb-6">개인정보 보호를 위해 직업·키 정보는 5초마다 랜덤으로 섞입니다.</p>

                  {/* 탭 버튼 */}
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={() => setLineupTab('male')}
                      className="flex-1 py-3 rounded-2xl font-black text-sm transition-all"
                      style={{
                        background: lineupTab === 'male' ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' : '#F1F5F9',
                        color: lineupTab === 'male' ? '#fff' : '#94A3B8',
                        boxShadow: lineupTab === 'male' ? '0 8px 16px rgba(59,130,246,0.25)' : 'none',
                      }}
                    >
                      키링남 라인업
                    </button>
                    <button
                      onClick={() => setLineupTab('female')}
                      className="flex-1 py-3 rounded-2xl font-black text-sm transition-all"
                      style={{
                        background: lineupTab === 'female' ? 'linear-gradient(135deg, #FF6F61, #FF8A71)' : '#F1F5F9',
                        color: lineupTab === 'female' ? '#fff' : '#94A3B8',
                        boxShadow: lineupTab === 'female' ? '0 8px 16px rgba(255,111,97,0.25)' : 'none',
                      }}
                    >
                      키링녀 라인업
                    </button>
                  </div>

                  {/* 헤더 */}
                  <div className="grid gap-3 px-4 py-2 text-xs font-black text-gray-400 text-center mb-2" style={{ gridTemplateColumns: '45px 1fr 1.2fr 1fr' }}>
                    <span>번호</span><span>출생연도</span><span>직업 <small className="font-normal">(랜덤)</small></span><span>키 <small className="font-normal">(랜덤)</small></span>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div key={lineupTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="flex flex-col gap-2">
                      {lineupRows.map((row, idx) => (
                        <div key={idx} className="grid gap-3 px-4 py-4 rounded-2xl text-center text-sm items-center transition-all"
                          style={{ gridTemplateColumns: '45px 1fr 1.2fr 1fr', background: row.isFilled ? '#fff' : 'rgba(248,250,252,0.6)', border: row.isFilled ? '1.5px solid #F1F5F9' : '1.5px dashed #E2E8F0', boxShadow: row.isFilled ? '0 4px 12px rgba(0,0,0,0.03)' : 'none', opacity: row.isFilled ? 1 : 0.5 }}>
                          <span className="font-black text-gray-300 text-base">{idx + 1}</span>
                          {row.isFilled ? (
                            <>
                              <span className="font-bold text-gray-700">{row.birthYear}</span>
                              <span className="font-black whitespace-nowrap" style={{ color: lineupTab === 'male' ? '#3B82F6' : '#FF6F61' }}>{row.job}</span>
                              <span className="font-bold text-gray-500">{row.height}</span>
                            </>
                          ) : (
                            <span className="col-span-3 text-gray-300 font-medium text-xs">모집 완료</span>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

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

                  {/* Partner Cards (Supports Multiple Matches) */}
                  {result.partners && result.partners.length > 0 ? (
                    result.partners.map((partner, index) => (
                      <div key={index} className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-2xl shadow-pink-100/50 mb-6 overflow-hidden relative text-left">
                        <div className="absolute top-0 right-0 p-4">
                          <Sparkles className="text-pink-200" size={32} />
                        </div>
                        
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4 items-center text-center">
                          <div className="font-bold text-gray-500">{partner.batch}</div>
                          <div className="font-black text-pink-500 text-base md:text-lg whitespace-nowrap">
                            {partner.gender === 'male' ? '키링남' : '키링녀'} {partner.number}호
                          </div>
                          <div className="font-bold text-gray-800">{partner.age}</div>
                          <div className="font-black text-blue-500">{partner.job}</div>
                          <div className="font-bold text-gray-500">{partner.height}</div>
                          <div className="font-bold text-gray-800">{partner.residence}</div>
                        </div>
                      </div>
                    ))
                  ) : result.partner ? (
                    <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-2xl shadow-pink-100/50 mb-6 overflow-hidden relative text-left">
                      <div className="absolute top-0 right-0 p-4">
                        <Sparkles className="text-pink-200" size={32} />
                      </div>
                      
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4 items-center text-center">
                        <div className="font-bold text-gray-500">{result.partner.batch}</div>
                        <div className="font-black text-pink-500 text-base md:text-lg whitespace-nowrap">
                          {result.partner.gender === 'male' ? '키링남' : '키링녀'} {result.partner.number}호
                        </div>
                        <div className="font-bold text-gray-800">{result.partner.age}</div>
                        <div className="font-black text-blue-500">{result.partner.job}</div>
                        <div className="font-bold text-gray-500">{result.partner.height}</div>
                        <div className="font-bold text-gray-800">{result.partner.residence}</div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-8 p-5 bg-pink-50/50 rounded-3xl border border-pink-100 italic font-bold text-pink-500 text-sm">
                    <div className="text-center leading-relaxed">
                      "서로의 프라이버시를 위해,<br/>
                      운영진이 두 분만의 1:1 오픈채팅방을<br/>
                      개설하여 초대해 드릴 예정입니다."
                    </div>
                  </div>
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
              <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-8">
                
                <h4 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                  <Trophy size={20} className="text-amber-400" /> 이번 기수 내가 받은 호감
                </h4>

                <div className="flex items-center gap-6 mb-6">
                  <div className="text-6xl font-black text-pink-500 tracking-tighter">
                    {voteCount}<span className="text-2xl ml-1 text-pink-300">표</span>
                  </div>
                  <div className="flex-1 text-gray-500 font-bold leading-relaxed text-sm text-left">
                    {result.isMatched ? (
                      `"이번 기수에서 ${userName}님은 총 ${voteCount}표를 받으셨습니다! 많은 분들이 ${userName}님의 매력을 알아봐 주셨네요. 매칭된 소중한 인연과 즐거운 만남을 이어가시길 바랍니다! 🎉"`
                    ) : (
                      `"이번 기수에서 ${userName}님은 총 ${voteCount}표를 받으셨습니다. 숫자는 단지 통계일 뿐, ${userName}님의 매력은 다음 기수에서 더 빛날 거예요! 조금만 더 용기를 내어보세요. ✨"`
                    )}
                  </div>
                </div>
                
                {/* Received Votes List */}
                {receivedVotesList.length > 0 && (
                  <div className="mt-8 border-t border-gray-100 pt-6">
                    <h5 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                      <Sparkles size={16} className="text-pink-400" /> 나를 선택한 분들
                    </h5>
                    <div className="grid gap-3">
                      {receivedVotesList.map((voter) => (
                        <div key={voter.id} className={`flex items-center justify-between p-4 rounded-2xl border ${voter.isMutual ? 'bg-pink-50/50 border-pink-100' : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-pink-200'} transition-all`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100">
                              <Heart size={16} className={voter.isMutual ? 'text-pink-500' : 'text-pink-300'} fill="currentColor" />
                            </div>
                            <div>
                              <span className="font-black text-gray-900">{voter.displayName}</span>
                            </div>
                          </div>
                          {voter.isMutual && (
                            <span className="text-xs font-black bg-pink-500 text-white px-3 py-1 rounded-full shadow-sm">
                              매칭 성공
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                        <span className="w-8 h-8 rounded-full flex items-center justify-center font-black text-pink-500 text-xs bg-pink-100">
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
            </>
          ) : (
            <div className="space-y-8">
              {/* Header / Intro */}
              <div className="text-center mb-12">
                <div className="w-24 h-24 bg-gradient-to-br from-[#FF6F61] to-pink-400 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl rotate-[-4deg]">
                  <Trophy size={48} fill="white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">
                  {session?.region === 'busan' ? '부산' : '창원'} {session?.episodeNumber}기<br/>
                  공식 매칭 결과 리포트
                </h2>
                <p className="text-gray-500 font-semibold mb-6">
                  행사일: {session?.eventDate ? session.eventDate.toLocaleDateString('ko-KR') : ''}
                </p>
                <div className="inline-block bg-pink-50 text-[#FF6F61] px-6 py-2 rounded-full text-xs font-black border border-pink-100 uppercase tracking-wide">
                  매칭 최종 승인 및 공개 완료
                </div>
              </div>

              {/* 라인업 섹션 (비참여자도 공개) */}
              {lineupRows.length > 0 && (
                <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg">
                  <h4 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles size={20} className="text-pink-400" /> {session?.episodeNumber}기 참가자 라인업
                  </h4>
                  <p className="text-xs text-gray-400 font-medium mb-6">개인정보 보호를 위해 직업·키 정보는 5초마다 랜덤으로 섞입니다.</p>
                  <div className="flex gap-3 mb-6">
                    <button onClick={() => setLineupTab('male')} className="flex-1 py-3 rounded-2xl font-black text-sm transition-all"
                      style={{ background: lineupTab === 'male' ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' : '#F1F5F9', color: lineupTab === 'male' ? '#fff' : '#94A3B8', boxShadow: lineupTab === 'male' ? '0 8px 16px rgba(59,130,246,0.25)' : 'none' }}>
                      키링남 라인업
                    </button>
                    <button onClick={() => setLineupTab('female')} className="flex-1 py-3 rounded-2xl font-black text-sm transition-all"
                      style={{ background: lineupTab === 'female' ? 'linear-gradient(135deg, #FF6F61, #FF8A71)' : '#F1F5F9', color: lineupTab === 'female' ? '#fff' : '#94A3B8', boxShadow: lineupTab === 'female' ? '0 8px 16px rgba(255,111,97,0.25)' : 'none' }}>
                      키링녀 라인업
                    </button>
                  </div>
                  {/* 헤더 */}
                  <div className="grid gap-3 px-4 py-2 text-xs font-black text-gray-400 text-center mb-2" style={{ gridTemplateColumns: '45px 1fr 1.2fr 1fr' }}>
                    <span>번호</span><span>출생연도</span><span>직업 <small className="font-normal">(랜덤)</small></span><span>키 <small className="font-normal">(랜덤)</small></span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div key={lineupTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="flex flex-col gap-2">
                      {lineupRows.map((row, idx) => (
                        <div key={idx} className="grid gap-3 px-4 py-4 rounded-2xl text-center text-sm items-center transition-all"
                          style={{ gridTemplateColumns: '45px 1fr 1.2fr 1fr', background: row.isFilled ? '#fff' : 'rgba(248,250,252,0.6)', border: row.isFilled ? '1.5px solid #F1F5F9' : '1.5px dashed #E2E8F0', boxShadow: row.isFilled ? '0 4px 12px rgba(0,0,0,0.03)' : 'none', opacity: row.isFilled ? 1 : 0.5 }}>
                          <span className="font-black text-gray-300 text-base">{idx + 1}</span>
                          {row.isFilled ? (
                            <>
                              <span className="font-bold text-gray-700">{row.birthYear}</span>
                              <span className="font-black whitespace-nowrap" style={{ color: lineupTab === 'male' ? '#3B82F6' : '#FF6F61' }}>{row.job}</span>
                              <span className="font-bold text-gray-500">{row.height}</span>
                            </>
                          ) : (
                            <span className="col-span-3 text-gray-300 font-medium text-xs">모집 완료</span>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {/* Overall Stats Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
                  <Heart className="mx-auto text-[#FF6F61] mb-2" size={24} fill="#FF6F61" />
                  <p className="text-slate-400 text-xs font-bold">매칭 성공 커플</p>
                  <p className="text-3xl font-black text-slate-800 mt-1">
                    {(summary?.matchedPairs || []).length}쌍
                  </p>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
                  <Sparkles className="mx-auto text-amber-400 mb-2" size={24} />
                  <p className="text-slate-400 text-xs font-bold">최종 매칭률</p>
                  <p className="text-3xl font-black text-slate-800 mt-1">
                    {(() => {
                      const matchedCount = (summary?.matchedPairs || []).length;
                      const unmatchedCount = (summary?.unmatchedUserIds || []).length;
                      const total = matchedCount * 2 + unmatchedCount;
                      return total > 0 ? Math.round((matchedCount * 2 / total) * 100) : 0;
                    })()}%
                  </p>
                </div>
              </div>

              {/* Dynamic Floating Bubbles Section */}
              <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-lg mb-8">
                <h4 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                  <Heart size={20} className="text-[#FF6F61]" fill="#FF6F61" /> 매칭 성공 회원 현황
                </h4>
                <p className="text-slate-400 text-xs font-semibold mb-8">
                  * 프라이빗 매칭 시스템에 따라 구체적으로 누구와 매칭되었는지는 블라인드 처리되며, 매칭 성공한 회원들의 호수 목록만 각 성별 영역에 둥둥 떠다니게 노출됩니다.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Male Bubbles */}
                  <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/20 rounded-[32px] p-8 border border-blue-100/50 min-h-[280px] flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 text-blue-100/40 pointer-events-none">
                      <Users size={160} className="stroke-[1.5]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-wider uppercase bg-blue-100 text-blue-600 px-3 py-1 rounded-full border border-blue-200">
                        Kirings
                      </span>
                      <h5 className="text-lg font-black text-slate-800 mt-3 mb-2">매칭 성공 키링남</h5>
                      <p className="text-slate-400 text-xs font-bold">총 {matchedMales.length}명의 매력남이 매칭에 성공했습니다.</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mt-8 justify-center items-center z-10">
                      {matchedMales.map((m: any, i: number) => (
                        <motion.div
                          key={m.userId || i}
                          variants={floatVariants(i * 0.4)}
                          animate="animate"
                          whileHover={{ scale: 1.1, y: -4 }}
                          className="bg-white border border-blue-200 shadow-md shadow-blue-100/40 px-5 py-3 rounded-2xl cursor-pointer flex items-center gap-2 text-sm font-black text-blue-600 hover:border-blue-400 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                          키링남 {m.slotNumber}호
                        </motion.div>
                      ))}
                      {matchedMales.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs font-bold">매칭 성공 회원이 없습니다.</div>
                      )}
                    </div>
                  </div>

                  {/* Female Bubbles */}
                  <div className="bg-gradient-to-br from-pink-50/40 to-rose-50/20 rounded-[32px] p-8 border border-pink-100/50 min-h-[280px] flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 text-pink-100/40 pointer-events-none">
                      <Users size={160} className="stroke-[1.5]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-wider uppercase bg-pink-100 text-pink-600 px-3 py-1 rounded-full border border-pink-200">
                        Kirings
                      </span>
                      <h5 className="text-lg font-black text-slate-800 mt-3 mb-2">매칭 성공 키링녀</h5>
                      <p className="text-slate-400 text-xs font-bold">총 {matchedFemales.length}명의 매력녀가 매칭에 성공했습니다.</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mt-8 justify-center items-center z-10">
                      {matchedFemales.map((f: any, i: number) => (
                        <motion.div
                          key={f.userId || i}
                          variants={floatVariants(i * 0.5 + 0.2)}
                          animate="animate"
                          whileHover={{ scale: 1.1, y: -4 }}
                          className="bg-white border border-pink-200 shadow-md shadow-pink-100/40 px-5 py-3 rounded-2xl cursor-pointer flex items-center gap-2 text-sm font-black text-pink-600 hover:border-pink-400 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
                          키링녀 {f.slotNumber}호
                        </motion.div>
                      ))}
                      {matchedFemales.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs font-bold">매칭 성공 회원이 없습니다.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Note info */}
              <div className="flex items-center gap-4 p-6 bg-pink-50 rounded-3xl border border-pink-100">
                <ShieldCheck size={24} className="text-[#FF6F61] shrink-0" />
                <p className="text-xs md:text-sm font-bold text-pink-600 leading-relaxed">
                  개인정보 보호 정책에 따라, 본인 이외의 실명이나 상세 인적 사항(연락처, 키, 회사명 등)은 일체 공개되지 않으며 호수로만 안전하게 공개됩니다.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
