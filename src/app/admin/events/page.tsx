"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  MapPin,
  Users,
  Heart,
  Banknote,
  Plus,
  Edit2,
  Trash2,
  Play,
  X,
  CheckCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Zap,
  BarChart3,
  Loader2,
  ListChecks,
  Phone,
  UserCheck,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Trophy,
  UserX,
  StickyNote,
  Pencil,
  StopCircle,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  addDoc,
  serverTimestamp,
  where,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import toast from "react-hot-toast";
import {
  Session,
  SessionStatus,
  MatchingResult,
  Application,
  Vote,
} from "@/lib/types";
import Link from "next/link";
import { getVoteConfigTemplate } from "@/lib/firestore/cms";
import { getAllVotesBySession } from "@/lib/firestore/votes";
import SMSPreviewModal from "@/components/admin/SMSPreviewModal";
import UserProfileModal from "@/app/admin/users/UserProfileModal";
import MatchingDrawer from "@/components/admin/MatchingDrawer";
import InstagramFeedModal from "./InstagramFeedModal";

const card = "bg-white border border-slate-200 rounded-xl shadow-sm";

export default function EventsPage() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matchingHistory, setMatchingHistory] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('session'));
  useEffect(() => {
    setUserMap({});
  }, [selectedId]);
  const selectedIdRef = useRef<string | null>(searchParams.get('session'));
  const isInitialSelectRef = useRef(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "participants" | "waitlist" | "stats"
  >("participants");
  const [applicants, setApplicants] = useState<Application[]>([]); // v7.2.0
  const [applicantsLoading, setApplicantsLoading] = useState(false); // v7.2.0
  const [userMap, setUserMap] = useState<Record<string, any>>({}); // v7.9.6: 유저 정보 조인용

  // 🌑 다크템플러: super_admin 여부
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDarkTemplarJoining, setIsDarkTemplarJoining] = useState(false);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const { getDoc, doc: docRef } = await import('firebase/firestore');
        const snap = await getDoc(docRef(db, 'users', user.uid));
        if (snap.exists() && snap.data().role === 'super_admin') {
          setIsSuperAdmin(true);
        }
      } catch (e) {
        console.error('Failed to check super_admin role:', e);
      }
    };
    // auth가 로드된 후 확인 (0.5초 디레이)
    const timer = setTimeout(checkSuperAdmin, 500);
    return () => clearTimeout(timer);
  }, []);

  // 대기자 선발 SMS 미리보기
  const [selectPreviewOpen, setSelectPreviewOpen] = useState(false);
  const [selectPreviewData, setSelectPreviewData] = useState<any>(null);
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);

  // 입금확정 SMS 미리보기
  const [confirmPreviewOpen, setConfirmPreviewOpen] = useState(false);
  const [confirmPreviewData, setConfirmPreviewData] = useState<any>(null);

  // 프로필 모달
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // SMS Modal State
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsTargets, setSmsTargets] = useState<{ phone: string; name: string; gender: string; slotNumber?: number; userId: string; appId?: string }[]>([]);
  const [smsDefaultMsg, setSmsDefaultMsg] = useState('');
  const [smsRecipientLabel, setSmsRecipientLabel] = useState('');

  // Voting Status Modal State
  const [votingStatusModalOpen, setVotingStatusModalOpen] = useState(false);
  const [votingStatusData, setVotingStatusData] = useState<{ submitted: Application[], pending: Application[], total: number, percent: number, rawVotes: any[] } | null>(null);
  const [votingStatusLoading, setVotingStatusLoading] = useState(false);
  const [showVoteDetailsInModal, setShowVoteDetailsInModal] = useState(false);

  // Matching Drawer State
  const [matchingDrawerOpen, setMatchingDrawerOpen] = useState(false);

  // Memo Modal State
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoTargetApp, setMemoTargetApp] = useState<Application | null>(null);
  const [memoContent, setMemoContent] = useState("");

  // 호수 이동 드롭다운 상태
  const [slotMoveOpenId, setSlotMoveOpenId] = useState<string | null>(null);
  const [isMemoSaving, setIsMemoSaving] = useState(false);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewList, setReviewList] = useState<{ name: string; gender: string; content: string; slotNumber: number; userId?: string; isManualReview?: boolean }[]>([]);
  const [isWritingReview, setIsWritingReview] = useState(false);
  const [reviewTargetUserId, setReviewTargetUserId] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [isReviewSaving, setIsReviewSaving] = useState(false);
  const [editingReviewUserId, setEditingReviewUserId] = useState<string | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // 대리 투표 모달 상태
  const [proxyVoteModalOpen, setProxyVoteModalOpen] = useState(false);
  const [proxyVoteTarget, setProxyVoteTarget] = useState<Application | null>(null);
  const [proxyVoteLoading, setProxyVoteLoading] = useState(false);
  const [proxyVoteChoices, setProxyVoteChoices] = useState({ priority1: '', priority2: '', priority3: '' });
  const [proxyNextEvent, setProxyNextEvent] = useState(false); // 다음 새로운 인연 옵션
  const [existingProxyVote, setExistingProxyVote] = useState<any | null>(null);
  const [proxyVoteCheckLoading, setProxyVoteCheckLoading] = useState(false);

  // v9.1.2: 단일 발송 시 대상 참가자 정보 (금액 표시 연동용)
  const [smsSingleTarget, setSmsSingleTarget] = useState<Application | null>(null);

  // v9.1.5: 더미 계정 직업명 수정 전용 상태
  const [editingAppJobId, setEditingAppJobId] = useState<string | null>(null);
  const [tempAppJobValue, setTempAppJobValue] = useState<string>('');

  // Instagram Feed Modal State
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);
  
  // 음료 서빙 관리 모달 상태
  const [drinkModalOpen, setDrinkModalOpen] = useState(false);
  const [selectedDrinkCode, setSelectedDrinkCode] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // v7.0.0: 수정 중인 문서 ID
  const ageEndRef = useRef<HTMLInputElement>(null); // v7.5.2: 자동 포커스 이동용
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const initialFormData = {
    region: "busan",
    episodeNumber: "",
    eventDate: "",
    eventTime: "20:00",
    venue: "서면역 인근 프라이빗한 파티룸",
    venueAddress: "",
    price: "29,000",
    ageStart: "", // v7.5.3: 빈칸으로 시작
    ageEnd: "", // v7.5.3: 빈칸으로 시작
    maxMale: "8",
    maxFemale: "8",
    status: "open" as SessionStatus,
    openChatLink: "", // v9.1.0: 오픈채팅방 링크
    isTest: false, // v10.0.0: 테스트 기수 여부
  };

  const [formData, setFormData] = useState(initialFormData);

  // v9.2.0: 기수 번호 자동 계산 (신규 등록일 때만)
  useEffect(() => {
    if (editingId) return; // 수정 모드일 때는 작동하지 않음
    if (!formData.eventDate || !formData.region) return;

    const [year, month, day] = formData.eventDate.split('-');
    if (!year || !month || !day) return;
    const newDate = new Date(Number(year), Number(month) - 1, Number(day));

    // 현재 선택된 지역의 기수들만 모아서 날짜 오름차순 정렬 (테스트 기수는 자동 계산에서 제외)
    const regionSessions = sessions
      .filter(s => s.region === formData.region && !s.isTest)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

    let calculatedEpisode = 1;
    let foundPrevious = false;

    // 뒤에서부터(가장 최근 기수부터) 확인하여, 새 날짜보다 이전이거나 같은 기수를 찾음
    for (let i = regionSessions.length - 1; i >= 0; i--) {
      // eventDate의 시간을 00:00:00으로 맞춰서 날짜만 비교
      const sDate = new Date(regionSessions[i].eventDate.getFullYear(), regionSessions[i].eventDate.getMonth(), regionSessions[i].eventDate.getDate());
      if (sDate <= newDate) {
        calculatedEpisode = regionSessions[i].episodeNumber + 1;
        foundPrevious = true;
        break;
      }
    }

    // 만약 이전 기수가 아예 없다면(가장 첫 번째 기수로 삽입), 
    // 기존 첫 번째 기수의 번호를 그대로 가져오고(그 첫 번째 기수가 나중에 +1로 밀림)
    if (!foundPrevious) {
      if (regionSessions.length > 0) {
        calculatedEpisode = regionSessions[0].episodeNumber;
      } else {
        calculatedEpisode = 1;
      }
    }

    if (formData.episodeNumber !== calculatedEpisode.toString()) {
      setFormData(prev => ({ ...prev, episodeNumber: calculatedEpisode.toString() }));
    }
  }, [formData.eventDate, formData.region, editingId, sessions.length]);

  // v8.1.7: 투표 설정 모달 상태

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [configFormData, setConfigFormData] = useState({
    maxSelection: 3,
    questionText: "오늘 가장 호감 갔던 이성을 3명까지 골라주세요.",
    showReason: false,
    resultVisibility: "all" as "all" | "mutual",
    q1Label: "실명을 적어주세요",
    q2Label: "본인의 호를 체크해주세요",
    q3Label: "호감가는 이성 선택",
    q4Label: "매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?",
    q5Label: "후기",
  });

  // v8.2.3: 기수 목록 사이드바 실시간 집계를 위한 전역 구독 (성능 최적화: confirmed, selected만 필터링)
  const [globalCounts, setGlobalCounts] = useState<
    Record<string, { male: number; female: number }>
  >({});
  const [avgMatchingRate, setAvgMatchingRate] = useState<number>(0);

  useEffect(() => {
    // v8.12.8: 오직 확정(confirmed) 상태인 신청자만 실시간 집계
    const q = query(
      collection(db, "applications"),
      where("status", "==", "confirmed"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const counts: Record<string, { male: number; female: number }> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const isDummy = d.id.startsWith('dummy') || data.userId?.startsWith('user_m_') || data.userId?.startsWith('user_f_') || data.isDummy === true || data.isDarkTemplar === true;
          if (isDummy) return;
          
          const sid = data.sessionId;
          if (!sid) return;
          if (!counts[sid]) counts[sid] = { male: 0, female: 0 };
          if (data.gender === "male") counts[sid].male++;
          else counts[sid].female++;
        });
        setGlobalCounts(counts);
      },
      (err) => console.error("Global counts sync error:", err),
    );
    return () => unsub();
  }, []);

  // 평균 매칭률 계산 (matchingSummaries 기반, 테스트 및 삭제된 기수 제외)
  useEffect(() => {
    const fetchMatchingRate = async () => {
      const { getDocs } = await import('firebase/firestore');
      // v10.1.0: sessions와 matchingSummaries를 조회하여 존재하지 않는(삭제된) 기수 및 테스트기수 원천 배제
      const [snap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, 'matchingSummaries')),
        getDocs(collection(db, 'sessions'))
      ]);

      const activeNonTestSessionIds = new Set<string>();
      sessionsSnap.docs.forEach(sDoc => {
        const sData = sDoc.data();
        if (!sData.isTest) {
          activeNonTestSessionIds.add(sDoc.id);
        }
      });

      if (snap.empty) { setAvgMatchingRate(0); return; }
      let totalRate = 0;
      let count = 0;
      snap.docs.forEach(d => {
        // 존재하지 않는 기수(삭제됨) 또는 테스트 기수는 평균 매칭률 산출에서 완전 제외
        if (!activeNonTestSessionIds.has(d.id)) return;

        const data = d.data();
        const pairs: any[] = data.matchedPairs || [];
        const unmatched: any[] = data.unmatchedUserIds || [];
        const total = pairs.length * 2 + unmatched.length;
        if (total > 0) {
          totalRate += (pairs.length * 2) / total * 100;
          count++;
        }
      });
      setAvgMatchingRate(count > 0 ? Math.round(totalRate / count) : 0);
    };
    fetchMatchingRate();
  }, []);

  // 1. 실시간 데이터 구독 (기수 목록)
  useEffect(() => {
    const q = query(
      collection(db, "sessions"),
      orderBy("episodeNumber", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          eventDate: d.eventDate?.toDate?.() || new Date(),
          createdAt: d.createdAt?.toDate?.() || new Date(),
        } as Session;
      });
      setSessions(fetched);
      if (!selectedIdRef.current && fetched.length > 0) {
        // 종료되지 않은 (진행 중인) 기수 중에서 가장 빨리 시작하는 기수 선택
        const now = new Date();
        const activeSessions = fetched.filter(ev => {
          const twentyFourHoursAfter = new Date(ev.eventDate.getTime() + 24 * 60 * 60 * 1000);
          return now < twentyFourHoursAfter && !ev.isForceHidden;
        });

        if (activeSessions.length > 0) {
          const earliestActive = [...activeSessions].sort((a, b) => {
            const tA = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
            const tB = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
            return tA - tB;
          })[0];
          setSelectedId(earliestActive.id);
        } else {
          // 만약 진행 중인 기수가 아예 없다면 전체 기수 중 가장 최신 기수 선택
          setSelectedId(fetched[0].id);
        }
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to sessions:", error);
      setIsLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);



  // 호수 이동 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!slotMoveOpenId) return;
    const handler = () => setSlotMoveOpenId(null);
    document.addEventListener('click', handler, { capture: true });
    return () => document.removeEventListener('click', handler, { capture: true });
  }, [slotMoveOpenId]);

  useEffect(() => {
    if (!selectedId) return;
    setActiveTab("participants");

    // v8.15.0: URL 쿼리 파라미터 동기화 (새로고침 시 선택 유지)
    const params = new URLSearchParams(window.location.search);
    if (params.get('session') !== selectedId) {
      params.set('session', selectedId);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [selectedId]);

  // v7.2.0: 선택된 기수의 신청자 명단 실시간 구독
  useEffect(() => {
    if (!selectedId) {
      setApplicants([]);
      return;
    }
    setApplicantsLoading(true);
    const q = query(
      collection(db, "applications"),
      where("sessionId", "==", selectedId),
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = snap.docs.map(
          (d) =>
            ({
              id: d.id,
              userId: d.data().userId,
              sessionId: d.data().sessionId,
              name: d.data().name,
              age: d.data().age,
              gender: d.data().gender,
              job: d.data().job,
              phone: d.data().phone ?? "",
              residence: d.data().residence,
              status: d.data().status,
              paymentConfirmed: d.data().paymentConfirmed ?? false,
              appliedAt: d.data().appliedAt?.toDate() ?? new Date(),
              updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
              instaId: d.data().instaId,
              smoking: d.data().smoking,
              drinking: d.data().drinking,
              religion: d.data().religion,
              drink: d.data().drink,
              idealType: d.data().idealType,
              nonIdealType: d.data().nonIdealType,
              avoidAcquaintance: d.data().avoidAcquaintance,
              avoidList: d.data().avoidList || [],
              etc: d.data().etc,
              slotNumber: d.data().slotNumber ?? null,
              price: d.data().price,
              femaleOption: d.data().femaleOption ?? null,
              groupPartnerName: d.data().groupPartnerName ?? null,
              groupPartnerBirthYear: d.data().groupPartnerBirthYear ?? null,
              birthDate: d.data().birthDate,
              height: d.data().height,
              adminMemo: d.data().adminMemo,
              displayJob: d.data().displayJob,
              isJobReviewed: d.data().isJobReviewed,
              attended: d.data().attended ?? false,
              attendanceStatus: d.data().attendanceStatus ?? null,
              isRefundDeposit: d.data().isRefundDeposit ?? false,
              isManualRefund: d.data().isManualRefund ?? false,
              isDarkTemplar: d.data().isDarkTemplar ?? false,
              secondSmsSentAt: d.data().secondSmsSentAt ?? null,
              maleOption: d.data().maleOption ?? null,
              couponDiscount: d.data().couponDiscount ?? 0,
              drinkServed: d.data().drinkServed ?? false,
            }) as Application,
        );
        list.sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());
        setApplicants(list);
        setApplicantsLoading(false);

        // v7.9.6: 유저 컬렉션에서 상세 정보(생년월일 등) 조인
        const uids = Array.from(new Set(list.map((a) => a.userId)));
        
        // v9.1.2: 병렬 Promise.all로 전환하여 깜빡임 극소화 및 데이터 실시간 변경 반영
        Promise.all(
          uids.map(async (uid) => {
            try {
              const uSnap = await getDoc(doc(db, "users", uid));
              if (uSnap.exists()) {
                return { uid, data: { id: uSnap.id, ...uSnap.data() } };
              }
            } catch (e) {
              console.error("Error fetching user data:", uid, e);
            }
            return null;
          })
        ).then((results) => {
          setUserMap(prevUserMap => {
            const newUserMap = { ...prevUserMap };
            let updated = false;
            results.forEach((res) => {
              if (res) {
                const existing = newUserMap[res.uid];
                if (!existing || JSON.stringify(existing) !== JSON.stringify(res.data)) {
                  newUserMap[res.uid] = res.data;
                  updated = true;
                }
              }
            });
            return updated ? newUserMap : prevUserMap;
          });
        });
      },
      (err) => {
        console.error(err);
        setApplicantsLoading(false);
      },
    );
    return () => unsub();
  }, [selectedId]);

  // 2. 매칭 히스토리 로드 (간이 통계용)
  useEffect(() => {
    const q = query(
      collection(db, "sessions"),
      orderBy("episodeNumber", "desc"),
      limit(5),
    );
    const unsub = onSnapshot(q, (snap) => {
      const history = snap.docs.map((doc) => ({
        id: doc.id,
        episode: doc.data().episodeNumber,
        date: format(
          doc.data().eventDate?.toDate?.() || new Date(),
          "yyyy. MM. dd",
        ),
        status: doc.data().status,
      }));
      setMatchingHistory(history);
    }, (error) => {
      console.error("Error listening to matching history:", error);
    });
    return () => unsub();
  }, []);

  // SMS 템플릿 로드
  useEffect(() => {
    import('firebase/firestore').then(({ getDocs, collection }) => {
      getDocs(collection(db, 'smsTemplates')).then(snap => {
        setSmsTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    });
  }, []);

  const active = useMemo(
    () => sessions.find((s) => s.id === selectedId),
    [sessions, selectedId],
  );


  const stats = useMemo(() => {
    const openCount = sessions.filter((s) => s.status === "open").length;
    // v8.2.3: 모든 기수의 실시간 집계 인원을 합산하여 표시 (Global Sync)
    const totalParticipants = Object.values(globalCounts).reduce(
      (sum, c) => sum + c.male + c.female,
      0,
    );
    return {
      total: sessions.length,
      open: openCount,
      participants: totalParticipants,
      rate: avgMatchingRate,
    };
  }, [sessions, globalCounts, avgMatchingRate]);

  // v8.1.7: 투표 폼 상태 퀵 토글
  const toggleVotingForm = async (newStatus: SessionStatus) => {
    if (!selectedId) return;
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "sessions", selectedId), { status: newStatus });
      toast.success(
        `투표 폼이 ${newStatus === "voting" ? "[열림]" : "[닫힘]"} 상태로 변경되었습니다.`,
      );
    } catch (e) {
      toast.error("상태 변경 중 오류 발생");
    }
  };

  // v8.12.8: 오직 참가 확정자만 명단 및 집계에 포함
  const participants = useMemo(
    () => applicants.filter((a) => a.status === "confirmed"),
    [applicants],
  );

  // 투표 현황 실시간 집계 구독 (onSnapshot 연동)
  useEffect(() => {
    if (!votingStatusModalOpen || !active) return;

    setVotingStatusLoading(true);
    const q = query(
      collection(db, "votes"),
      where("sessionId", "==", active.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const votes = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          sessionId: d.sessionId,
          choices: d.choices || [],
          realName: d.realName || '',
          myAlias: d.myAlias || '',
          finalCheck: d.finalCheck || false,
          disclosureMode: d.disclosureMode || 'public',
          feedback: d.feedback || '',
          submittedAt: d.submittedAt ? (d.submittedAt as Timestamp).toDate() : new Date(),
        } as Vote;
      });

      const sessionParticipants = participants;
      const votedUserIds = new Set(votes.map(v => v.userId));

      const submitted: Application[] = [];
      const pending: Application[] = [];
      sessionParticipants.forEach(app => {
        if (votedUserIds.has(app.userId)) submitted.push(app);
        else pending.push(app);
      });

      const total = sessionParticipants.length;
      setVotingStatusData({
        total,
        submitted,
        pending,
        percent: total > 0 ? Math.round((submitted.length / total) * 100) : 0,
        rawVotes: votes
      });
      setVotingStatusLoading(false);
    }, (error) => {
      console.error("Error listening to votes:", error);
      toast.error("실시간 투표 현황 구독 중 오류가 발생했습니다.");
      setVotingStatusLoading(false);
    });

    return () => unsub();
  }, [votingStatusModalOpen, active, participants]);
  const waitlisted = useMemo(
    () => applicants.filter((a) => ["applied", "held", "waitlisted", "selected"].includes(a.status)),
    [applicants],
  );

  // v11.1.2: UI 통계 표시용 (더미 계정 및 다크템플러 제외)
  const realParticipants = useMemo(() => {
    return participants.filter(app => {
      const user = userMap[app.userId] || {};
      return !(app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true || app.isDarkTemplar === true);
    });
  }, [participants, userMap]);

  const realWaitlisted = useMemo(() => {
    return waitlisted.filter(app => {
      const user = userMap[app.userId] || {};
      return !(app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true || app.isDarkTemplar === true);
    });
  }, [waitlisted, userMap]);

  const isGenderFull = useMemo(() => ({
    male: participants.filter((a) => a.gender === "male" && !a.isDarkTemplar).length >= (active?.maxMale ?? 0),
    female: participants.filter((a) => a.gender === "female" && !a.isDarkTemplar).length >= (active?.maxFemale ?? 0),
  }), [participants, active]);

  const overQuotaAppIds = useMemo(() => {
    const overIds = new Set<string>();
    if (!active) return overIds;

    const maleConfirmed = participants
      .filter((a) => a.gender === "male" && !a.isDarkTemplar)
      .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());
    const femaleConfirmed = participants
      .filter((a) => a.gender === "female" && !a.isDarkTemplar)
      .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());

    if (maleConfirmed.length > active.maxMale) {
      maleConfirmed.slice(active.maxMale).forEach((a) => overIds.add(a.id));
    }
    if (femaleConfirmed.length > active.maxFemale) {
      femaleConfirmed.slice(active.maxFemale).forEach((a) => overIds.add(a.id));
    }
    return overIds;
  }, [participants, active]);

  const handleBulkSMSConfirm = async (message: string) => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/admin/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ targets: smsTargets, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '문자 발송 실패');
    
    // v9.1.7: 문자가 성공적으로 발송되었을 때 applications 컬렉션의 secondSmsSentAt 필드 업데이트
    const sentAt = new Date();
    const sentAppIds = smsTargets.filter((t) => t.appId).map((t) => t.appId!);
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      await Promise.all(
        sentAppIds.map((appId) =>
          updateDoc(doc(db, 'applications', appId), {
            secondSmsSentAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );
      // v9.1.8: Firestore 쓰기 완료 즉시 로컬 applicants 상태도 동기화 → 체크 표시 즉각 반영
      if (sentAppIds.length > 0) {
        setApplicants((prev) =>
          prev.map((a) =>
            sentAppIds.includes(a.id) ? { ...a, secondSmsSentAt: sentAt as any } : a
          )
        );
      }
    } catch (e) {
      console.error('Error updating secondSmsSentAt:', e);
    }

    const msg = data.failCount > 0
      ? `${data.successCount}명 발송 완료 (${data.failCount}명 실패)`
      : `${data.successCount}명에게 문자 발송 완료`;

    if (data.isMock) {
      toast('로컬 환경이라 실제 문자는 발송되지 않았습니다.', { icon: '⚠️', duration: 4000 });
    } else {
      toast.success(msg);
    }
  };

  const handleEditAppJob = async (app: any, newValue: string) => {
    if (!app || !newValue.trim()) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'applications', app.id), {
        job: newValue.trim(),
        updatedAt: new Date()
      });
      toast.success('직업명이 수정되었습니다.');
      setEditingAppJobId(null);
    } catch (e) {
      toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const isDummyApp = (app: any) => (app.userId?.startsWith("user_m_") || app.userId?.startsWith("user_f_") || app.id?.startsWith("dummy_"));

  // v9.1.6: 2차 안내문자 발송 여부 렌더링 헬퍼
  const renderSmsButton = (app: any, isDesktop = false) => {
    const isSent = !!app.secondSmsSentAt;
    const sentTimeStr = isSent
      ? format(app.secondSmsSentAt?.toDate ? app.secondSmsSentAt.toDate() : new Date(app.secondSmsSentAt), 'HH:mm')
      : '';
      
    const handleSmsClick = () => {
      const _name = app.name || '참가자';
      setSmsTargets([{ phone: app.phone, name: _name, gender: app.gender, slotNumber: app.slotNumber, userId: app.userId, appId: app.id }]);
      setSmsSingleTarget(app);
      setSmsRecipientLabel(`${app.name}님`);
      setSmsDefaultMsg(generateSecondGuidanceMsg(app));
      setSmsModalOpen(true);
    };

    if (isDesktop) {
      return (
        <button
          onClick={handleSmsClick}
          className={`shrink-0 p-2 rounded-xl border transition-all relative ${isSent ? "bg-orange-50 text-[#FF6F61] border-orange-200 shadow-sm" : "bg-white border-[#FF7E7E]/30 text-[#FF6F61] hover:bg-orange-50 hover:border-[#FF7E7E]"}`}
          title={isSent ? `발송 완료 시간: ${sentTimeStr}` : "문자 보내기"}
        >
          <MessageSquare size={13} fill={isSent ? "currentColor" : "none"} />
          {isSent && (
            <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full">
              <CheckCircle2 size={13} className="text-green-500" fill="white" />
            </div>
          )}
        </button>
      );
    }

    return (
      <button
        onClick={handleSmsClick}
        className={`p-1.5 rounded-lg border relative ${isSent ? "bg-orange-50 text-[#FF6F61] border-orange-200 shadow-sm" : "bg-white border-[#FF7E7E]/30 text-[#FF6F61] hover:bg-orange-50 hover:border-[#FF7E7E]"}`}
        title={isSent ? `발송 완료 시간: ${sentTimeStr}` : "문자 보내기"}
      >
        <MessageSquare size={13} fill={isSent ? "currentColor" : "none"} />
        {isSent && (
          <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full">
            <CheckCircle2 size={13} className="text-green-500" fill="white" />
          </div>
        )}
      </button>
    );
  };

  const callStatusApi = async (applicationId: string, status: string) => {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/admin/applications/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ applicationId, status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  };

  const handleWaitlistSelect = (app: Application) => {
    const session = active;
    if (!session) return toast.error("세션 정보를 찾을 수 없습니다.");
    const user = userMap[app.userId] || {};

    const eventTime = session.eventDate instanceof Date ? session.eventDate : (session.eventDate as any).toDate();
    const formatter = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = formatter.formatToParts(eventTime);
    const getPart = (t: string) => parts.find((p) => p.type === t)?.value;
    const fDate = `${getPart("month")}/${getPart("day")}`;
    const fDay = `(${getPart("weekday")})`;
    const fTime = `${getPart("hour")}:${getPart("minute")}`;

    const genderPrice = app.gender === 'male'
      ? (app.maleOption === 'safe' ? 60000 : (session.malePrice || 49000))
      : (app.femaleOption === 'group' ? 24000 : (session.femalePrice || 29000));

    // v8.12.3: 저장된 '입금 요청 (기본)' 템플릿 자동 적용
    const targetTemplate = smsTemplates.find(t => t.name === '입금 요청 (기본)');
    let defaultMsg = '';

    const couponText = app.couponDiscount && app.couponDiscount > 0
      ? ' (쿠폰 할인 적용)'
      : (app.gender === 'female' && app.femaleOption === 'group' ? ' (동반할인 적용)' : '');

    if (targetTemplate) {
      const sessionName = session.episodeNumber
        ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`
        : '';

      const formattedPrice = (app.price || genderPrice).toLocaleString('ko-KR');

      let result = targetTemplate.content
        .replace(/{{이름}}/g, user.name || app.name || '참가자')
        .replace(/{{날짜}}/g, fDate)
        .replace(/{{요일}}/g, getPart('weekday') || '')
        .replace(/{{시간}}/g, fTime)
        .replace(/{{기수}}/g, sessionName)
        .replace(/{{장소}}/g, session.venue || session.location || '');

      if (result.includes('{{쿠폰적용여부}}')) {
        result = result
          .replace(/{{금액}}원/g, formattedPrice + '원')
          .replace(/{{금액}}/g, formattedPrice)
          .replace(/{{쿠폰적용여부}}/g, couponText);
      } else {
        result = result
          .replace(/{{금액}}원/g, `${formattedPrice}원${couponText}`)
          .replace(/{{금액}}/g, `${formattedPrice}원${couponText}`);
      }

      defaultMsg = result;
    } else {
      defaultMsg = `안녕하세요 ! 키링크에 지원해주셔서 감사합니다☺️
${user.name || app.name || "참가자"}님은 ${fDate} ${fDay} ${fTime} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 ${(app.price || genderPrice).toLocaleString("ko-KR")}원${couponText} 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요😭
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요🥰`;
    }

    setSelectPreviewData({ app, session, defaultMsg });
    setSelectPreviewOpen(true);
  };

  const handleWaitlistSelectConfirm = async (msg: string, price?: number) => {
    if (!selectPreviewData) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/admin/applications/select", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ applicationId: selectPreviewData.app.id, customMessage: msg, price }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.warning) {
      toast(data.warning, { icon: '⚠️', duration: 4000 });
    } else if (data.isMock) {
      toast('로컬 환경이라 실제 문자는 발송되지 않았습니다.', { icon: '⚠️', duration: 4000 });
    } else {
      toast.success("선발 및 안내 문자 발송 완료");
    }
  };

  const handleWaitlistHold = async (app: Application) => {
    try {
      await callStatusApi(app.id, "held");
      toast.success("보류 처리 완료");
    } catch (e: any) {
      toast.error(e.message || "오류가 발생했습니다.");
    }
  };

  const handleWaitlistConfirm = (app: Application) => {
    const session = active;
    if (!session) return toast.error("세션 정보를 찾을 수 없습니다.");
    const user = userMap[app.userId] || {};

    const eventTime = session.eventDate instanceof Date ? session.eventDate : (session.eventDate as any).toDate();
    const formatter = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = formatter.formatToParts(eventTime);
    const getPart = (t: string) => parts.find((p) => p.type === t)?.value;
    const fDate = `${getPart("month")}/${getPart("day")}`;
    const fDay = `(${getPart("weekday")})`;
    const fTime = `${getPart("hour")}:${getPart("minute")}`;

    // '참가 확정 안내' 템플릿 자동 바인딩
    const targetTemplate = smsTemplates.find(t => t.name === '참가 확정 안내');
    let defaultMsg = '';

    const sessionName = session.episodeNumber
      ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`
      : '';

    if (targetTemplate) {
      let result = targetTemplate.content
        .replace(/{{이름}}/g, user.name || app.name || '참가자')
        .replace(/{{날짜}}/g, fDate)
        .replace(/{{요일}}/g, getPart('weekday') || '')
        .replace(/{{시간}}/g, fTime)
        .replace(/{{기수}}/g, sessionName)
        .replace(/{{장소}}/g, session.venue || session.location || '');

      defaultMsg = result;
    } else {
      defaultMsg = `안녕하세요 ${user.name || app.name || '참가자'}님! 키링크입니다.
입금이 확인되어 ${sessionName} 참가가 최종 확정되었습니다.

일시: ${fDate} ${fDay} ${fTime}
장소: ${session.venue || session.location || ''}

당일 현장에서 뵙겠습니다! 좋은 인연 만나시길 바랍니다 :)`;
    }

    setConfirmPreviewData({ app, session, defaultMsg });
    setConfirmPreviewOpen(true);
  };

  const handleWaitlistConfirmSubmit = async (msg: string, price?: number) => {
    if (!confirmPreviewData) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/admin/applications/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ applicationId: confirmPreviewData.app.id, customMessage: msg, price }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.warning) {
      toast(data.warning, { icon: '⚠️', duration: 4000 });
    } else if (data.isMock) {
      toast('로컬 환경이라 실제 문자는 발송되지 않았습니다.', { icon: '⚠️', duration: 4000 });
    } else {
      toast.success("입금확정 및 안내 문자 발송 완료");
    }
  };

  const handleSetAttendanceStatus = async (app: Application, status: 'present' | 'late' | 'no-show' | 'none') => {
    try {
      console.log('Setting attendance status for:', app.name, 'to:', status);
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      
      let attended = false;
      let attendanceStatus: string | null = null;
      let toastMsg = "";

      if (status === 'present') {
        attended = true;
        attendanceStatus = 'present';
        toastMsg = "출석 완료 처리되었습니다.";
      } else if (status === 'late') {
        attended = true;
        attendanceStatus = 'late';
        toastMsg = "지각 처리되었습니다.";
      } else if (status === 'no-show') {
        attended = false;
        attendanceStatus = 'no-show';
        toastMsg = "노쇼 처리되었습니다.";
      } else {
        attended = false;
        attendanceStatus = null;
        toastMsg = "출석 상태가 초기화되었습니다.";
      }

      await updateDoc(docRef(db, 'applications', app.id), {
        attended,
        attendanceStatus,
        updatedAt: new Date()
      });

      // v11.0.0: users 컬렉션 노쇼/지각 카운트 업데이트
      if (app.userId && !app.userId.startsWith('user_m_') && !app.userId.startsWith('user_f_')) {
        try {
          const { increment } = await import('firebase/firestore');
          const prevStatus = app.attendanceStatus;
          let nsDiff = 0;
          let tdDiff = 0;
          let pcDiff = 0;
          
          const isParticipating = (s: string | null | undefined) => s === 'present' || s === 'late';
          const wasParticipating = isParticipating(prevStatus);
          const willParticipate = isParticipating(status);

          const updates: any = {};

          if (willParticipate && !wasParticipating) {
            updates.participationCount = increment(1);
            pcDiff = 1;
          } else if (!willParticipate && wasParticipating) {
            updates.participationCount = increment(-1);
            pcDiff = -1;
          }

          if (status === 'no-show' && prevStatus !== 'no-show') {
            updates.noShowCount = increment(1);
            nsDiff = 1;
          } else if (status !== 'no-show' && prevStatus === 'no-show') {
            updates.noShowCount = increment(-1);
            nsDiff = -1;
          }
          
          if (status === 'late' && prevStatus !== 'late') {
            updates.tardyCount = increment(1);
            tdDiff = 1;
          } else if (status !== 'late' && prevStatus === 'late') {
            updates.tardyCount = increment(-1);
            tdDiff = -1;
          }

          if (Object.keys(updates).length > 0) {
            await updateDoc(docRef(db, 'users', app.userId), updates);
          }

          // v11.2.0: 로컬 userMap 상태 강제 동기화 (실시간 숫자 변경 해결)
          if (nsDiff !== 0 || tdDiff !== 0 || pcDiff !== 0) {
            setUserMap((prevMap) => {
              const u = prevMap[app.userId] || {};
              const currentNs = u.noShowCount || 0;
              const currentTd = u.tardyCount || 0;
              const currentPc = u.participationCount || 0;
              return {
                ...prevMap,
                [app.userId]: {
                  ...u,
                  noShowCount: Math.max(0, currentNs + nsDiff),
                  tardyCount: Math.max(0, currentTd + tdDiff),
                  participationCount: Math.max(0, currentPc + pcDiff),
                }
              };
            });
          }
        } catch (countErr) {
          console.warn('Failed to update user count:', countErr);
        }
      }
      toast.success(toastMsg);
    } catch (e) {
      console.error('Error setting attendance status:', e);
      toast.error('출석 상태 변경 중 오류가 발생했습니다.');
    }
  };

  // 🌑 다크템플러 참여 핸들러
  const handleDarkTemplarJoin = async (sessionId: string) => {
    const user = auth.currentUser;
    if (!user) return toast.error('로그인이 필요합니다.');
    if (isDarkTemplarJoining) return;
    setIsDarkTemplarJoining(true);
    try {
      // 이미 해당 기수에 다크템플러로 참여중인지 확인
      const { collection: col, query: q, where: wh, getDocs: gd } = await import('firebase/firestore');
      const existing = await gd(q(col(db, 'applications'), wh('userId', '==', user.uid), wh('sessionId', '==', sessionId)));
      if (!existing.empty) {
        const existingData = existing.docs[0].data();
        if (existingData.isDarkTemplar === true) {
          return toast.error('이미 다크템플러로 참여 중입니다.');
        }
        
        const proceed = window.confirm('이미 이 기수에 일반 신청서가 존재합니다. 다크템플러(무제한 정원 외)로 전환하여 참가 확정하시겠습니까?');
        if (!proceed) {
          setIsDarkTemplarJoining(false);
          return;
        }
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/admin/applications/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.uid, sessionId, status: 'confirmed' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '다크템플러 참여에 실패했습니다.');
      toast.success('🌑 다크템플러로 참여가 등록되었습니다.');
    } catch (e: any) {
      toast.error(e.message || '오류가 발생했습니다.');
    } finally {
      setIsDarkTemplarJoining(false);
    }
  };

  // 🌑 다크템플러 참여 해제 핸들러
  const handleDarkTemplarLeave = async (sessionId: string) => {
    const user = auth.currentUser;
    if (!user) return toast.error('로그인이 필요합니다.');
    if (isDarkTemplarJoining) return;
    
    const proceed = window.confirm('다크템플러 참여를 해제하시겠습니까?');
    if (!proceed) return;

    setIsDarkTemplarJoining(true);
    try {
      // 해당 기수에 다크템플러로 등록된 본인의 신청서 ID 찾기
      const { collection: col, query: q, where: wh, getDocs: gd } = await import('firebase/firestore');
      const snap = await gd(q(col(db, 'applications'), wh('userId', '==', user.uid), wh('sessionId', '==', sessionId), wh('isDarkTemplar', '==', true)));
      
      if (snap.empty) {
        throw new Error('다크템플러 신청 내역을 찾을 수 없습니다.');
      }

      const appDocId = snap.docs[0].id;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/applications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ applicationId: appDocId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '다크템플러 해제에 실패했습니다.');
      toast.success('🌑 다크템플러 참여가 해제되었습니다.');
    } catch (e: any) {
      toast.error(e.message || '오류가 발생했습니다.');
    } finally {
      setIsDarkTemplarJoining(false);
    }
  };

  // v12.0.0: 보증금 환불 대상 토글 (수동 환불과 동기화)
  const handleToggleRefundDeposit = async (app: Application) => {
    try {
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      const isCurrentlyRefunded = app.isRefundDeposit || app.isManualRefund;
      const next = !isCurrentlyRefunded;
      
      const updateData: any = {
        isRefundDeposit: next,
        updatedAt: new Date(),
      };
      
      if (!next) {
        updateData.isManualRefund = null; // 환불 해제 시 수동 환불 플래그도 초기화
      }
      
      await updateDoc(docRef(db, 'applications', app.id), updateData);
      toast.success(next ? '💸 환불 대상으로 설정되었습니다.' : '환불 대상이 해제되었습니다.');
    } catch (e) {
      console.error('Error toggling refund deposit:', e);
      toast.error('처리 중 오류가 발생했습니다.');
    }
  };

  // v12.1.0: 호수 이동 핸들러
  const handleMoveSlot = async (app: Application, newSlot: number) => {
    setSlotMoveOpenId(null);
    if (app.slotNumber === newSlot) return;
    try {
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      await updateDoc(docRef(db, 'applications', app.id), {
        slotNumber: newSlot,
        updatedAt: new Date(),
      });
      toast.success(`${app.name}님을 ${newSlot}호로 이동했습니다.`);
    } catch (e) {
      console.error('Error moving slot:', e);
      toast.error('호수 이동 중 오류가 발생했습니다.');
    }
  };

  // Review CRUD Business Handlers
  const handleSaveReview = async () => {
    if (!selectedId) return;
    if (!reviewTargetUserId) {
      toast.error("대상 참가자를 선택해 주세요.");
      return;
    }
    if (!reviewContent.trim()) {
      toast.error("후기 내용을 입력해 주세요.");
      return;
    }

    setIsReviewSaving(true);
    try {
      const { doc: docRef, getDoc, setDoc, updateDoc } = await import('firebase/firestore');
      const targetApp = participants.find(p => p.userId === reviewTargetUserId);
      if (!targetApp) {
        toast.error("참가자 정보를 찾을 수 없습니다.");
        setIsReviewSaving(false);
        return;
      }

      const voteDocId = `${selectedId}_${reviewTargetUserId}`;
      const voteRef = docRef(db, 'votes', voteDocId);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        await updateDoc(voteRef, {
          feedback: reviewContent.trim(),
          updatedAt: new Date()
        });
      } else {
        await setDoc(voteRef, {
          choices: [],
          feedback: reviewContent.trim(),
          isManualReview: true,
          gender: targetApp.gender || "male",
          name: targetApp.name || "-",
          slotNumber: targetApp.slotNumber || 99,
          userId: reviewTargetUserId,
          sessionId: selectedId,
          createdAt: new Date()
        });
      }

      toast.success("후기가 저장되었습니다.");
      setIsWritingReview(false);
      setReviewTargetUserId("");
      setReviewContent("");
      setEditingReviewUserId(null);
      
      if (active) handleOpenReviews(active);
    } catch (e) {
      console.error("Error saving manual review:", e);
      toast.error("후기 저장에 실패했습니다.");
    } finally {
      setIsReviewSaving(false);
    }
  };

  const handleDeleteReview = async (userId: string) => {
    if (!selectedId) return;
    if (!confirm("정말로 이 후기를 삭제하시겠습니까?")) return;

    try {
      const { doc: docRef, getDoc, deleteDoc, updateDoc } = await import('firebase/firestore');
      const voteDocId = `${selectedId}_${userId}`;
      const voteRef = docRef(db, 'votes', voteDocId);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        const data = voteSnap.data();
        if (data.isManualReview) {
          await deleteDoc(voteRef);
        } else {
          await updateDoc(voteRef, {
            feedback: "",
            updatedAt: new Date()
          });
        }
        toast.success("후기가 삭제되었습니다.");
        if (active) handleOpenReviews(active);
      }
    } catch (e) {
      console.error("Error deleting manual review:", e);
      toast.error("후기 삭제에 실패했습니다.");
    }
  };

  const handleOpenProxyVote = async (app: Application) => {
    if (!selectedId) return;
    setProxyVoteTarget(app);
    setProxyVoteChoices({ priority1: '', priority2: '', priority3: '' });
    setExistingProxyVote(null);
    setProxyVoteModalOpen(true);
    setProxyVoteCheckLoading(true);
    try {
      const { getDocs: gd, query: q, collection: col, where: wh } = await import('firebase/firestore');
      const snap = await gd(q(col(db, 'votes'), wh('sessionId', '==', selectedId), wh('userId', '==', app.userId)));
      if (!snap.empty) {
        const voteData = snap.docs[0].data();
        setExistingProxyVote({ id: snap.docs[0].id, ...voteData });
        const choices = voteData.choices || [];
        setProxyVoteChoices({
          priority1: choices.find((c: any) => c.priority === 1)?.targetUserId || '',
          priority2: choices.find((c: any) => c.priority === 2)?.targetUserId || '',
          priority3: choices.find((c: any) => c.priority === 3)?.targetUserId || '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProxyVoteCheckLoading(false);
    }
  };

  const handleSubmitProxyVote = async () => {
    if (!proxyVoteTarget || !selectedId) return;
    if (existingProxyVote) {
      toast.error('기존 투표를 먼저 삭제해 주세요.');
      return;
    }
    setProxyVoteLoading(true);
    try {
      const choices: any[] = [];
      const oppParticipants = participants.filter(p => p.gender !== proxyVoteTarget.gender);
      const findName = (uid: string) => oppParticipants.find(p => p.userId === uid)?.name || uid;
      if (proxyVoteChoices.priority1) choices.push({ priority: 1, targetUserId: proxyVoteChoices.priority1, targetUserName: findName(proxyVoteChoices.priority1) });
      if (proxyVoteChoices.priority2) choices.push({ priority: 2, targetUserId: proxyVoteChoices.priority2, targetUserName: findName(proxyVoteChoices.priority2) });
      if (proxyVoteChoices.priority3) choices.push({ priority: 3, targetUserId: proxyVoteChoices.priority3, targetUserName: findName(proxyVoteChoices.priority3) });

      if (choices.length === 0 && !proxyNextEvent) {
        toast.error('호감 상대를 선택하거나 "다음 새로운 인연" 옵션을 선택해 주세요.');
        setProxyVoteLoading(false);
        return;
      }

      const voteId = `${selectedId}_${proxyVoteTarget.userId}`;
      await setDoc(doc(db, 'votes', voteId), {
        userId: proxyVoteTarget.userId,
        sessionId: selectedId,
        choices,
        realName: proxyVoteTarget.name,
        myAlias: proxyVoteTarget.slotNumber ? `${proxyVoteTarget.gender === 'male' ? '키링남' : '키링녀'} ${proxyVoteTarget.slotNumber}호` : '',
        finalCheck: true,
        disclosureMode: 'public',
        feedback: '',
        submittedAt: Timestamp.now(),
        isProxyVote: true,
      });
      toast.success(`[${proxyVoteTarget.name}] 대리 투표가 저장되었습니다.`);
      setProxyVoteModalOpen(false);
      setProxyNextEvent(false);
      setProxyVoteChoices({ priority1: '', priority2: '', priority3: '' });
    } catch (e: any) {
      console.error(e);
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setProxyVoteLoading(false);
    }
  };

  const handleDeleteProxyVote = async () => {
    if (!existingProxyVote) return;
    if (!window.confirm('기존 투표를 삭제하시겠습니까? 삭제 후 재입력할 수 있습니다.')) return;
    setProxyVoteLoading(true);
    try {
      await deleteDoc(doc(db, 'votes', existingProxyVote.id));
      setExistingProxyVote(null);
      setProxyVoteChoices({ priority1: '', priority2: '', priority3: '' });
      toast.success('기존 투표가 삭제되었습니다. 이제 재입력하세요.');
    } catch (e) {
      console.error(e);
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setProxyVoteLoading(false);
    }
  };

  const getBirthYear = (app: Application) => {
    const user = userMap[app.userId];
    // v8.13.7: birthDate 필드 우선 참조 (신청 관리 페이지와 로직 통일)
    const rawBirth = user?.birthDate || app.birthDate;
    if (rawBirth) {
      const yearPart = rawBirth.includes("-") ? rawBirth.split('-')[0] : rawBirth;
      return `${yearPart.length === 4 ? yearPart.slice(2, 4) : yearPart.slice(0, 2)}년생`;
    }
    if (!app.age) return "-";
    // birthDate가 없을 때만 age로 역산 (오차 방지를 위해 2026 기준 고정)
    const n = Number(app.age);
    const birthYear = 2026 - n;
    return `${String(birthYear).slice(-2)}년생`;
  };

  const getEffectiveJob = (app: Application) => {
    const user = userMap[app.userId];
    // 1. 해당 신청서에 별도로 입력된 노출용 직업이 최우선
    if (app.displayJob) return app.displayJob;
    // 2. 관리자가 유저 관리에서 승인(Reviewed)한 직업명이 있다면 그것을 사용 (admin_job 우선)
    if (user?.admin_job) return user.admin_job;
    // 3. 유저 프로필의 최신 직업명 (admin_job이 없더라도 최신 정보 선호)
    if (user?.job) return user.job;
    // 4. 신청서 작성 당시의 직업 (마지막 보루)
    return app.job || "-";
  };

  const handleWaitlistDelete = async (app: Application) => {
    if (!window.confirm(`[${app.name}] 님의 신청을 삭제하시겠습니까? 복구할 수 없습니다.`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/applications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("삭제 완료");
    } catch (e: any) {
      toast.error(e.message || "오류가 발생했습니다.");
    }
  };

  // v9.1.1: 2차 안내문자(행사 당일) 메시지 생성기
  const generateSecondGuidanceMsg = (app: Application) => {
    const session = active;
    if (!session) return "";
    
    const targetTemplate = smsTemplates.find(t => t.name === '2차 안내 (행사 당일)');
    
    const _name = app.name || "참가자";
    const _gender = app.gender === "male" ? "남" : "녀";
    const _slot = app.slotNumber != null ? String(app.slotNumber) : "?";
    const chatLink = session.openChatLink || "{오픈채팅링크}";
    const eventDate = session.eventDate instanceof Date ? session.eventDate : (session.eventDate as any).toDate();
    const fDate = format(eventDate, "MM/dd", { locale: ko });
    const fTime = format(eventDate, "HH:mm", { locale: ko });
    const fDay = format(eventDate, "E", { locale: ko });
    const location = session.venue || session.location || "부산진구 중앙대로 763-1 데일리팡 4층";

    if (targetTemplate) {
      return targetTemplate.content
        .replace(/{{이름}}/g, _name)
        .replace(/{{성별}}/g, _gender)
        .replace(/{{호수}}/g, _slot)
        .replace(/{{날짜}}/g, fDate)
        .replace(/{{요일}}/g, fDay)
        .replace(/{{시간}}/g, fTime)
        .replace(/{{장소}}/g, location)
        .replace(/{{오픈채팅링크}}/g, chatLink);
    }

    // Fallback: 기존 하드코딩된 내용
    return `안녕하세요😊 키링크입니다 :)
일시 : ${fDate} ${fDay} ${fTime} (약 2시간 소요)
장소 : ${location}

❤️${_name}님은 키링${_gender === '남' ? '남' : '녀'} ${_slot}호입니다❤️
입장 전 신분증(모바일 가능)을 미리 꺼내놔주세요

슬리퍼, 운동복 등 소개팅 분위기와 맞지 않는 복장은 ❌❌
${chatLink}
카카오프렌즈 익명으로 입장해주시면 됩니다 ! 내일 오픈채팅으로 진행과정에 대해 설명드리니 지금 바로 입장부탁드립니다 :)`;
  };

  // v8.5.4: 선발 취소 - status API 경유 (대기자 자동 승격 포함)
  const handleCancelSelection = async (app: Application) => {
    if (
      !window.confirm(
        `[${app.name}] 님의 선발을 취소하고 '검토 중' 상태로 변경하시겠습니까?`,
      )
    )
      return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/applications/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ applicationId: app.id, status: "applied" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("선발이 취소되었습니다.");
    } catch (e: any) {
      toast.error(e.message || "오류가 발생했습니다.");
    }
  };

  const getDrinkCode = (drinkData: string | string[] | undefined) => {
    if (!drinkData) return null;
    const drinks = Array.isArray(drinkData) ? drinkData : [drinkData];
    if (drinks.length === 0) return null;

    const isHot = drinks.includes('따뜻한 음료');
    const codes: string[] = [];

    if (drinks.includes('아이스 아메리카노') || drinks.includes('아메리카노')) codes.push('C');
    if (drinks.includes('복숭아 아이스티') || drinks.includes('아이스티')) codes.push('T');
    if (drinks.includes('페퍼민트')) codes.push('P');
    if (drinks.includes('얼그레이')) codes.push('E');
    if (drinks.includes('카라멜 블랙티') || drinks.includes('캬라멜블랙티') || drinks.includes('카라멜블랙티')) codes.push('B');
    if (drinks.includes('물')) codes.push('W');
    
    if (codes.length === 0) return null;
    
    return codes.map(code => isHot ? code + 'H' : code).join(', ');
  };


  const runMatching = async () => {
    if (!selectedId) return;
    const user = auth.currentUser;
    if (!user) return toast.error("인증이 필요합니다.");

    setIsMatching(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/sessions/${selectedId}/match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "매칭 오류");

      toast.success(`매칭 완료: ${data.stats.coupleCount}쌍이 성사되었습니다.`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsMatching(false);
    }
  };

  // 3. 수정 모드 진입
  const openEditModal = (session: Session) => {
    setEditingId(session.id);
    // v8.2.3: 기존 '90~96년생' 또는 '90년생~96년생' 문자열 파싱
    const ageString = session.targetMaleAge || "94~01년생";
    const ages = ageString.replace(/년생/g, "").split("~");
    const ageStart = ages[0]?.trim() || "";
    const ageEnd = ages[1]?.trim() || "";

    setFormData({
      region: session.region,
      episodeNumber: String(session.episodeNumber),
      eventDate: format(session.eventDate, "yyyy-MM-dd"),
      eventTime: format(session.eventDate, "HH:mm"),
      venue: session.venue || "서면역 인근 프라이빗한 파티룸",
      venueAddress: session.venueAddress || "",
      price: Number(session.price || 0).toLocaleString(),
      ageStart,
      ageEnd,
      maxMale: String(session.maxMale),
      maxFemale: String(session.maxFemale),
      status: session.status,
      openChatLink: session.openChatLink || "",
      isTest: !!session.isTest, // v10.0.0: 테스트 기수 여부
    });
    setIsModalOpen(true);
  };

  // v8.2.3: 투표 설정 모달 열기
  const openConfigModal = (session: Session) => {
    if (session.voteConfig) {
      setConfigFormData({
        maxSelection: session.voteConfig.maxSelection || 3,
        questionText:
          session.voteConfig.questionText ||
          "오늘 가장 호감 갔던 이성을 3명까지 골라주세요.",
        showReason: !!session.voteConfig.showReason,
        resultVisibility: session.voteConfig.resultVisibility || "all",
        q1Label: session.voteConfig.q1Label || "실명을 적어주세요",
        q2Label: session.voteConfig.q2Label || "본인의 호를 체크해주세요",
        q3Label: session.voteConfig.q3Label || "호감가는 이성 선택",
        q4Label:
          session.voteConfig.q4Label ||
          "매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?",
        q5Label: session.voteConfig.q5Label || "후기",
      });
    } else {
      setConfigFormData({
        maxSelection: 3,
        questionText: "오늘 가장 호감 갔던 이성을 3명까지 골라주세요.",
        showReason: false,
        resultVisibility: "all",
        q1Label: "실명을 적어주세요",
        q2Label: "본인의 호를 체크해주세요",
        q3Label: "호감가는 이성 선택",
        q4Label: "매칭 오류 방지를 위해 최종 라인업 및 메모를 확인하셨나요?",
        q5Label: "후기",
      });
    }
    setIsConfigModalOpen(true);
  };

  const handleOpenVotingStatus = (session: Session) => {
    setVotingStatusModalOpen(true);
  };

  const handleOpenReviews = async (session: Session) => {
    setReviewModalOpen(true);
    setReviewsLoading(true);
    try {
      const votes = await getAllVotesBySession(session.id);
      const list = votes
        .filter(v => v.feedback && v.feedback.trim())
        .map(v => {
          const app = participants.find(p => p.userId === v.userId);
          return {
            name: app?.name || '익명',
            gender: app?.gender || 'unknown',
            slotNumber: app?.slotNumber || 0,
            content: v.feedback || ''
          };
        })
        .sort((a, b) => {
          if (a.gender !== b.gender) return a.gender === 'male' ? -1 : 1;
          return a.slotNumber - b.slotNumber;
        });
      setReviewList(list);
    } catch (e) {
      console.error(e);
      toast.error('후기를 불러오는데 실패했습니다.');
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedId) return;
    setIsConfigSaving(true);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "sessions", selectedId), {
        voteConfig: configFormData,
      });
      toast.success("설정이 저장되었습니다.");
      setIsConfigModalOpen(false);
    } catch (e) {
      toast.error("설정 저장 중 오류 발생");
    } finally {
      setIsConfigSaving(false);
    }
  };

  // 4. 삭제 처리
  const handleDeleteSession = async (id: string, name: string) => {
    const sessionToDelete = sessions.find(s => s.id === id);
    if (!sessionToDelete) {
      toast.error("기수 정보를 찾을 수 없습니다.");
      return;
    }

    if (
      !window.confirm(
        `[${name}] 정말 이 기수를 삭제하시겠습니까?\n삭제 후에는 126기가 125기가 되는 등 이후 기수 번호가 자동으로 앞당겨집니다.`,
      )
    )
      return;

    try {
      const { writeBatch, getDocs, updateDoc } = await import("firebase/firestore");
      const batch = writeBatch(db);

      // 1. 대상 기수 삭제
      batch.delete(doc(db, "sessions", id));

      // 2. 이후 기수들 번호 조정 (동일 지역, 더 높은 기수 번호) - 복합 색인(Index) 에러 방지를 위해 클라이언트 필터링 적용
      const q = query(
        collection(db, "sessions"),
        where("region", "==", sessionToDelete.region)
      );
      const snap = await getDocs(q);

      snap.docs
        .filter((d) => (d.data().episodeNumber || 0) > sessionToDelete.episodeNumber)
        .forEach((d) => {
          const data = d.data();
          const newEpisodeNumber = (data.episodeNumber || 0) - 1;
          const newTitle = `${data.region === "busan" ? "부산" : "창원"} 로테이션 소개팅 ${newEpisodeNumber}기`;

          batch.update(d.ref, {
            episodeNumber: newEpisodeNumber,
            title: newTitle,
            updatedAt: serverTimestamp(),
          });
        });

      await batch.commit();
      toast.success("기수가 삭제되었으며, 이후 기수 번호가 조정되었습니다.");
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      console.error(err);
      toast.error("삭제 및 번호 조정 중 오류 발생: " + err.message);
    }
  };

  // 4.4.1 기수 취소 처리 — 지원자를 users.cancelledSessionHistory에 기록
  const handleCancelSession = async (session: Session) => {
    const regionLabel = session.region === 'busan' ? '부산' : '창원';
    const sessionTitle = `${regionLabel} 로테이션 소개팅 ${session.episodeNumber}기`;

    if (!window.confirm(
      `[${sessionTitle}]을 취소 처리하시겠습니까?\n\n지원·확정된 회원들이 '우선 대기풀'에 자동으로 등록됩니다.\n기수 데이터는 삭제되지 않고 '취소됨' 상태로 보존됩니다.`
    )) return;

    try {
      const { getDocs, writeBatch, arrayUnion } = await import('firebase/firestore');
      // arrayUnion() 내부 객체에는 serverTimestamp() 사용 불가 → Timestamp.now() 사용
      const cancelledAt = Timestamp.now();

      // eventDate 포맷팅 (MM.dd)
      let sessionDateStr = '';
      if (session.eventDate) {
        try {
          const dateObj = (session.eventDate as any).toDate 
            ? (session.eventDate as any).toDate() 
            : new Date(session.eventDate);
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          sessionDateStr = `${month}.${day}`;
        } catch (e) {
          console.error("Failed to parse eventDate:", e);
        }
      }

      // 1. 해당 기수에 지원·확정된 신청자 목록 조회
      const appSnap = await getDocs(
        query(collection(db, 'applications'), where('sessionId', '==', session.id))
      );
      const eligibleApps = appSnap.docs.filter(d => {
        const status = d.data().status;
        return status === 'applied' || status === 'confirmed' || status === 'selected';
      });

      // 2. Batch write: 각 회원의 cancelledSessionHistory에 이력 추가 + 기수 상태 cancelled로 변경
      const batch = writeBatch(db);

      // 기수 상태를 cancelled로 (최상위 필드는 serverTimestamp() 사용 가능)
      batch.update(doc(db, 'sessions', session.id), {
        status: 'cancelled' as SessionStatus,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 각 지원자 회원 문서에 취소 이력 기록
      const userIds = new Set<string>();
      eligibleApps.forEach(appDoc => {
        const data = appDoc.data();
        if (!data.userId) return;
        userIds.add(data.userId);
      });

      eligibleApps.forEach(appDoc => {
        const data = appDoc.data();
        if (!data.userId) return;
        const userRef = doc(db, 'users', data.userId);
        batch.update(userRef, {
          // arrayUnion 내부 객체는 Timestamp.now() 사용 (serverTimestamp 불가)
          cancelledSessionHistory: arrayUnion({
            sessionId: session.id,
            sessionTitle,
            sessionDate: sessionDateStr,
            applicationStatus: data.status,
            cancelledAt,          // Timestamp.now()
          }),
          updatedAt: serverTimestamp(), // 최상위 필드는 serverTimestamp() 사용 가능
        });
      });

      // 3. 이후 기수들 번호 조정 (동일 지역, 더 높은 기수 번호)
      const qSessions = query(
        collection(db, "sessions"),
        where("region", "==", session.region)
      );
      const sessionSnap = await getDocs(qSessions);

      sessionSnap.docs
        .filter((d) => d.id !== session.id && (d.data().episodeNumber || 0) > session.episodeNumber)
        .forEach((d) => {
          const data = d.data();
          const newEpisodeNumber = (data.episodeNumber || 0) - 1;
          const newTitle = `${data.region === "busan" ? "부산" : "창원"} 로테이션 소개팅 ${newEpisodeNumber}기`;

          batch.update(d.ref, {
            episodeNumber: newEpisodeNumber,
            title: newTitle,
            updatedAt: serverTimestamp(),
          });
        });

      await batch.commit();
      toast.success(`${sessionTitle} 취소 처리 및 이후 기수 번호 조정 완료. ${userIds.size}명이 우선 대기풀에 등록되었습니다.`);
    } catch (err: any) {
      console.error(err);
      toast.error('기수 취소 처리 중 오류 발생: ' + err.message);
    }
  };

  // 4.5. 기수 수동 종료 처리
  const handleEndSession = async (session: Session) => {
    if (
      !window.confirm(
        `정말로 [${session.region === "busan" ? "부산" : "창원"} ${session.episodeNumber}기] 행사를 종료하시겠습니까?\n종료 시 24시간이 경과하지 않았더라도 메인 기수 목록 카드에서 자동으로 숨겨집니다.`
      )
    )
      return;

    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      selectedIdRef.current = null;
      setSelectedId(null);
      await updateDoc(doc(db, "sessions", session.id), {
        isForceHidden: true
      });
      toast.success("행사가 강제 종료되어 카드 목록에서 숨겨졌습니다.");
    } catch (err: any) {
      console.error(err);
      toast.error("행사 종료 처리 중 오류 발생: " + err.message);
    }
  };

  // 5. 서버에 저장/수정 실행
  const handleSubmitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.episodeNumber || !formData.eventDate || !formData.venue) {
      toast.error("필수 항목을 모두 입력해 주세요.");
      return;
    }

    const [year, month, day] = formData.eventDate.split("-");
    const [h, m] = formData.eventTime.split(":");
    const combinedDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(h),
      Number(m),
    );

    // v8.2.3: 콤마 제거 후 숫자로 변환
    const numericPrice = Number(formData.price.replace(/,/g, ""));
    // v8.2.3: 연령대 결합
    const combinedAge = `${formData.ageStart}~${formData.ageEnd}년생`;

    setIsSubmitting(true);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");

      const payload = {
        region: formData.region,
        episodeNumber: isNaN(Number(formData.episodeNumber)) ? formData.episodeNumber : Number(formData.episodeNumber),
        title: `${formData.region === "busan" ? "부산" : "창원"} 로테이션 소개팅 ${formData.episodeNumber}기${formData.isTest ? " (테스트)" : ""}`,
        eventDate: combinedDate,
        venue: formData.venue,
        location: formData.venue, // v8.6.2: 데이터 일관성을 위해 두 필드 모두 저장
        venueAddress: formData.venueAddress,
        price: numericPrice,
        originalPrice: numericPrice + 10000,
        targetMaleAge: combinedAge,
        targetFemaleAge: combinedAge, // 남성과 동일하게 설정
        maxMale: Number(formData.maxMale),
        maxFemale: Number(formData.maxFemale),
        status: formData.status,
        openChatLink: formData.openChatLink,
        isTest: !!formData.isTest, // v10.0.0: 테스트 기수 여부
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        // v8.2.3: 수정(Update) 로직
        const { updateDoc, doc } = await import("firebase/firestore");
        await updateDoc(doc(db, "sessions", editingId), payload);
        toast.success("기수 정보가 수정되었습니다.");
      } else {
        // v9.2.0: 신규 등록 및 자동 밀어내기(Shifting) 로직
        const { writeBatch, getDocs, collection, query, where, doc } = await import("firebase/firestore");
        const newEpNumber = Number(formData.episodeNumber);
        const batch = writeBatch(db);

        // 1. 이후 기수들 번호 조정 (동일 지역, 크거나 같은 기수 번호) - 복합 색인(Index) 에러 방지를 위해 클라이언트 필터링 적용
        // 단, 신규 기수가 테스트 기수일 경우에는 다른 기수들의 번호 이동을 건너뜁니다.
        if (!formData.isTest) {
          const qShift = query(
            collection(db, "sessions"),
            where("region", "==", formData.region)
          );
          const snapShift = await getDocs(qShift);

          snapShift.docs
            .filter((d) => (d.data().episodeNumber || 0) >= newEpNumber && !d.data().isTest)
            .forEach((d) => {
              const data = d.data();
              const shiftedEp = (data.episodeNumber || 0) + 1;
              const shiftedTitle = `${data.region === "busan" ? "부산" : "창원"} 로테이션 소개팅 ${shiftedEp}기`;
              batch.update(d.ref, {
                episodeNumber: shiftedEp,
                title: shiftedTitle,
                updatedAt: serverTimestamp(),
              });
            });
        }

        // 2. 신규 기수 추가
        // 글로벌 템플릿 로드
        const template = await getVoteConfigTemplate();
        
        const newSessionRef = doc(collection(db, "sessions"));
        batch.set(newSessionRef, {
          ...payload,
          currentMale: 0,
          currentFemale: 0,
          votingUnlockedAt: null,
          createdAt: serverTimestamp(),
          ...(template && { voteConfig: template }),
        });

        await batch.commit();
        toast.success(formData.isTest ? "테스트 기수가 등록되었습니다." : "새 기수가 등록되었으며, 번호가 자동 정렬되었습니다.");
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormData);
    } catch (err: any) {
      console.error(err);
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // v9.0.0: 메모 저장 핸들러
  const handleOpenMemo = (app: Application) => {
    setMemoTargetApp(app);
    setMemoContent(app.adminMemo || "");
    setMemoModalOpen(true);
  };

  const handleUserUpdate = useCallback((updatedUser: any) => {
    const userId = updatedUser.id || updatedUser.uid;
    if (userId) {
      setUserMap(prev => ({
        ...prev,
        [userId]: updatedUser
      }));
    }
  }, []);

  const handleSaveMemo = async () => {
    if (!memoTargetApp) return;
    setIsMemoSaving(true);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "applications", memoTargetApp.id), {
        adminMemo: memoContent,
        updatedAt: serverTimestamp(),
      });
      toast.success("메모가 저장되었습니다.");
      setMemoModalOpen(false);
      setMemoTargetApp(null);
      setMemoContent("");
    } catch (err: any) {
      console.error(err);
      toast.error("메모 저장 중 오류 발생");
    } finally {
      setIsMemoSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-[#FF6F61]" size={32} />
      </div>
    );
  }

  // v8.2.3: globalCounts에서 실시간 집계 데이터 추출 (선발확정 + 입금대기 포함)
  const liveStats = globalCounts[selectedId || ""] || { male: 0, female: 0 };
  const liveConfirmedMale = liveStats.male;
  const liveConfirmedFemale = liveStats.female;
  const maleRatio = active
    ? Math.round((liveConfirmedMale / (active.maxMale || 1)) * 100)
    : 0;
  const femaleRatio = active
    ? Math.round((liveConfirmedFemale / (active.maxFemale || 1)) * 100)
    : 0;
  const isDetailFull = active
    ? liveConfirmedMale + liveConfirmedFemale >=
    active.maxMale + active.maxFemale
    : false;

  let activeBadgeLabel = "";
  let activeBadgeCls = "";
  if (active) {
    const now = new Date();
    const twentyFourHoursAfter = new Date(active.eventDate.getTime() + 24 * 60 * 60 * 1000);
    const isEnded = active.isForceHidden || now >= twentyFourHoursAfter;
    activeBadgeLabel = isEnded ? '종료' : now >= active.eventDate ? '진행 중' : isDetailFull ? '마감' : '모집 중';
    activeBadgeCls = isEnded ? 'bg-slate-100 text-slate-500' : now >= active.eventDate ? 'bg-blue-100 text-blue-700' : isDetailFull ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700';
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-400">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 text-xl font-bold">행사 / 매칭 관리</h2>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData(initialFormData);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg transition-transform hover:scale-105 px-[18px] py-[10px] text-[0.85rem] font-semibold bg-[#FF6F61] text-white shadow-[0_4px_12px_rgba(255,111,97,0.2)]"
        >
          <Plus size={16} /> 새 기수 등록
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "전체 기수",
            value: stats.total,
            icon: Calendar,
            iconBg: "bg-orange-100",
            iconColor: "text-[#FF6F61]",
            valColor: "text-[#FF6F61]",
            border: "border-orange-100",
          },
          {
            label: "모집 중",
            value: stats.open,
            icon: CheckCircle,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
            valColor: "text-emerald-600",
            border: "border-emerald-100",
          },
          {
            label: "총 참가자",
            value: stats.participants,
            icon: Users,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            valColor: "text-blue-600",
            border: "border-blue-100",
          },
          {
            label: "평균 매칭률",
            value: `${stats.rate}%`,
            icon: Heart,
            iconBg: "bg-pink-100",
            iconColor: "text-pink-500",
            valColor: "text-pink-500",
            border: "border-pink-100",
          },
        ].map((s, i) => (
          <div
            key={i}
            className={`bg-white border ${s.border} rounded-xl shadow-sm p-5 flex items-center gap-4`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}
            >
              <s.icon size={20} className={s.iconColor} />
            </div>
            <div>
              <p className={`text-2xl font-extrabold ${s.valColor}`}>
                {s.value}
              </p>
              <p className="text-[0.75rem] text-slate-400 font-medium mt-0.5">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {/* Event list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <p className="text-[0.75rem] font-bold text-slate-400 uppercase tracking-widest">
              기수 목록
            </p>
            <Link
              href="/admin/events/all"
              className="text-[0.7rem] font-bold px-3 py-1 rounded-full border bg-white text-slate-500 border-slate-300 hover:border-slate-400 transition-all"
            >
              전체 기수 보기
            </Link>
          </div>
          <div className="flex flex-row gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {sessions.filter((ev) => {
              if (selectedId === ev.id) return true;
              if (ev.status === 'cancelled') return false; // 취소된 기수는 보이지 않음
              const now = new Date();
              const twentyFourHoursAfter = new Date(ev.eventDate.getTime() + 24 * 60 * 60 * 1000);
              return now < twentyFourHoursAfter && !ev.isForceHidden;
            }).sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime()).map((ev) => {
              // v8.2.3: 전역 applicants 데이터 기반 실시간 집계 (선발 + 확정 합산)
              const isCancelled = ev.status === 'cancelled';
              const live = globalCounts[ev.id] || { male: 0, female: 0 };
              const total = live.male + live.female;
              const maxT = ev.maxMale + ev.maxFemale;
              const pct =
                maxT > 0 ? Math.min(100, Math.round((total / maxT) * 100)) : 0;
              const sel = selectedId === ev.id;
              const isOver = total >= maxT && maxT > 0; // v8.2.3 정원 초과 여부
              const now = new Date();
              const twentyFourHoursAfter = new Date(ev.eventDate.getTime() + 24 * 60 * 60 * 1000);
              const isEnded = ev.isForceHidden || now >= twentyFourHoursAfter;
              const badgeLabel = isCancelled ? '취소' : isEnded ? '종료' : now >= ev.eventDate ? '진행 중' : isOver ? '마감' : '모집 중';
              const badgeCls = isCancelled ? 'bg-amber-100 text-amber-600' : isEnded ? 'bg-slate-100 text-slate-500' : now >= ev.eventDate ? 'bg-blue-100 text-blue-700' : isOver ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700';

              // 디데이 계산
              const eventDay = new Date(ev.eventDate.getFullYear(), ev.eventDate.getMonth(), ev.eventDate.getDate());
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const diffTime = eventDay.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const showDDay = !isEnded && now < ev.eventDate;

              return (
                <button
                  key={ev.id}
                  onClick={() => {
                    setSelectedId(ev.id);
                    setActiveTab("participants");
                  }}
                  className={`shrink-0 w-52 text-left rounded-xl transition-all duration-150 p-4 ${
                    isCancelled
                      ? sel
                        ? "bg-amber-50 border-2 border-amber-300 shadow-md opacity-80"
                        : "bg-slate-50 border border-slate-200 opacity-60 hover:opacity-80"
                      : sel
                        ? "bg-orange-50 border-2 border-[#FF6F61] shadow-md shadow-orange-100"
                        : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className={`text-[0.9rem] font-bold flex items-center gap-1.5 ${sel ? "text-[#FF6F61]" : "text-slate-800"}`}
                    >
                      {ev.region === "busan" ? "부산" : "창원"}{" "}
                      {ev.episodeNumber}기
                      {showDDay && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                          diffDays === 0 
                            ? "bg-rose-100 text-rose-700 border-rose-200 animate-pulse" 
                            : diffDays <= 3 
                              ? "bg-amber-50 text-amber-600 border-amber-200" 
                              : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                          {diffDays === 0 ? "D-Day" : `D-${diffDays}`}
                        </span>
                      )}
                      {ev.isTest && (
                        <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                          테스트
                        </span>
                      )}
                    </p>
                    <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  <p className="flex items-center gap-1 text-[0.75rem] text-slate-400 mb-3">
                    <Calendar size={12} />{" "}
                    {format(ev.eventDate, "MM. dd (E) HH:mm", { locale: ko })}
                  </p>
                  {ev.targetMaleAge && (
                    <p className="flex items-center gap-1 text-[0.68rem] text-blue-400 font-semibold mb-2">
                      <span className="text-[0.6rem]">👨</span>
                      {ev.targetMaleAge}
                    </p>
                  )}
                  <div
                    className={`flex justify-between mb-1.5 text-[0.7rem] font-semibold ${isOver ? "text-red-500" : "text-slate-500"}`}
                  >
                    <span className={isOver ? "animate-pulse" : ""}>
                      {total} / {maxT}명
                    </span>
                    <span
                      className={
                        isOver
                          ? "text-red-500"
                          : sel
                            ? "text-[#FF6F61]"
                            : "text-slate-400"
                      }
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : sel ? "bg-[#FF6F61]" : "bg-slate-300"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-6" ref={detailPanelRef}>
          {active ? (
            <>
              {/* 탭 네비게이션 */}
              <div className={card}>
                {/* 기수 헤더 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 sm:px-7 py-5 border-b border-slate-100 bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                      <Calendar size={24} className="text-[#FF6F61]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-slate-900 text-xl font-black tracking-tight flex items-center gap-1.5">
                          {active.region === "busan" ? "부산" : "창원"}{" "}
                          {active.episodeNumber}기
                          {active.isTest && (
                            <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                              테스트
                            </span>
                          )}
                        </h3>
                        <span className={`text-[0.65rem] font-black px-2 py-0.5 rounded-full ${activeBadgeCls}`}>
                          {activeBadgeLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] font-bold text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          {format(active.eventDate, "MM. dd (E) HH:mm", { locale: ko })}
                        </span>
                        <span className="hidden sm:inline text-slate-200">|</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          {active.venue || "서면역 인근"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* v10.3.0: 모바일/태블릿 가로 스크롤 대응 및 통합 액션 헤더 패치 */}
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar pb-1.5 sm:pb-0 scroll-smooth shrink-0 w-full sm:w-auto sm:overflow-x-visible">
                    <button
                      onClick={() => toggleVotingForm(active.status === "voting" ? "closed" : "voting")}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${active.status === "voting" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}
                      title="투표 열기/닫기"
                    >
                      <Heart size={13} fill={active.status === "voting" ? "currentColor" : "none"} />
                      {active.status === "voting" ? "투표 중" : "투표 열기"}
                    </button>
                    <button
                      onClick={() => handleOpenVotingStatus(active)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-all shrink-0"
                      title="실시간 투표 현황"
                    >
                      <BarChart3 size={13} /> 현황
                    </button>
                    <button
                      onClick={() => setMatchingDrawerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-pink-200 text-xs font-bold text-pink-600 hover:bg-pink-50 transition-all shrink-0"
                      title="매칭 결과 확인"
                    >
                      <Trophy size={13} /> 결과
                    </button>
                    <button
                      onClick={() => handleOpenReviews(active)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-orange-200 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all shrink-0"
                      title="후기 모음"
                    >
                      <MessageSquare size={13} /> 후기
                    </button>

                    <button
                      onClick={() => handleEndSession(active)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-purple-200 text-xs font-bold text-purple-600 hover:bg-purple-50 transition-all shrink-0"
                      title="행사 강제 종료 및 숨김"
                    >
                      <StopCircle size={13} /> 종료
                    </button>

                    {/* 데스크톱/패드 전용 세로 구분선 */}
                    <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1 shrink-0" />

                    {/* 🌑 다크템플러 참여/해제 토글 버튼 - super_admin에게만 표시 */}
                    {isSuperAdmin && (() => {
                      const alreadyJoined = applicants.some(a => a.userId === auth.currentUser?.uid && a.isDarkTemplar);
                      return (
                        <button
                          onClick={() => alreadyJoined ? handleDarkTemplarLeave(active.id) : handleDarkTemplarJoin(active.id)}
                          disabled={isDarkTemplarJoining}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            alreadyJoined
                              ? 'bg-violet-100 border border-violet-300 text-violet-700 hover:bg-violet-200'
                              : 'bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200'
                          }`}
                          title={alreadyJoined ? '클릭 시 다크템플러 참여 해제' : '다크템플러로 참여'}
                        >
                          {isDarkTemplarJoining ? (
                            <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                          ) : (
                            <span className="text-sm">🌑</span>
                          )}
                          {alreadyJoined ? '참여중' : '다크템플러'}
                        </button>
                      );
                    })()}

                    <button
                      onClick={() => openEditModal(active)}
                      className="flex items-center gap-1.5 rounded-xl transition-all px-4 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300 shrink-0"
                    >
                      <Edit2 size={13} /> 수정
                    </button>
                    {/* 기수 취소 — super_admin 전용, 이미 취소된 기수는 버튼 숨김 */}
                    {isSuperAdmin && active.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelSession(active)}
                        className="flex items-center gap-1.5 rounded-xl transition-all px-4 py-2 bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 shrink-0"
                        title="기수를 취소하고 지원자를 우선 대기풀에 등록합니다"
                      >
                        <StopCircle size={13} /> 기수 취소
                      </button>
                    )}
                    {active.status === 'cancelled' && (
                      <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-400">
                        <StopCircle size={13} /> 취소된 기수
                      </span>
                    )}
                    <button
                      onClick={() =>
                        handleDeleteSession(
                          active.id,
                          `${active.region === "busan" ? "부산" : "창원"} ${active.episodeNumber}기`,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl transition-all px-4 py-2 bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-100 shrink-0"
                    >
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                </div>

                {/* 탭 버튼 */}
                <div className="flex border-b border-slate-100 px-4 overflow-x-auto sm:overflow-x-visible gap-1">
                  {(
                    [
                      {
                        key: "participants",
                        label: `참가자 ${realParticipants.length}명`,
                        icon: UserCheck,
                      },
                      {
                        key: "waitlist",
                        label: `대기자 ${realWaitlisted.length}명`,
                        icon: Clock,
                      },
                      { key: "stats", label: "매칭 통계", icon: Zap },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-[0.8rem] font-bold transition-all relative shrink-0 border-b-2 -mb-px ${activeTab === tab.key
                        ? "text-[#FF6F61] border-[#FF6F61]"
                        : "text-slate-400 border-transparent hover:text-slate-600"
                        }`}
                    >
                      <tab.icon size={13} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 탭 컨텐츠 */}
                <div className="p-3 sm:p-7">

                  {/* 참가자 탭 */}
                  {activeTab === "participants" && (
                    <div className="space-y-4">
                      {/* 헤더 */}
                      <div className="flex items-center justify-between pl-1">
                        <h3 className="flex items-center gap-2 text-slate-800 text-[0.95rem] font-extrabold">
                          <ListChecks size={16} className="text-[#FF6F61]" />
                          참가 명단
                          <span className="text-[0.75rem] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF6F61] ml-1">
                            총 {realParticipants.length}명 (
                            {
                              realParticipants.filter((a) => a.gender === "male")
                                .length
                            }
                            남 /{" "}
                            {
                              realParticipants.filter((a) => a.gender === "female")
                                .length
                            }
                            여)
                          </span>
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setInstagramModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6F61]/10 text-[#FF6F61] rounded-lg text-[0.75rem] font-bold hover:bg-[#FF6F61]/20 transition-colors"
                          >
                            💭 이상형 피드 추출
                          </button>
                          {applicantsLoading && (
                            <Loader2
                              className="animate-spin text-slate-400"
                              size={16}
                            />
                          )}
                        </div>
                      </div>

                      {/* 출석 및 음료 요약 */}
                      {participants.length > 0 && (() => {
                        const realParticipants = participants.filter(app => {
                          const user = userMap[app.userId] || {};
                          return !(app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true);
                        });
                        
                        return (
                          <div className="flex flex-col sm:flex-row gap-3 px-1 py-1">
                            <div className="flex items-center gap-3 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                              <span className="text-[0.7rem] font-bold text-green-700">출석 현황</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-blue-600 bg-white/50 px-1.5 py-0.5 rounded">
                                  남 {realParticipants.filter(a => a.gender === 'male' && a.attended).length}/{realParticipants.filter(a => a.gender === 'male').length}
                                </span>
                                <span className="text-xs font-black text-pink-600 bg-white/50 px-1.5 py-0.5 rounded">
                                  여 {realParticipants.filter(a => a.gender === 'female' && a.attended).length}/{realParticipants.filter(a => a.gender === 'female').length}
                                </span>
                              </div>
                            </div>
                            {(() => {
                              const drinkCounts = realParticipants.reduce((acc, p) => {
                                if (p.attendanceStatus === 'no-show') return acc;
                                const code = getDrinkCode(p.drink);
                                if (code) {
                                  code.split(', ').forEach(c => {
                                    acc[c] = (acc[c] || 0) + 1;
                                  });
                                }
                                return acc;
                              }, {} as Record<string, number>);
                              
                              const codes = Object.keys(drinkCounts).sort();
                              if (codes.length === 0) return null;
                              
                              return (
                                <div className="flex items-center flex-wrap gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                  <span className="text-[0.7rem] font-bold text-blue-700 mr-1">음료 요약</span>
                                  {codes.map(c => {
                                    const totalForDrink = realParticipants.filter(p => {
                                      if (p.attendanceStatus === 'no-show') return false;
                                      const code = getDrinkCode(p.drink);
                                      return code && code.split(', ').includes(c);
                                    });
                                    const servedCount = totalForDrink.filter(p => (p as any).drinkServed).length;
                                    const isAllServed = totalForDrink.length > 0 && servedCount === totalForDrink.length;

                                    return (
                                      <button 
                                        key={c} 
                                        onClick={() => { setSelectedDrinkCode(c); setDrinkModalOpen(true); }}
                                        className={`flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded shadow-sm transition-all hover:-translate-y-0.5 ${
                                          isAllServed ? 'bg-green-500 text-white shadow-green-200' : 'bg-white text-blue-600 shadow-blue-100 hover:bg-blue-50'
                                        }`}
                                      >
                                        {c} {drinkCounts[c]}
                                        {isAllServed && <CheckCircle2 size={12} className="ml-0.5" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* v8.15.3: 로딩 중일 때 명단이 사라지는 '번쩍' 현상 방지 및 레이아웃 유지 */}
                      {(!applicantsLoading && applicants.length === 0) ? (
                        <div
                          className={`py-12 text-center text-slate-400 font-medium text-sm ${card}`}
                        >
                          신청자가 없습니다.
                        </div>
                      ) : (
                        <div
                          className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-all duration-300 ${applicantsLoading ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}
                          style={{ minHeight: '200px' }} // 로딩 중에도 높이 유지
                        >
                          {(["male", "female"] as const).map((gender) => {
                            const genderList = participants.filter(
                              (a) => a.gender === gender,
                            );
                            const isMaleSection = gender === "male";
                            return (
                              <div
                                key={gender}
                                className={`${card} overflow-hidden`}
                              >
                                <div
                                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 ${isMaleSection ? "bg-blue-50" : "bg-pink-50"}`}
                                >
                                  <span
                                    className={`text-[0.85rem] font-extrabold ${isMaleSection ? "text-blue-700" : "text-pink-700"}`}
                                  >
                                    {isMaleSection ? "👨 남성" : "👩 여성"}{" "}
                                    참가자
                                  </span>
                                  <span
                                    className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-full ${isMaleSection ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}
                                  >
                                    {genderList.filter(a => !a.isDarkTemplar).length}명
                                  </span>
                                </div>
                                {(() => {
                                  const maxSlots = isMaleSection
                                    ? (active?.maxMale ?? 0)
                                    : (active?.maxFemale ?? 0);
                                  const slots: { slotNum: number, app: any }[] = [];
                                  for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
                                    const appsInSlot = genderList.filter(a => a.slotNumber === slotNum);
                                    const realApp = appsInSlot.find(a => !isDummyApp(a));
                                    slots.push({ slotNum, app: realApp });
                                  }
                                  
                                  const allDummies = genderList.filter(a => isDummyApp(a));
                                  allDummies.forEach(d => slots.push({ slotNum: 0, app: d }));
                                  
                                  slots.sort((a, b) => {
                                    const getPriority = (slot: {slotNum: number, app: any}) => {
                                      if (!slot.app) return 1; // 빈 자리는 실제 참가자와 동일한 우선순위(번호순 정렬)
                                      const user = userMap[slot.app.userId] || {};
                                      const isDummy = slot.app.id?.startsWith('dummy') || slot.app.userId?.startsWith('user_m_') || slot.app.userId?.startsWith('user_f_') || user.isDummy === true;
                                      return isDummy ? 2 : 1; // 더미는 무조건 맨 아래로
                                    };
                                    const prioA = getPriority(a);
                                    const prioB = getPriority(b);
                                    if (prioA !== prioB) return prioA - prioB;
                                    return a.slotNum - b.slotNum;
                                  });
                                  // slotNumber 없는 confirmed 참가자 (더미 제외, 마이그레이션 전 데이터)
                                  const unassigned = genderList.filter(
                                    (a) => !a.slotNumber && !isDummyApp(a),
                                  ).sort((a, b) => {
                                    const userA = userMap[a.userId] || {};
                                    const userB = userMap[b.userId] || {};
                                    const isDummyA = a.id?.startsWith('dummy') || a.userId?.startsWith('user_m_') || a.userId?.startsWith('user_f_') || userA.isDummy === true;
                                    const isDummyB = b.id?.startsWith('dummy') || b.userId?.startsWith('user_m_') || b.userId?.startsWith('user_f_') || userB.isDummy === true;
                                    
                                    if (isDummyA !== isDummyB) return isDummyA ? 1 : -1;
                                    return a.appliedAt.getTime() - b.appliedAt.getTime();
                                  });
                                  const statusMap: Record<
                                    string,
                                    { label: string; cls: string }
                                  > = {
                                    applied: {
                                      label: "검토 중",
                                      cls: "bg-amber-50 text-amber-800",
                                    },
                                    selected: {
                                      label: "입금 대기",
                                      cls: "bg-violet-50 text-violet-800",
                                    },
                                    confirmed: {
                                      label: "참가 확정",
                                      cls: "bg-emerald-50 text-emerald-700",
                                    },
                                    cancelled: {
                                      label: "취소",
                                      cls: "bg-slate-100 text-slate-400",
                                    },
                                  };

                                  return (
                                    <div className="divide-y divide-slate-100">
                                      {slots.map(({ slotNum, app }) => {
                                        const birthYear = app ? getBirthYear(app) : "-";
                                        const displayJob = app ? getEffectiveJob(app) : "-";
                                        if (!app)
                                          return (
                                            <div
                                              key={`empty-${slotNum}`}
                                              className="flex items-center gap-3 px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-50/60"
                                            >
                                              <div className="flex flex-col items-center w-8 shrink-0">
                                                <span className={`text-xs font-black ${isMaleSection ? "text-blue-400" : "text-pink-400"}`}>
                                                  {slotNum}호
                                                </span>
                                              </div>
                                              <span className="text-xs text-slate-300 font-medium">
                                                미정
                                              </span>
                                            </div>
                                          );
                                        const isOverQuota = overQuotaAppIds.has(
                                          app.id,
                                        );
                                        const badge = statusMap[app.status] ?? {
                                          label: app.status,
                                          cls: "bg-slate-100 text-slate-400",
                                        };
                                        return (
                                          <div
                                            key={app.id}
                                            className={`flex flex-col gap-1 px-5 py-3 transition-all duration-200 border-b border-slate-100/60 ${app.isDarkTemplar ? "bg-violet-50/60 hover:bg-violet-50 border-l-4 border-l-violet-400" : isOverQuota ? "bg-red-50/50 animate-pulse" : app.attendanceStatus === 'present' ? "bg-emerald-50/15 hover:bg-emerald-50/30 border-l-4 border-l-emerald-500 shadow-sm shadow-emerald-100/50" : app.attendanceStatus === 'late' ? "bg-amber-50/15 hover:bg-amber-50/30 border-l-4 border-l-amber-500 shadow-sm shadow-amber-100/50" : app.attendanceStatus === 'no-show' ? "bg-rose-50/15 hover:bg-rose-50/30 border-l-4 border-l-rose-500 shadow-sm shadow-rose-100/50" : (userMap[app.userId]?.noShowCount > 0 ? "bg-rose-50/30 hover:bg-rose-50/50 border-l-4 border-l-rose-300" : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent")}`}
                                          >
                                            {/* Row 1: 슬롯+이름+뱃지 (왼쪽) | 출석/지각/노쇼/💸환불 칩 (오른쪽 끝) */}
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <div className="relative flex flex-col items-center w-8 shrink-0">
                                                  <button
                                                    onClick={() => setSlotMoveOpenId(slotMoveOpenId === app.id ? null : app.id)}
                                                    title="호수 변경"
                                                    className={`text-xs font-black leading-none px-1 py-0.5 rounded hover:bg-slate-100 transition-colors ${isMaleSection ? "text-blue-500" : "text-pink-500"}`}
                                                  >
                                                    {isDummyApp(app) ? "-" : `${slotNum}호`}
                                                  </button>
                                                  {getDrinkCode(app.drink) && (
                                                    <span className="text-[0.6rem] font-black text-blue-600 leading-none mt-0.5">
                                                      {getDrinkCode(app.drink)}
                                                    </span>
                                                  )}
                                                  {/* 빈 슬롯 선택 드롭다운 */}
                                                  {slotMoveOpenId === app.id && (() => {
                                                    const maxSlots = isMaleSection ? (active?.maxMale ?? 0) : (active?.maxFemale ?? 0);
                                                    const usedSlots = new Set(genderList.filter((a: Application) => !isDummyApp(a)).map((a: Application) => a.slotNumber).filter(Boolean));
                                                    const emptySlots = Array.from({ length: maxSlots }, (_, i) => i + 1).filter(s => !usedSlots.has(s));
                                                    if (emptySlots.length === 0) return <div className="absolute top-7 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2 text-[0.65rem] text-slate-400 whitespace-nowrap">빈 자리 없음</div>;
                                                    return (
                                                      <div className="absolute top-7 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[72px]">
                                                        <p className="text-[0.6rem] text-slate-400 font-bold px-3 pt-1 pb-0.5">이동할 호수</p>
                                                        {emptySlots.map(s => (
                                                          <button
                                                            key={s}
                                                            onClick={() => handleMoveSlot(app, s)}
                                                            className={`w-full text-left px-3 py-1 text-xs font-bold hover:bg-slate-50 transition-colors ${isMaleSection ? "text-blue-600" : "text-pink-600"}`}
                                                          >
                                                            {s}호
                                                          </button>
                                                        ))}
                                                      </div>
                                                    );
                                                  })()}
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
                                                  <span
                                                    onClick={() => {
                                                      const user = userMap[app.userId] || { id: app.userId, name: app.name, phone: app.phone, gender: app.gender };
                                                      setSelectedUser(user);
                                                      setIsProfileModalOpen(true);
                                                    }}
                                                    className="text-sm font-bold text-slate-800 whitespace-nowrap shrink-0 cursor-pointer hover:text-[#FF7E7E] transition-colors"
                                                  >
                                                    {app.name || "-"}
                                                  </span>
                                                  {(app.userId?.startsWith("user_m_") || app.userId?.startsWith("user_f_") || app.id?.startsWith("dummy_")) && (
                                                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">더미</span>
                                                  )}
                                                  {app.isDarkTemplar && (
                                                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-300 shrink-0" title="다크템플러 - 매칭 제외">🌑다크</span>
                                                  )}
                                                  {(() => {
                                                    const u = userMap[app.userId];
                                                    const ns = u?.noShowCount || 0;
                                                    const td = u?.tardyCount || 0;
                                                    if (ns === 0 && td === 0) return null;
                                                    return (
                                                      <>
                                                        {ns > 0 && <span className="text-[0.58rem] font-black px-1 py-0.5 rounded bg-rose-100 text-rose-600 border border-rose-200 shrink-0 whitespace-nowrap">🚨{ns}</span>}
                                                        {td > 0 && <span className="text-[0.58rem] font-black px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap">⏳{td}</span>}
                                                      </>
                                                    );
                                                  })()}
                                                </div>
                                              </div>
                                              {/* 출석/지각/노쇼/💸환불 칩 — 오른쪽 끝 (PC·모바일 공통) */}
                                              <div className="flex items-center gap-0.5 bg-slate-50 px-1 py-0.5 rounded-xl border border-slate-200/60 shrink-0">
                                                <button
                                                  onClick={() => handleSetAttendanceStatus(app, app.attendanceStatus === 'present' ? 'none' : 'present')}
                                                  className={`px-2 py-0.5 rounded-lg text-[0.6rem] font-bold transition-all ${app.attendanceStatus === 'present' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}`}
                                                >출석</button>
                                                <button
                                                  onClick={() => handleSetAttendanceStatus(app, app.attendanceStatus === 'late' ? 'none' : 'late')}
                                                  className={`px-2 py-0.5 rounded-lg text-[0.6rem] font-bold transition-all ${app.attendanceStatus === 'late' ? "bg-amber-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}`}
                                                >지각</button>
                                                <button
                                                  onClick={() => handleSetAttendanceStatus(app, app.attendanceStatus === 'no-show' ? 'none' : 'no-show')}
                                                  className={`px-2 py-0.5 rounded-lg text-[0.6rem] font-bold transition-all ${app.attendanceStatus === 'no-show' ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}`}
                                                >노쇼</button>
                                                <button
                                                  onClick={() => handleToggleRefundDeposit(app)}
                                                  title={(app.isRefundDeposit || app.isManualRefund) ? '환불 대상 해제' : '환불 대상으로 설정'}
                                                  className={`px-2 py-0.5 rounded-lg text-[0.6rem] font-bold transition-all ${(app.isRefundDeposit || app.isManualRefund) ? "bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}`}
                                                >💸</button>
                                              </div>
                                            </div>

                                            {/* Row 2: 나이/직업/전화 (왼쪽) | 메모/문자/선발취소 (오른쪽 끝) */}
                                            <div className="flex flex-col gap-0.5 ml-10">
                                              <div className="flex items-center justify-between gap-2 text-[0.72rem] text-slate-600 font-bold w-full">
                                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                                  <span className="whitespace-nowrap">{birthYear}</span>
                                                  <span className="text-slate-300">·</span>
                                                  <span className="flex items-center gap-1 min-w-0">
                                                    {isDummyApp(app) ? (
                                                      editingAppJobId === app.id ? (
                                                        <input
                                                          autoFocus
                                                          value={tempAppJobValue}
                                                          onChange={(e) => setTempAppJobValue(e.target.value)}
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleEditAppJob(app, tempAppJobValue);
                                                            if (e.key === 'Escape') setEditingAppJobId(null);
                                                          }}
                                                          onBlur={() => setEditingAppJobId(null)}
                                                          className="text-[0.72rem] font-bold bg-white border border-blue-400 rounded px-1 outline-none w-[100px]"
                                                        />
                                                      ) : (
                                                        <span
                                                          onClick={() => { setEditingAppJobId(app.id); setTempAppJobValue(displayJob); }}
                                                          className="truncate max-w-[160px] cursor-pointer hover:text-blue-500 hover:underline"
                                                          title={displayJob}
                                                        >{displayJob}</span>
                                                      )
                                                    ) : (
                                                      <span className="truncate max-w-[160px]" title={displayJob}>{displayJob}</span>
                                                    )}
                                                  </span>
                                                  <span className="text-slate-300">·</span>
                                                  <span className="whitespace-nowrap">{app.residence || "-"}</span>
                                                </div>
                                                {/* 메모/문자/선발취소 — 오른쪽 끝 (PC·모바일 공통) */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  <button
                                                    onClick={() => handleOpenMemo(app)}
                                                    className={`p-1.5 rounded-lg border transition-all ${app.adminMemo ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                                                    title="메모"
                                                  >
                                                    <StickyNote size={13} fill={app.adminMemo ? "currentColor" : "none"} />
                                                  </button>
                                                  {renderSmsButton(app)}
                                                  <button
                                                    onClick={() => handleCancelSelection(app)}
                                                    className="p-1.5 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                                                    title={isOverQuota ? "선발 취소 (초과)" : "선발 취소"}
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.72rem] text-slate-400 font-medium">
                                                {!isDummyApp(app) && (
                                                  <span className="flex items-center gap-1 text-blue-600/70 bg-blue-50/50 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                                    <Phone size={10} className="text-blue-400/70" />
                                                    {app.phone || "-"}
                                                  </span>
                                                )}
                                                {app.gender === 'female' && app.femaleOption === 'group' && (
                                                  <>
                                                    {!isDummyApp(app) && <span className="text-slate-300">·</span>}
                                                    <span className="text-pink-500 font-bold whitespace-nowrap">
                                                      동반할인 {app.groupPartnerName ? `(${app.groupPartnerName})` : ''}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                              {app.adminMemo && (
                                                <div className="mt-1 flex items-start gap-1 bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100/50 max-w-fit">
                                                  <StickyNote size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                                  <p className="text-[0.65rem] text-amber-700 font-bold truncate max-w-[200px]">{app.adminMemo}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {unassigned.map((app) => {
                                        const isOverQuota = overQuotaAppIds.has(
                                          app.id,
                                        );
                                        const badge = statusMap[app.status] ?? {
                                          label: app.status,
                                          cls: "bg-slate-100 text-slate-400",
                                        };
                                        return (
                                          <div
                                            key={app.id}
                                            className={`flex flex-col gap-2 px-4 py-4 sm:px-5 sm:py-3.5 hover:bg-slate-50 transition-colors ${
                                              app.isDarkTemplar
                                                ? 'bg-violet-50 border-l-2 border-violet-400'
                                                : isOverQuota
                                                ? 'bg-red-50 animate-pulse'
                                                : 'bg-amber-50/40'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="flex flex-col items-center w-8 shrink-0">
                                                <span className={`text-xs font-black ${app.isDarkTemplar ? 'text-violet-500' : 'text-amber-500'}`}>
                                                  {app.isDarkTemplar ? '🌑' : '미배정'}
                                                </span>
                                                {getDrinkCode(app.drink) && (
                                                  <span className="text-[0.6rem] font-black text-blue-600 leading-none mt-0.5">
                                                    {getDrinkCode(app.drink)}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between sm:justify-start gap-2 mb-0.5">
                                                  <span
                                                    onClick={() => {
                                                      const user = userMap[app.userId] || { id: app.userId, name: app.name, phone: app.phone, gender: app.gender };
                                                      setSelectedUser(user);
                                                      setIsProfileModalOpen(true);
                                                    }}
                                                    className={`text-sm font-bold cursor-pointer transition-colors ${
                                                      app.isDarkTemplar
                                                        ? 'text-violet-800 hover:text-violet-600'
                                                        : 'text-slate-800 hover:text-[#FF7E7E]'
                                                    }`}
                                                  >
                                                    {app.name || "-"}
                                                  </span>
                                                  {app.isDarkTemplar && (
                                                    <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-violet-200 text-violet-800 border border-violet-400 shrink-0" title="다크템플러 - 매칭 제외">
                                                      🌑 다크템플러
                                                    </span>
                                                  )}
                                                  <div className="sm:hidden">
                                                    <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                                      {badge.label}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-1 ml-9 sm:ml-0">
                                              {!app.isDarkTemplar && (
                                                <>
                                                  {!isDummyApp(app) && (
                                                    <span className="flex items-center gap-0.5">
                                                      <Phone size={10} />
                                                      {app.phone || "-"}
                                                    </span>
                                                  )}
                                                  {!isDummyApp(app) && <span>·</span>}
                                                  <span>{getBirthYear(app)}</span>
                                                  <span>·</span>
                                                  <span className="flex items-center gap-1">
                                                    {isDummyApp(app) ? (
                                                      editingAppJobId === app.id ? (
                                                        <input
                                                          autoFocus
                                                          value={tempAppJobValue}
                                                          onChange={(e) => setTempAppJobValue(e.target.value)}
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleEditAppJob(app, tempAppJobValue);
                                                            if (e.key === 'Escape') setEditingAppJobId(null);
                                                          }}
                                                          onBlur={() => setEditingAppJobId(null)}
                                                          className="text-[0.72rem] font-bold bg-white border border-blue-400 rounded px-1 outline-none w-[80px]"
                                                        />
                                                      ) : (
                                                        <span 
                                                          onClick={() => {
                                                            setEditingAppJobId(app.id);
                                                            setTempAppJobValue(getEffectiveJob(app));
                                                          }}
                                                          className="truncate max-w-[80px] cursor-pointer hover:text-blue-500 hover:underline"
                                                          title="더미 직업명 수정"
                                                        >
                                                          {getEffectiveJob(app)}
                                                        </span>
                                                      )
                                                    ) : (
                                                      <span className="truncate max-w-[80px]">
                                                        {getEffectiveJob(app)}
                                                      </span>
                                                    )}
                                                  </span>
                                                  <span>·</span>
                                                  <span>
                                                    {app.residence || "-"}
                                                  </span>
                                                  {app.gender === 'female' && app.femaleOption === 'group' && (
                                                    <>
                                                      <span>·</span>
                                                      <span className="text-pink-500 font-bold">{app.groupPartnerName ? `동반할인 (${app.groupPartnerName} ${app.groupPartnerBirthYear}년생)` : '동반할인'}</span>
                                                    </>
                                                  )}
                                                </>
                                              )}
                                              <div className="flex items-center gap-2">
                                                {(() => {
                                                  let btnClass = "bg-white text-slate-400 border-slate-200";
                                                  let btnText = "출석체크";

                                                  if (app.attendanceStatus === 'present') {
                                                    btnClass = "bg-emerald-500 text-white border-emerald-500 shadow-sm";
                                                    btnText = "출석완료";
                                                  } else if (app.attendanceStatus === 'late') {
                                                    btnClass = "bg-amber-500 text-white border-amber-500 shadow-sm";
                                                    btnText = "지각";
                                                  } else if (app.attendanceStatus === 'no-show') {
                                                    btnClass = "bg-rose-500 text-white border-rose-500 shadow-sm";
                                                    btnText = "노쇼";
                                                  }

                                                  return (
                                                    <button
                                                      onClick={() => {
                                                        const current = app.attendanceStatus;
                                                        if (!current) handleSetAttendanceStatus(app, 'present');
                                                        else if (current === 'present') handleSetAttendanceStatus(app, 'late');
                                                        else if (current === 'late') handleSetAttendanceStatus(app, 'no-show');
                                                        else handleSetAttendanceStatus(app, 'none');
                                                      }}
                                                      className={`px-2 py-1 rounded-lg text-[0.65rem] font-black border transition-all ${btnClass}`}
                                                    >
                                                      {btnText}
                                                    </button>
                                                  );
                                                })()}
                                                <button
                                                  onClick={() => handleOpenMemo(app)}
                                                  className={`px-2 py-1 rounded-lg text-[0.65rem] font-black border transition-all ${app.adminMemo ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white text-slate-400 border-slate-200"}`}
                                                >
                                                  메모
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleCancelSelection(app)
                                                  }
                                                  className="shrink-0 px-2.5 py-1 rounded-lg text-[0.65rem] font-black bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                                                >
                                                  선발 취소
                                                </button>
                                              </div>
                                            </div>
                                            {app.adminMemo && (
                                              <div className="mt-1 ml-11 flex items-start gap-1 bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100/50 max-w-fit">
                                                <StickyNote size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                                <p className="text-[0.65rem] text-amber-700 font-bold truncate max-w-[200px]">
                                                  {app.adminMemo}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 대기자 탭 */}
                  {activeTab === "waitlist" && (
                    <div className="space-y-4">
                      <div className="pl-1">
                        <h3 className="flex items-center gap-2 text-[0.95rem] font-extrabold text-amber-700">
                          ⏳ 대기자 명단
                          <span className="text-[0.75rem] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-1">
                            총 {realWaitlisted.length}명 (
                            {
                              realWaitlisted.filter((a) => a.gender === "male")
                                .length
                            }
                            남 /{" "}
                            {
                              realWaitlisted.filter((a) => a.gender === "female")
                                .length
                            }
                            여)
                          </span>
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {(["male", "female"] as const).map((gender) => {
                          const genderWaitlist = waitlisted
                            .filter((a) => a.gender === gender)
                            .sort((a, b) => {
                              const userA = userMap[a.userId] || {};
                              const userB = userMap[b.userId] || {};
                              const isDummyA = a.id?.startsWith('dummy') || a.userId?.startsWith('user_m_') || a.userId?.startsWith('user_f_') || userA.isDummy === true;
                              const isDummyB = b.id?.startsWith('dummy') || b.userId?.startsWith('user_m_') || b.userId?.startsWith('user_f_') || userB.isDummy === true;

                              if (isDummyA !== isDummyB) {
                                return isDummyA ? 1 : -1;
                              }
                              return a.appliedAt.getTime() - b.appliedAt.getTime();
                            });
                          if (genderWaitlist.length === 0) return null;
                          const isMaleSection = gender === "male";
                          return (
                            <div
                              key={gender}
                              className={`${card} overflow-hidden`}
                            >
                              <div
                                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-orange-50/50`}
                              >
                                <span
                                  className={`text-[0.85rem] font-extrabold text-orange-700`}
                                >
                                  {isMaleSection ? "👨 남성" : "👩 여성"} 대기자
                                </span>
                                <span
                                  className={`text-[0.72rem] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700`}
                                >
                                  {genderWaitlist.length}명
                                </span>
                              </div>
                              <div className="divide-y divide-slate-100">
                                {genderWaitlist.map((app, idx) => {
                                  const user = userMap[app.userId];
                                  const birthYear = (() => {
                                    if (user?.birthDate)
                                      return `${user.birthDate.includes("-") ? user.birthDate.split('-')[0].slice(-2) : user.birthDate.slice(0, 2)}년생`;
                                    if (!app.age) return "-";
                                    const n = Number(app.age);
                                    if (n > 0 && n < 50) return `${String(2026 - n).slice(-2)}년생`;
                                    return `${String(app.age).padStart(2, "0")}년생`;
                                  })();
                                  return (
                                    <div
                                      key={app.id}
                                      className={`flex flex-col gap-2.5 px-4 sm:px-6 py-4 transition-all duration-200 border-b border-slate-100/60 ${app.attendanceStatus === 'present' ? "bg-emerald-50/15 hover:bg-emerald-50/30 border-l-4 border-l-emerald-500 shadow-sm shadow-emerald-100/50" : app.attendanceStatus === 'late' ? "bg-amber-50/15 hover:bg-amber-50/30 border-l-4 border-l-amber-500 shadow-sm shadow-amber-100/50" : app.attendanceStatus === 'no-show' ? "bg-rose-50/15 hover:bg-rose-50/30 border-l-4 border-l-rose-500 shadow-sm shadow-rose-100/50" : (userMap[app.userId]?.noShowCount > 0 ? "bg-rose-50/30 hover:bg-rose-50/50 border-l-4 border-l-rose-300" : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent")}`}
                                    >
                                      {/* Top Row: Slot, Name, Status Badge, and Action Buttons */}
                                      <div className="flex items-center justify-between gap-3">
                                        {/* Top Left: Slot, Name, Badges */}
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-xs font-black w-8 shrink-0 text-amber-500">
                                            {idx + 1}
                                          </span>
                                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                            <span
                                              onClick={() => {
                                                const user = userMap[app.userId] || { id: app.userId, name: app.name, phone: app.phone, gender: app.gender };
                                                setSelectedUser(user);
                                                setIsProfileModalOpen(true);
                                              }}
                                              className="text-sm font-bold text-slate-800 cursor-pointer hover:text-[#FF7E7E] transition-colors truncate"
                                            >
                                              {app.name || "-"}
                                            </span>
                                            {(app.userId?.startsWith("user_m_") || app.userId?.startsWith("user_f_") || app.id?.startsWith("dummy_")) && (
                                              <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">더미</span>
                                            )}
                                            {app.status === "applied" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md shrink-0" style={{ color: '#D97706', background: '#FFFBEB' }}>검토 중</span>}
                                            {app.status === "held" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md shrink-0" style={{ color: '#EA580C', background: '#FFF7ED' }}>보류</span>}
                                            {app.status === "selected" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md shrink-0" style={{ color: '#7C3AED', background: '#F5F3FF' }}>입금 대기</span>}
                                            {app.status === "waitlisted" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md shrink-0 bg-orange-100 text-orange-600">정원초과대기</span>}
                                          </div>
                                        </div>

                                        {/* Top Right: Actions (Memo, SMS, Selection Buttons, Trash) */}
                                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                          {/* Memo Button (Visible on both PC & Mobile) */}
                                          <button
                                            onClick={() => handleOpenMemo(app)}
                                            className={`p-1.5 rounded-lg border transition-all ${app.adminMemo ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"}`}
                                            title="메모"
                                          >
                                            <StickyNote size={13} fill={app.adminMemo ? "currentColor" : "none"} />
                                          </button>

                                          {/* SMS Button (Visible on both PC & Mobile) */}
                                          {renderSmsButton(app, true)}

                                          {/* Selection Actions (Desktop Only, hidden on Mobile to keep it clean) */}
                                          <div className="hidden sm:flex items-center gap-1 ml-1 pl-2.5 border-l border-slate-200">
                                            {app.status === "selected" ? (
                                              <>
                                                <button
                                                  onClick={() => handleWaitlistConfirm(app)}
                                                  className="px-2.5 py-1 rounded-lg text-[0.7rem] font-black bg-[#FFD700]/10 text-[#B8860B] border border-[#FFD700]/30 hover:bg-[#FFD700] hover:text-white transition-all shadow-sm"
                                                >
                                                  입금확정
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    if (window.confirm('선발을 취소하고 다시 검토 중 상태로 되돌리시겠습니까?')) {
                                                      callStatusApi(app.id, "applied").then(() => toast.success("검토 중으로 변경되었습니다.")).catch((e: any) => toast.error(e.message));
                                                    }
                                                  }}
                                                  className="px-2.5 py-1 rounded-lg text-[0.7rem] font-black bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                >
                                                  선발 취소
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                {app.status === "held" && (
                                                  <button
                                                    onClick={() => callStatusApi(app.id, "applied").then(() => toast.success("검토 중으로 변경되었습니다.")).catch((e: any) => toast.error(e.message))}
                                                    className="px-2 py-1 rounded-lg text-[0.7rem] font-black bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-all flex items-center gap-0.5"
                                                  >
                                                    보류 중 <X size={10} />
                                                  </button>
                                                )}
                                                <button
                                                  onClick={() => handleWaitlistSelect(app)}
                                                  disabled={isGenderFull[app.gender as "male" | "female"]}
                                                  className="px-2.5 py-1 rounded-lg text-[0.7rem] font-black bg-[#FF7E7E]/10 text-[#FF7E7E] border border-[#FF7E7E]/20 hover:bg-[#FF7E7E] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                                >
                                                  선발
                                                </button>
                                                <button
                                                  onClick={() => handleWaitlistHold(app)}
                                                  className="px-2.5 py-1 rounded-lg text-[0.7rem] font-black bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-all shadow-sm"
                                                >
                                                  보류
                                                </button>
                                                <button
                                                  onClick={() => handleWaitlistConfirm(app)}
                                                  disabled={isGenderFull[app.gender as "male" | "female"]}
                                                  className="px-2.5 py-1 rounded-lg text-[0.7rem] font-black bg-[#FFD700]/10 text-[#B8860B] border border-[#FFD700]/30 hover:bg-[#FFD700] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                                >
                                                  선발확정
                                                </button>
                                              </>
                                            )}
                                          </div>

                                          {/* Delete Button (Visible on both PC & Mobile) */}
                                          <button
                                            onClick={() => handleWaitlistDelete(app)}
                                            className="p-1.5 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all"
                                            title="삭제"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Bottom Details Row (Aligned nicely under the name with ml-10) */}
                                      <div className="ml-10 flex flex-col gap-1.5">
                                        {/* Row 1: 나이, 직업, 거주지 */}
                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.72rem] text-slate-600 font-bold">
                                          <span className="whitespace-nowrap">{birthYear}</span>
                                          <span className="text-slate-300">·</span>
                                          <span className="flex items-center gap-1 min-w-0">
                                            {isDummyApp(app) ? (
                                              editingAppJobId === app.id ? (
                                                <input
                                                  autoFocus
                                                  value={tempAppJobValue}
                                                  onChange={(e) => setTempAppJobValue(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleEditAppJob(app, tempAppJobValue);
                                                    if (e.key === 'Escape') setEditingAppJobId(null);
                                                  }}
                                                  onBlur={() => setEditingAppJobId(null)}
                                                  className="text-[0.72rem] font-bold bg-white border border-blue-400 rounded px-1 outline-none w-[100px]"
                                                />
                                              ) : (
                                                <span 
                                                  onClick={() => {
                                                    setEditingAppJobId(app.id);
                                                    setTempAppJobValue(app.job || '');
                                                  }}
                                                  className="truncate max-w-[160px] sm:max-w-[140px] cursor-pointer hover:text-blue-500 hover:underline"
                                                  title={app.job || "-"}
                                                >
                                                  {app.job || "-"}
                                                </span>
                                              )
                                            ) : (
                                              <span className="truncate max-w-[160px] sm:max-w-[140px]" title={getEffectiveJob(app)}>{getEffectiveJob(app)}</span>
                                            )}
                                          </span>
                                          <span className="text-slate-300">·</span>
                                          <span className="whitespace-nowrap">{app.residence || "-"}</span>
                                        </div>
                                        {/* Row 2: 휴대폰번호, 동반참여 */}
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.72rem] text-slate-400 font-medium">
                                          {!isDummyApp(app) && (
                                            <span className="flex items-center gap-1 text-blue-600/70 bg-blue-50/50 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                              <Phone size={10} className="text-blue-400/70" />
                                              {app.phone || "-"}
                                            </span>
                                          )}
                                          {app.gender === 'female' && app.femaleOption === 'group' && (
                                            <>
                                              {!isDummyApp(app) && <span className="text-slate-300">·</span>}
                                              <span className="text-pink-500 font-bold whitespace-nowrap">
                                                동반할인 {app.groupPartnerName ? `(${app.groupPartnerName})` : ''}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        {/* Row 3: Admin Memo */}
                                        {app.adminMemo && (
                                          <div className="mt-1 flex items-start gap-1 bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100/50 max-w-fit">
                                            <StickyNote size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                            <p className="text-[0.65rem] text-amber-700 font-bold truncate max-w-[200px]">
                                              {app.adminMemo}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 매칭 통계 탭 */}
                  {activeTab === "stats" && (
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          {["기수", "날짜", "상태"].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "12px 16px",
                                textAlign: "left",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                borderBottom: "1px solid #e2e8f0",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matchingHistory.map((r: any) => (
                          <tr
                            key={r.id}
                            className="hover:bg-slate-50 transition-colors border-b border-slate-100"
                          >
                            <td
                              style={{
                                padding: "16px",
                                fontSize: "0.9rem",
                                fontWeight: 800,
                                color: "#1e293b",
                              }}
                            >
                              {r.episode}기
                            </td>
                            <td
                              style={{
                                padding: "16px",
                                fontSize: "0.85rem",
                                color: "#64748b",
                                fontWeight: 500,
                              }}
                            >
                              {r.date}
                            </td>
                            <td style={{ padding: "16px" }}>
                              <span
                                className={`text-xs font-bold px-3 py-1 rounded-full ${r.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                              >
                                {r.status === "completed"
                                  ? "매칭 완료"
                                  : "진행 중"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {/* 탭 컨텐츠 끝 */}
              </div>
              {/* 탭 패널 끝 */}
            </>
          ) : (
            <div
              className={`flex h-[300px] items-center justify-center ${card}`}
            >
              <p className="text-slate-400 font-medium">
                기수를 선택해 주세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* v8.1.7: 호감도 신청폼 세부 설정 모달 */}
      {isConfigModalOpen && (
        <div onClick={() => setIsConfigModalOpen(false)} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black text-slate-800">
                호감도 신청폼 세부 설정
              </h3>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8 overflow-y-auto">
              {/* 모집 정원 및 제한 */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      최대 선택 인원
                    </p>
                    <p className="text-[0.75rem] text-slate-400">
                      유저가 투표 시 고를 수 있는 최대 인원
                    </p>
                  </div>
                  <input
                    type="number"
                    value={configFormData.maxSelection}
                    onChange={(e) =>
                      setConfigFormData({
                        ...configFormData,
                        maxSelection: Number(e.target.value),
                      })
                    }
                    className="w-16 h-10 text-center rounded-lg border border-slate-200 font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
              </section>

              {/* 네이버 폼 커스텀 문항 */}
              <section className="space-y-6">
                <p className="text-[0.75rem] font-bold text-indigo-500 uppercase tracking-widest">
                  네이버 폼 문항 커스터마이징
                </p>

                <div className="space-y-4">
                  {[
                    {
                      key: "q1Label",
                      label: "1번 문항 (실명 확인)",
                      placeholder: "실명을 적어주세요",
                    },
                    {
                      key: "q2Label",
                      label: "2번 문항 (본인 호수)",
                      placeholder: "본인의 호를 체크해주세요",
                    },
                    {
                      key: "q3Label",
                      label: "3번 문항 (이성 선택 메인)",
                      placeholder: "호감가는 이성 선택",
                    },
                    {
                      key: "q4Label",
                      label: "4번 문항 (최종 확인 체크)",
                      placeholder: "최종 라인업 확인 및 확인 체크",
                    },
                    {
                      key: "q5Label",
                      label: "5번 문항 (후기 작성)",
                      placeholder: "후기",
                    },
                  ].map((q) => (
                    <div key={q.key}>
                      <label className="block text-[0.7rem] font-black text-slate-400 mb-1.5">
                        {q.label}
                      </label>
                      <input
                        type="text"
                        value={(configFormData as any)[q.key] || ""}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            [q.key]: e.target.value,
                          })
                        }
                        placeholder={q.placeholder}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-[0.7rem] font-black text-slate-400 mb-1.5">
                      3번 문항 서브 설명 (질문 문구)
                    </label>
                    <textarea
                      value={configFormData.questionText}
                      onChange={(e) =>
                        setConfigFormData({
                          ...configFormData,
                          questionText: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="투표 페이지 3번 문항 안내 문구"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* 선택 사유 활성화 */}
              <section className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">
                    선택 사유 입력 여부
                  </p>
                  <p className="text-[0.75rem] text-slate-400">
                    호감 표시와 함께 짧은 코멘트 허용
                  </p>
                </div>
                <button
                  onClick={() =>
                    setConfigFormData({
                      ...configFormData,
                      showReason: !configFormData.showReason,
                    })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative ${configFormData.showReason ? "bg-indigo-600" : "bg-slate-200"}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${configFormData.showReason ? "left-6" : "left-1"}`}
                  />
                </button>
              </section>

              {/* 결과 공개 로직 */}
              <section className="space-y-4">
                <p className="text-sm font-bold text-slate-700">
                  결과 공개 로직 설정
                </p>
                <div className="space-y-2">
                  {[
                    { id: "all", label: "나를 선택한 사람 모두 공개" },
                    { id: "mutual", label: "맞호감(매칭 성공)인 경우만 공개" },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="visibility"
                        checked={configFormData.resultVisibility === opt.id}
                        onChange={() =>
                          setConfigFormData({
                            ...configFormData,
                            resultVisibility: opt.id as any,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-slate-600">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3 shrink-0 border-t border-slate-100">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isConfigSaving}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {isConfigSaving ? "저장 중..." : "설정 저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Drink Distribution Modal */}
      {drinkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                ☕ 음료 서빙 <span className="text-sm font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg ml-1">{selectedDrinkCode}</span>
              </h3>
              <button onClick={() => setDrinkModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {(() => {
                const realParticipants = participants.filter(app => {
                  const user = userMap[app.userId] || {};
                  return !(app.id?.startsWith('dummy') || app.userId?.startsWith('user_m_') || app.userId?.startsWith('user_f_') || user.isDummy === true);
                });

                const targetParticipants = realParticipants.filter(p => {
                  if (p.attendanceStatus === 'no-show') return false;
                  const code = getDrinkCode(p.drink);
                  return code && code.split(', ').includes(selectedDrinkCode);
                });
                
                if (targetParticipants.length === 0) return <p className="text-center text-slate-500 py-8 font-medium">해당 음료를 주문한 참가자가 없습니다.</p>;
                
                targetParticipants.sort((a, b) => {
                  if (a.gender !== b.gender) return a.gender === 'male' ? -1 : 1;
                  return (a.slotNumber || 0) - (b.slotNumber || 0);
                });
                
                return (
                  <div className="space-y-2.5">
                    {targetParticipants.map(p => {
                      const isServed = (p as any).drinkServed === true;
                      const genderLabel = p.gender === 'male' ? '남성' : '여성';
                      const genderColor = p.gender === 'male' ? 'text-blue-700 bg-blue-100' : 'text-pink-700 bg-pink-100';
                      return (
                        <div key={p.id} className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-200 ${isServed ? 'bg-slate-50 border-transparent shadow-inner' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${isServed ? 'text-slate-400 bg-slate-200' : genderColor}`}>
                              {genderLabel} {p.slotNumber}호
                            </span>
                            <span className={`text-sm font-bold ${isServed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {p.name || '이름 없음'}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'applications', p.id), { drinkServed: !isServed });
                              } catch (e) {
                                toast.error('상태 변경 실패');
                              }
                            }}
                            className={`p-2 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${isServed ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                          >
                            <CheckCircle2 size={22} strokeWidth={isServed ? 3 : 2} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setDrinkModalOpen(false)}
                className="w-full py-3.5 bg-slate-800 text-white font-extrabold text-[0.95rem] rounded-xl hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <InstagramFeedModal
        isOpen={instagramModalOpen}
        onClose={() => setInstagramModalOpen(false)}
        sessionId={selectedId || ''}
        sessionName={sessions.find(s => s.id === selectedId)?.title || ''}
        participants={participants}
      />

      {/* Bulk SMS Modal */}
      <SMSPreviewModal
        isOpen={smsModalOpen}
        onClose={() => { setSmsModalOpen(false); setSmsSingleTarget(null); }}
        onConfirm={handleBulkSMSConfirm}
        applicant={smsSingleTarget || undefined}
        session={active}
        defaultMessage={smsDefaultMsg}
        recipientLabel={smsRecipientLabel}
        confirmLabel="문자 발송"
      />

      <SMSPreviewModal
        isOpen={selectPreviewOpen}
        onClose={() => setSelectPreviewOpen(false)}
        onConfirm={handleWaitlistSelectConfirm}
        applicant={selectPreviewData?.app}
        session={selectPreviewData?.session}
        defaultMessage={selectPreviewData?.defaultMsg || ""}
        confirmLabel="선발 및 문자 발송"
      />

      <SMSPreviewModal
        isOpen={confirmPreviewOpen}
        onClose={() => setConfirmPreviewOpen(false)}
        onConfirm={handleWaitlistConfirmSubmit}
        applicant={confirmPreviewData?.app}
        session={confirmPreviewData?.session}
        defaultMessage={confirmPreviewData?.defaultMsg || ""}
        confirmLabel="입금확정 및 문자 발송"
      />

      <UserProfileModal
        user={selectedUser}
        isOpen={isProfileModalOpen}
        onClose={() => { setIsProfileModalOpen(false); setSelectedUser(null); }}
        onUserUpdate={handleUserUpdate}
      />

      {/* Voting Status Modal */}
      {votingStatusModalOpen && (
        <div onClick={() => setVotingStatusModalOpen(false)} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-600" /> 투표 제출 현황 실시간 집계
              </h3>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-black text-emerald-600">실시간 동기화 중</span>
                </div>
                <button
                  onClick={() => setVotingStatusModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 bg-slate-50/50 max-h-[80vh] overflow-y-auto">
              {votingStatusLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                  <p className="text-sm font-semibold text-slate-500">실시간 데이터 불러오는 중...</p>
                </div>
              ) : votingStatusData ? (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <h4 className="font-extrabold text-slate-800">전체 진행률</h4>
                        <p className="text-sm font-medium text-slate-500 mt-1">총 {votingStatusData.total}명 중 {votingStatusData.submitted.length}명 제출 완료</p>
                      </div>
                      <span className="text-2xl font-black text-indigo-600">{votingStatusData.percent}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${votingStatusData.percent}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 키링남 (왼쪽) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">키링남 (Men)</h4>
                        </div>
                        <span className="text-[0.7rem] font-bold text-slate-400">
                          {votingStatusData.submitted.filter(s => s.gender === 'male').length} / {participants.filter(p => p.gender === 'male').length} 제출
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {participants
                          .filter(p => p.gender === 'male')
                          .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
                          .map(p => {
                            const isSubmitted = votingStatusData.submitted.some(s => s.userId === p.userId);
                            const isAbsent = !p.attended && !isSubmitted;
                            return (
                              <div
                                key={p.id}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${
                                  isSubmitted
                                    ? 'bg-blue-600 border-blue-700 shadow-md shadow-blue-100 scale-[1.02]'
                                    : isAbsent
                                      ? 'bg-slate-50 border-slate-200/60 opacity-60'
                                      : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[0.75rem] font-black shrink-0 ${
                                    isSubmitted 
                                      ? 'bg-blue-500 text-white' 
                                      : isAbsent
                                        ? 'bg-slate-100 text-slate-400'
                                        : 'bg-blue-50 text-blue-600'
                                  }`}>
                                    {p.slotNumber}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-extrabold ${isSubmitted ? 'text-white' : 'text-slate-700'}`}>
                                      {p.name}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isSubmitted ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 animate-in fade-in zoom-in duration-300">
                                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      <span className="text-[0.65rem] font-black text-white">제출완료</span>
                                    </div>
                                  ) : isAbsent ? (
                                    <span className="text-[0.65rem] font-black text-rose-500/80 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">미출석</span>
                                  ) : (
                                    <span className="text-[0.65rem] font-bold text-slate-300">미제출</span>
                                  )}
                                  {!isAbsent && (
                                    <button
                                      onClick={() => { setVotingStatusModalOpen(false); handleOpenProxyVote(p); }}
                                      className={`p-1.5 rounded-lg transition-all ${isSubmitted ? 'text-white/60 hover:bg-white/20' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                                      title="투표 입력/수정"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* 키링녀 (오른쪽) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-pink-500 rounded-full" />
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">키링녀 (Women)</h4>
                        </div>
                        <span className="text-[0.7rem] font-bold text-slate-400">
                          {votingStatusData.submitted.filter(s => s.gender === 'female').length} / {participants.filter(p => p.gender === 'female').length} 제출
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {participants
                          .filter(p => p.gender === 'female')
                          .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
                          .map(p => {
                            const isSubmitted = votingStatusData.submitted.some(s => s.userId === p.userId);
                            const isAbsent = !p.attended && !isSubmitted;
                            return (
                              <div
                                key={p.id}
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${
                                  isSubmitted
                                    ? 'bg-pink-600 border-pink-700 shadow-md shadow-pink-100 scale-[1.02]'
                                    : isAbsent
                                      ? 'bg-slate-50 border-slate-200/60 opacity-60'
                                      : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[0.75rem] font-black shrink-0 ${
                                    isSubmitted 
                                      ? 'bg-pink-500 text-white' 
                                      : isAbsent
                                        ? 'bg-slate-100 text-slate-400'
                                        : 'bg-pink-50 text-pink-600'
                                  }`}>
                                    {p.slotNumber}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-extrabold ${isSubmitted ? 'text-white' : 'text-slate-700'}`}>
                                      {p.name}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isSubmitted ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 animate-in fade-in zoom-in duration-300">
                                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      <span className="text-[0.65rem] font-black text-white">제출완료</span>
                                    </div>
                                  ) : isAbsent ? (
                                    <span className="text-[0.65rem] font-black text-rose-500/80 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">미출석</span>
                                  ) : (
                                    <span className="text-[0.65rem] font-bold text-slate-300">미제출</span>
                                  )}
                                  {!isAbsent && (
                                    <button
                                      onClick={() => { setVotingStatusModalOpen(false); handleOpenProxyVote(p); }}
                                      className={`p-1.5 rounded-lg transition-all ${isSubmitted ? 'text-white/60 hover:bg-white/20' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                                      title="투표 입력/수정"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* 투표 상세 내역 섹션 추가 */}
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <button
                      onClick={() => setShowVoteDetailsInModal(!showVoteDetailsInModal)}
                      className="w-full flex items-center justify-between px-6 py-4 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-xl transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center">
                          <Heart size={16} className="text-violet-600" />
                        </div>
                        <span className="font-extrabold text-violet-700">투표 상세 내역 보기 (선택 리스트)</span>
                      </div>
                      <ChevronRight size={18} className={`text-violet-400 transition-transform duration-300 ${showVoteDetailsInModal ? 'rotate-90' : ''}`} />
                    </button>

                    {showVoteDetailsInModal && votingStatusData.rawVotes && votingStatusData.rawVotes.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                        {/* 키링남 상세 선택 */}
                        <div className="space-y-3">
                          <p className="text-[0.7rem] font-black text-blue-500 uppercase tracking-widest px-1">Men Selection Details</p>
                          <div className="space-y-2">
                            {participants
                              .filter(p => p.gender === 'male')
                              .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
                              .map(p => {
                                const vote = votingStatusData.rawVotes.find(v => v.userId === p.userId);
                                if (!vote) return null;
                                return (
                                  <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[0.65rem] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">{p.slotNumber}호</span>
                                        <span className="text-sm font-bold text-slate-800">{p.name}</span>
                                      </div>
                                      {vote.disclosureMode === 'anonymous' ? (
                                        <span className="text-[0.65rem] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md">익명</span>
                                      ) : (
                                        <span className="text-[0.65rem] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded-md">호수 공개</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {[...vote.choices]
                                        .sort((a, b) => {
                                          const tA = participants.find(tp => tp.userId === a.targetUserId)?.slotNumber || 0;
                                          const tB = participants.find(tp => tp.userId === b.targetUserId)?.slotNumber || 0;
                                          return tA - tB;
                                        })
                                        .map((c: any) => {
                                          const target = participants.find(tp => tp.userId === c.targetUserId);
                                          return (
                                            <div key={c.targetUserId} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                                              <span className="text-[0.7rem] font-black text-pink-500">{target?.slotNumber || '?'}호</span>
                                              <span className="text-[0.7rem] font-bold text-slate-600">{target?.name || '익명'}</span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* 키링녀 상세 선택 */}
                        <div className="space-y-3">
                          <p className="text-[0.7rem] font-black text-pink-500 uppercase tracking-widest px-1">Women Selection Details</p>
                          <div className="space-y-2">
                            {participants
                              .filter(p => p.gender === 'female')
                              .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
                              .map(p => {
                                const vote = votingStatusData.rawVotes.find(v => v.userId === p.userId);
                                if (!vote) return null;
                                return (
                                  <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[0.65rem] font-black bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded-md">{p.slotNumber}호</span>
                                        <span className="text-sm font-bold text-slate-800">{p.name}</span>
                                      </div>
                                      {vote.disclosureMode === 'anonymous' ? (
                                        <span className="text-[0.65rem] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md">익명</span>
                                      ) : (
                                        <span className="text-[0.65rem] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded-md">호수 공개</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {[...vote.choices]
                                        .sort((a, b) => {
                                          const tA = participants.find(tp => tp.userId === a.targetUserId)?.slotNumber || 0;
                                          const tB = participants.find(tp => tp.userId === b.targetUserId)?.slotNumber || 0;
                                          return tA - tB;
                                        })
                                        .map((c: any) => {
                                          const target = participants.find(tp => tp.userId === c.targetUserId);
                                          return (
                                            <div key={c.targetUserId} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                                              <span className="text-[0.7rem] font-black text-blue-500">{target?.slotNumber || '?'}호</span>
                                              <span className="text-[0.7rem] font-bold text-slate-600">{target?.name || '익명'}</span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Matching Drawer */}
      {matchingDrawerOpen && active && (
        <MatchingDrawer
          session={active}
          onClose={() => setMatchingDrawerOpen(false)}
        />
      )}

      {/* Review List Modal */}
      {reviewModalOpen && (
        <div onClick={() => setReviewModalOpen(false)} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquare size={18} className="text-orange-600" /> 참가자 후기 모음
                </h3>
                <button
                  onClick={() => setIsWritingReview(!isWritingReview)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-[#FF6F61] text-[0.72rem] font-bold rounded-lg border border-orange-100/60 transition-colors"
                >
                  <Plus size={14} /> 후기 수동 추가
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => active && handleOpenReviews(active)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                >
                  <RefreshCw size={14} className={reviewsLoading ? "animate-spin" : ""} /> 새로고침
                </button>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 bg-slate-50/50 max-h-[80vh] overflow-y-auto">
              
              {/* 후기 수동 추가/편집 폼 */}
              {isWritingReview && (
                <div className="mb-6 p-5 bg-white border border-orange-100 rounded-xl shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-200">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    {editingReviewUserId ? "후기 수정하기" : "새로운 후기 수동 기입"}
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">대상 참가자 선택</label>
                      <select
                        value={reviewTargetUserId}
                        disabled={!!editingReviewUserId}
                        onChange={(e) => setReviewTargetUserId(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF6F61] outline-none transition-all"
                      >
                        <option value="">-- 참가자 선택 --</option>
                        {participants
                          .filter(p => {
                            const hasReview = reviewList.some(r => r.userId === p.userId);
                            return !hasReview || p.userId === editingReviewUserId;
                          })
                          .sort((a, b) => {
                            if (a.gender !== b.gender) return a.gender === 'male' ? -1 : 1;
                            return (a.slotNumber || 0) - (b.slotNumber || 0);
                          })
                          .map(p => (
                            <option key={p.userId} value={p.userId}>
                              {p.gender === 'male' ? '남' : '여'} {p.slotNumber}호 - {p.name} ({p.job})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">후기 내용</label>
                    <textarea
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      placeholder="참가자의 후기 내용을 정성껏 기입해 주세요."
                      rows={3}
                      className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF6F61] outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWritingReview(false);
                        setReviewTargetUserId("");
                        setReviewContent("");
                        setEditingReviewUserId(null);
                      }}
                      className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-bold rounded-lg transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={isReviewSaving}
                      onClick={handleSaveReview}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6F61] hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-sm shadow-orange-100 transition-colors"
                    >
                      {isReviewSaving ? (
                        <>
                          <Loader2 className="animate-spin" size={13} /> 저장 중...
                        </>
                      ) : (
                        "저장 완료"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {reviewsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="animate-spin text-orange-500" size={32} />
                  <p className="text-sm font-semibold text-slate-500">후기 데이터 불러오는 중...</p>
                </div>
              ) : reviewList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviewList.map((rev, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[0.65rem] font-black px-2 py-0.5 rounded-md ${rev.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                            {rev.gender === 'male' ? '남' : '여'} {rev.slotNumber}호
                          </span>
                          <span className="text-sm font-bold text-slate-800">{rev.name}</span>
                        </div>
                        
                        {/* 수정 / 삭제 관리 액션 버튼 */}
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setIsWritingReview(true);
                              setEditingReviewUserId(rev.userId || "");
                              setReviewTargetUserId(rev.userId || "");
                              setReviewContent(rev.content);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="후기 수정"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteReview(rev.userId || "")}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            title="후기 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute -top-2 -left-1 text-4xl text-slate-100 font-serif">"</span>
                        <p className="text-[0.85rem] text-slate-600 leading-relaxed relative z-10 pl-2">
                          {rev.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <MessageSquare size={48} className="opacity-20 mb-3" />
                  <p className="font-medium">아직 작성된 후기가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Session Config Modal */}
      {isModalOpen && (
        <div onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? "기수 정보 수정" : "새 기수 등록 시스템"}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                  setFormData(initialFormData);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitSession}
              className="p-6 overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 120px)" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Region & Episode */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      지역 선택
                    </label>
                    <select
                      value={formData.region}
                      onChange={(e) =>
                        setFormData({ ...formData, region: e.target.value })
                      }
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    >
                      <option value="busan">부산 (Busan)</option>
                      <option value="changwon">창원 (Changwon)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      기수 번호 (숫자 혹은 테스트)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 121 또는 테스트"
                      value={formData.episodeNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          episodeNumber: e.target.value,
                        })
                      }
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      <span>행사 일자</span>
                      {formData.eventDate && (() => {
                        const [y, m, d] = formData.eventDate.split('-');
                        if (!y || !m || !d) return null;
                        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
                        const dayColor = dateObj.getDay() === 0 ? 'text-rose-500' : dateObj.getDay() === 6 ? 'text-sky-500' : 'text-slate-400';
                        return <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 ${dayColor}`}>
                          {dayNames[dateObj.getDay()]}
                        </span>;
                      })()}
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.eventDate}
                      onChange={(e) =>
                        setFormData({ ...formData, eventDate: e.target.value })
                      }
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      시작 시간
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.eventTime}
                      onChange={(e) =>
                        setFormData({ ...formData, eventTime: e.target.value })
                      }
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Venue */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      장소
                    </label>
                    <select
                      value={formData.venue}
                      onChange={(e) =>
                        setFormData({ ...formData, venue: e.target.value })
                      }
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    >
                      <option value="서면역 인근 프라이빗한 파티룸">
                        서면역 인근 프라이빗한 파티룸
                      </option>
                      <option value="상남동 인근">
                        상남동 인근
                      </option>
                      <option value="추가 장소 필요시 입력">
                        추가 장소 필요시 입력...
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      여성 참가비 (원)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 29,000"
                      value={formData.price}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData({
                          ...formData,
                          price: val ? Number(val).toLocaleString() : "",
                        });
                      }}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Target Age */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                        남성 연령대
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        maxLength={2}
                        placeholder="94"
                        value={formData.ageStart}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setFormData({ ...formData, ageStart: val });
                          if (val.length === 2 && ageEndRef.current) {
                            ageEndRef.current.focus();
                          }
                        }}
                        className="w-16 h-11 text-center rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                      />
                      <span className="text-slate-300 font-bold">~</span>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        ref={ageEndRef}
                        placeholder="01"
                        value={formData.ageEnd}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setFormData({ ...formData, ageEnd: val });
                        }}
                        className="w-16 h-11 text-center rounded-xl border border-slate-200 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                      />
                      <span className="text-slate-400 text-sm font-bold ml-1">
                        년생
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* v9.1.0: 오픈채팅 링크 입력란 추가 */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  오픈채팅방 링크 (2차 안내문자용)
                </label>
                <input
                  type="url"
                  placeholder="https://open.kakao.com/o/..."
                  value={formData.openChatLink}
                  onChange={(e) =>
                    setFormData({ ...formData, openChatLink: e.target.value })
                  }
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">
                  * 입력 시 2차 안내문자의 {"{{오픈채팅링크}}"} 부분이 이 링크로 자동 대체됩니다.
                </p>
              </div>

              {/* Status and Unified Capacity (v8.2.3) */}
              <div className="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 mb-8 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-center">
                    초기 상태
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as SessionStatus,
                      })
                    }
                    className="w-full h-11 text-center rounded-xl border-2 border-slate-200 bg-white text-slate-800 font-bold focus:border-[#FF6F61] focus:ring-0 outline-none transition-all"
                  >
                    <option value="open">모집 중 (게시됨)</option>
                    <option value="closed">모집 마감</option>
                  </select>
                </div>
                <div className="flex flex-col items-center">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-center">
                    성별 정원 (1:1 기준)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.maxMale}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxMale: e.target.value,
                        maxFemale: e.target.value,
                      })
                    }
                    className="w-full h-11 text-center px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-800 font-black text-lg focus:border-[#FF6F61] focus:ring-0 outline-none transition-all"
                    placeholder="8"
                  />
                  <p className="text-[11px] text-slate-400 font-bold mt-2 text-center leading-relaxed">
                    남녀 성비가 1:1로 자동 설정됩니다.
                    <br />
                    <span className="text-[#FF6F61]">
                      총 {(Number(formData.maxMale) || 0) * 2}명 선발 가능
                    </span>
                  </p>
                </div>
              </div>

              {/* 테스트 기수 여부 (v10.0.0) */}
              <div className="mb-6 flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <div className="pr-4">
                  <label className="block text-sm font-bold text-amber-800">
                    ⚠️ 테스트 기수 설정
                  </label>
                  <p className="text-[11px] text-amber-600 font-medium mt-0.5 leading-relaxed">
                    체크하면 일반 신청 페이지 및 신청 현황에 노출되지 않으며, 관리자만 대시보드에서 볼 수 있습니다.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!formData.isTest}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      isTest: checked,
                      episodeNumber: checked
                        ? "테스트"
                        : (prev.episodeNumber === "테스트" ? "" : prev.episodeNumber)
                    }));
                  }}
                  className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-12 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] h-12 rounded-xl font-bold text-white bg-[#FF6F61] hover:bg-[#ff5746] shadow-[0_4px_12px_rgba(255,111,97,0.25)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <Loader2 className="animate-spin" size={16} />
                  )}
                  데이터베이스에 기수 등록 반영
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* v9.0.0: 참가자 메모 모달 */}
      {memoModalOpen && memoTargetApp && (
        <div onClick={() => setMemoModalOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <StickyNote size={20} />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-lg">참가자 메모</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {memoTargetApp.name} ({memoTargetApp.gender === 'male' ? '남' : '여'}, {memoTargetApp.slotNumber}호)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMemoModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={memoContent}
                onChange={(e) => setMemoContent(e.target.value)}
                placeholder="참가자의 특별 요청사항이나 특징을 메모해두세요."
                className="w-full h-40 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none placeholder:text-slate-300"
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setMemoModalOpen(false)}
                  className="flex-1 h-12 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveMemo}
                  disabled={isMemoSaving}
                  className="flex-[2] h-12 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isMemoSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    "메모 저장하기"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 대리 투표 입력 모달 */}
      {proxyVoteModalOpen && proxyVoteTarget && (() => {
        const oppParticipants = participants
          .filter(p => p.gender !== proxyVoteTarget.gender)
          .sort((a, b) => (a.slotNumber || 99) - (b.slotNumber || 99));

        return (
          <div
            onClick={() => setProxyVoteModalOpen(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Pencil size={18} className="text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">대리 투표 입력</h2>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      {proxyVoteTarget.slotNumber}호 {proxyVoteTarget.name}
                      {proxyVoteTarget.gender === 'male' ? ' (남)' : ' (여)'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setProxyVoteModalOpen(false)}
                  className="p-2 rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* 기존 투표 있을 때 */}
                {proxyVoteCheckLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                  </div>
                ) : existingProxyVote ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-500 shrink-0" />
                      <p className="text-sm font-bold text-amber-700">이미 투표가 등록되어 있습니다.</p>
                    </div>
                    <div className="space-y-1.5">
                      {(existingProxyVote.choices || []).map((c: any) => {
                        const targetUser = participants.find(p => p.userId === c.targetUserId);
                        const displayLabel = targetUser
                          ? `${targetUser.gender === 'male' ? '키링남' : '키링녀'} ${targetUser.slotNumber}호 (${targetUser.name})`
                          : (c.targetUserName || c.targetUserId);

                        return (
                          <div key={c.priority} className="flex items-center gap-2 text-sm">
                            <span className="text-xs font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">{c.priority}순위</span>
                            <span className="font-bold text-slate-700">{displayLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                    {existingProxyVote.isProxyVote && (
                      <p className="text-[11px] font-bold text-amber-500">✏️ 관리자 대리 입력</p>
                    )}
                    <button
                      onClick={handleDeleteProxyVote}
                      disabled={proxyVoteLoading}
                      className="w-full py-2.5 rounded-xl bg-rose-500 text-white text-sm font-black hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {proxyVoteLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={14} />}
                      기존 투표 삭제 후 재입력
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
                      <p className="text-xs font-bold text-indigo-600">📋 네이버폼 결과를 바탕으로 호감 상대를 터치해 주세요. (최대 3명)</p>
                    </div>

                    {/* 카드 형태의 이성 리스트 */}
                    <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-2.5">
                      {oppParticipants.map((p, idx) => {
                        const selectedKey = (['priority1', 'priority2', 'priority3'] as const).find(
                          key => proxyVoteChoices[key] === p.userId
                        );
                        const isSelected = !!selectedKey;
                        const label = p.gender === 'male' ? '키링남' : '키링녀';

                        const rawBirth = p.birthDate || '';
                        const year = rawBirth.includes('-')
                          ? rawBirth.split('-')[0].slice(2, 4)
                          : (rawBirth.length >= 2 ? rawBirth.slice(0, 2) : '??');
                        const birthYear = year && year !== '??' ? `${year}년생` : (p.age ? `${p.age}세` : '연령 미입력');

                        return (
                          <div
                            key={p.userId}
                            onClick={() => {
                              if (isSelected && selectedKey) {
                                setProxyVoteChoices(prev => ({
                                  ...prev,
                                  [selectedKey]: ''
                                }));
                              } else {
                                const emptyKey = (['priority1', 'priority2', 'priority3'] as const).find(
                                  key => !proxyVoteChoices[key]
                                );
                                if (emptyKey) {
                                  setProxyVoteChoices(prev => ({
                                    ...prev,
                                    [emptyKey]: p.userId
                                  }));
                                } else {
                                  toast.error('최대 3명까지 선택할 수 있습니다.');
                                }
                              }
                            }}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                                : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                            }`}
                          >
                            {/* 하트 아이콘 또는 숫자 */}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                              isSelected ? 'bg-indigo-500 text-white animate-in zoom-in-50 duration-200' : 'bg-white border-2 border-slate-200 text-slate-400'
                            }`}>
                              {isSelected ? <Heart size={16} fill="white" /> : p.slotNumber || (idx + 1)}
                            </div>

                            {/* 정보 */}
                            <div className="flex-1 text-left">
                              <p className={`font-black text-sm ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                                {p.slotNumber ? `${p.slotNumber}호` : `${label} ${idx + 1}호`} {p.name}
                              </p>
                              <p className="text-xs font-bold text-slate-400 mt-0.5">
                                {birthYear} · {p.displayJob || p.job || '직업 미입력'}
                              </p>
                            </div>

                            {isSelected && <CheckCircle2 size={20} className="text-indigo-500 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* 다음 새로운 인연 옵션 */}
                    <div
                      onClick={() => {
                        setProxyNextEvent(prev => !prev);
                        if (!proxyNextEvent) {
                          // 선택 시 기존 후보 선택 초기화
                          setProxyVoteChoices({ priority1: '', priority2: '', priority3: '' });
                        }
                      }}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        proxyNextEvent
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        proxyNextEvent ? 'bg-indigo-500' : 'bg-white border-2 border-slate-200'
                      }`}>
                        <Heart size={14} fill={proxyNextEvent ? 'white' : 'none'} className={proxyNextEvent ? 'text-white' : 'text-slate-300'} />
                      </div>
                      <p className={`flex-1 text-left font-black text-sm ${
                        proxyNextEvent ? 'text-indigo-600' : 'text-slate-500'
                      }`}>
                        다음 새로운 인연을 기대할게요 ❤️
                      </p>
                      {proxyNextEvent && <CheckCircle2 size={20} className="text-indigo-500 shrink-0" />}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setProxyVoteModalOpen(false); setProxyNextEvent(false); setProxyVoteChoices({ priority1: '', priority2: '', priority3: '' }); }}
                        className="flex-1 h-12 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSubmitProxyVote}
                        disabled={proxyVoteLoading}
                        className="flex-[2] h-12 rounded-xl font-black text-white bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {proxyVoteLoading ? <Loader2 size={18} className="animate-spin" /> : '투표 저장하기'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
