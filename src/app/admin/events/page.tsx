"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
} from "@/lib/types";
import Link from "next/link";
import { getAllVotesBySession } from "@/lib/firestore/votes";
import SMSPreviewModal from "@/components/admin/SMSPreviewModal";
import UserProfileModal from "@/app/admin/users/UserProfileModal";
import MatchingDrawer from "@/components/admin/MatchingDrawer";

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

  // 대기자 선발 SMS 미리보기
  const [selectPreviewOpen, setSelectPreviewOpen] = useState(false);
  const [selectPreviewData, setSelectPreviewData] = useState<any>(null);
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);

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
  const [isMemoSaving, setIsMemoSaving] = useState(false);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewList, setReviewList] = useState<{ name: string; gender: string; content: string; slotNumber: number }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // 대리 투표 모달 상태
  const [proxyVoteModalOpen, setProxyVoteModalOpen] = useState(false);
  const [proxyVoteTarget, setProxyVoteTarget] = useState<Application | null>(null);
  const [proxyVoteLoading, setProxyVoteLoading] = useState(false);
  const [proxyVoteChoices, setProxyVoteChoices] = useState({ priority1: '', priority2: '', priority3: '' });
  const [existingProxyVote, setExistingProxyVote] = useState<any | null>(null);
  const [proxyVoteCheckLoading, setProxyVoteCheckLoading] = useState(false);

  // v9.1.2: 단일 발송 시 대상 참가자 정보 (금액 표시 연동용)
  const [smsSingleTarget, setSmsSingleTarget] = useState<Application | null>(null);

  // v9.1.5: 더미 계정 직업명 수정 전용 상태
  const [editingAppJobId, setEditingAppJobId] = useState<string | null>(null);
  const [tempAppJobValue, setTempAppJobValue] = useState<string>('');
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
  };

  const [formData, setFormData] = useState(initialFormData);

  // v9.2.0: 기수 번호 자동 계산 (신규 등록일 때만)
  useEffect(() => {
    if (editingId) return; // 수정 모드일 때는 작동하지 않음
    if (!formData.eventDate || !formData.region) return;

    const [year, month, day] = formData.eventDate.split('-');
    if (!year || !month || !day) return;
    const newDate = new Date(Number(year), Number(month) - 1, Number(day));

    // 현재 선택된 지역의 기수들만 모아서 날짜 오름차순 정렬
    const regionSessions = sessions
      .filter(s => s.region === formData.region)
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

  // 평균 매칭률 계산 (matchingSummaries 기반)
  useEffect(() => {
    const fetchMatchingRate = async () => {
      const { getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'matchingSummaries'));
      if (snap.empty) { setAvgMatchingRate(0); return; }
      let totalRate = 0;
      let count = 0;
      snap.docs.forEach(d => {
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
          const twoHoursAfter = new Date(ev.eventDate.getTime() + 2 * 60 * 60 * 1000);
          return now < twoHoursAfter;
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
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
            }) as Application,
        );
        list.sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());
        setApplicants(list);
        setApplicantsLoading(false);

        // v7.9.6: 유저 컬렉션에서 상세 정보(생년월일 등) 조인
        const uids = Array.from(new Set(list.map((a) => a.userId)));
        const newUserMap = { ...userMap };
        let updated = false;

        for (const uid of uids) {
          if (!newUserMap[uid]) {
            try {
              const uSnap = await getDoc(doc(db, "users", uid));
              if (uSnap.exists()) {
                newUserMap[uid] = { id: uSnap.id, ...uSnap.data() };
                updated = true;
              }
            } catch (e) {
              console.error("Error fetching user data:", e);
            }
          }
        }
        if (updated) setUserMap(newUserMap);
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
  const waitlisted = useMemo(
    () => applicants.filter((a) => ["applied", "held", "waitlisted", "selected"].includes(a.status)),
    [applicants],
  );

  const isGenderFull = useMemo(() => ({
    male: participants.filter((a) => a.gender === "male").length >= (active?.maxMale ?? 0),
    female: participants.filter((a) => a.gender === "female").length >= (active?.maxFemale ?? 0),
  }), [participants, active]);

  const overQuotaAppIds = useMemo(() => {
    const overIds = new Set<string>();
    if (!active) return overIds;

    const maleConfirmed = participants
      .filter((a) => a.gender === "male")
      .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime());
    const femaleConfirmed = participants
      .filter((a) => a.gender === "female")
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
      ? (app.secondSmsSentAt.toDate ? app.secondSmsSentAt.toDate() : new Date(app.secondSmsSentAt)).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
          className={`shrink-0 p-2 rounded-xl border transition-all relative ${isSent ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white border-[#FF7E7E]/30 text-[#FF6F61] hover:bg-orange-50 hover:border-[#FF7E7E]"}`}
          title={isSent ? `최근 발송: ${sentTimeStr}` : "문자 보내기"}
        >
          <MessageSquare size={13} />
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
        className={`p-2 rounded-xl border relative ${isSent ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-orange-50 text-[#FF6F61] border-orange-100"}`}
        title={isSent ? `최근 발송: ${sentTimeStr}` : "문자 보내기"}
      >
        <MessageSquare size={14} />
        {isSent && (
          <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full">
            <CheckCircle2 size={14} className="text-green-500" fill="white" />
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

    if (targetTemplate) {
      const sessionName = session.episodeNumber
        ? `${session.region === 'busan' ? '부산' : '창원'} ${session.episodeNumber}기`
        : '';

      defaultMsg = targetTemplate.content
        .replace(/{{이름}}/g, user.name || app.name || '참가자')
        .replace(/{{날짜}}/g, fDate)
        .replace(/{{요일}}/g, getPart('weekday') || '')
        .replace(/{{시간}}/g, fTime)
        .replace(/{{금액}}/g, (app.price || genderPrice).toLocaleString('ko-KR'))
        .replace(/{{기수}}/g, sessionName)
        .replace(/{{장소}}/g, session.venue || session.location || '');
    } else {
      defaultMsg = `안녕하세요 ! 키링크에 지원해주셔서 감사합니다☺️
${user.name || app.name || "참가자"}님은 ${fDate} ${fDay} ${fTime} 소개팅 날짜가 지정되었습니다

아래 계좌번호로 ${(app.price || genderPrice).toLocaleString("ko-KR")}원 입금해주셔야 라인업에 확정등록되니 참고 부탁드립니다 :)
3333359229548 카카오뱅크 태영훈(키링크) 입금 또는 참석가능 여부 알려주세요😭
혹시나 입금이 늦을 것 같은 경우 말씀해주세요.

좋은 인연 만날 수 있도록 키링크가 끝까지 책임질게요🥰`;
    }

    setSelectPreviewData({ app, session, defaultMsg });
    setSelectPreviewOpen(true);
  };

  const handleWaitlistSelectConfirm = async (msg: string) => {
    if (!selectPreviewData) return;
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/admin/applications/select", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ applicationId: selectPreviewData.app.id, customMessage: msg }),
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

  const handleWaitlistConfirm = async (app: Application) => {
    if (!window.confirm(`[${app.name}] 님을 선발확정 처리하시겠습니까?`)) return;
    try {
      await callStatusApi(app.id, "confirmed");
      toast.success("선발확정 완료");
    } catch (e: any) {
      toast.error(e.message || "오류가 발생했습니다.");
    }
  };

  const handleToggleAttendance = async (app: Application) => {
    try {
      console.log('Toggling attendance for:', app.name, 'current status:', app.attended);
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      const newStatus = !app.attended;
      await updateDoc(docRef(db, 'applications', app.id), {
        attended: newStatus,
        updatedAt: new Date()
      });
      toast.success(newStatus ? "출석 완료되었습니다." : "출석이 취소되었습니다.");
    } catch (e) {
      console.error('Error toggling attendance:', e);
      toast.error('출석 상태 변경 중 오류가 발생했습니다.');
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
    if (!proxyVoteChoices.priority1) {
      toast.error('최소 1순위는 선택해야 합니다.');
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

      const voteId = `${selectedId}_${proxyVoteTarget.userId}`;
      await setDoc(doc(db, 'votes', voteId), {
        userId: proxyVoteTarget.userId,
        sessionId: selectedId,
        choices,
        realName: proxyVoteTarget.name,
        myAlias: proxyVoteTarget.slotNumber ? `${proxyVoteTarget.gender === 'male' ? '키링남' : '키링여'} ${proxyVoteTarget.slotNumber}호` : '',
        finalCheck: true,
        disclosureMode: 'public',
        feedback: '',
        submittedAt: Timestamp.now(),
        isProxyVote: true,
      });
      toast.success(`[${proxyVoteTarget.name}] 대리 투표가 저장되었습니다.`);
      setProxyVoteModalOpen(false);
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
    const _gender = app.gender === "male" ? "남" : "여";
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

❤️${_name}님은 키링${_gender} ${_slot}호입니다❤️
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

  const handleOpenVotingStatus = async (session: Session) => {
    setVotingStatusModalOpen(true);
    setVotingStatusLoading(true);
    try {
      const sessionParticipants = participants;
      const votes = await getAllVotesBySession(session.id);
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
    } catch (e) {
      console.error(e);
      toast.error('투표 현황을 불러오는데 실패했습니다.');
    } finally {
      setVotingStatusLoading(false);
    }
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
        episodeNumber: Number(formData.episodeNumber),
        title: `${formData.region === "busan" ? "부산" : "창원"} 로테이션 소개팅 ${formData.episodeNumber}기`,
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
        const qShift = query(
          collection(db, "sessions"),
          where("region", "==", formData.region)
        );
        const snapShift = await getDocs(qShift);

        snapShift.docs
          .filter((d) => (d.data().episodeNumber || 0) >= newEpNumber)
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

        // 2. 신규 기수 추가
        const newSessionRef = doc(collection(db, "sessions"));
        batch.set(newSessionRef, {
          ...payload,
          currentMale: 0,
          currentFemale: 0,
          votingUnlockedAt: null,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        toast.success("새 기수가 등록되었으며, 번호가 자동 정렬되었습니다.");
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
    const twoHoursAfter = new Date(active.eventDate.getTime() + 2 * 60 * 60 * 1000);
    activeBadgeLabel = now >= twoHoursAfter ? '종료' : now >= active.eventDate ? '진행 중' : isDetailFull ? '마감' : '모집 중';
    activeBadgeCls = now >= twoHoursAfter ? 'bg-slate-100 text-slate-500' : now >= active.eventDate ? 'bg-blue-100 text-blue-700' : isDetailFull ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700';
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
              const now = new Date();
              const twoHoursAfter = new Date(ev.eventDate.getTime() + 2 * 60 * 60 * 1000);
              return now < twoHoursAfter;
            }).sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime()).map((ev) => {
              // v8.2.3: 전역 applicants 데이터 기반 실시간 집계 (선발 + 확정 합산)
              const live = globalCounts[ev.id] || { male: 0, female: 0 };
              const total = live.male + live.female;
              const maxT = ev.maxMale + ev.maxFemale;
              const pct =
                maxT > 0 ? Math.min(100, Math.round((total / maxT) * 100)) : 0;
              const sel = selectedId === ev.id;
              const isOver = total >= maxT && maxT > 0; // v8.2.3 정원 초과 여부
              const now = new Date();
              const twoHoursAfter = new Date(ev.eventDate.getTime() + 2 * 60 * 60 * 1000);
              const badgeLabel = now >= twoHoursAfter ? '종료' : now >= ev.eventDate ? '진행 중' : isOver ? '마감' : '모집 중';
              const badgeCls = now >= twoHoursAfter ? 'bg-slate-100 text-slate-500' : now >= ev.eventDate ? 'bg-blue-100 text-blue-700' : isOver ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700';
              return (
                <button
                  key={ev.id}
                  onClick={() => {
                    setSelectedId(ev.id);
                    setActiveTab("participants");
                  }}
                  className={`shrink-0 w-52 text-left rounded-xl transition-all duration-150 p-4 ${sel
                    ? "bg-orange-50 border-2 border-[#FF6F61] shadow-md shadow-orange-100"
                    : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className={`text-[0.9rem] font-bold ${sel ? "text-[#FF6F61]" : "text-slate-800"}`}
                    >
                      {ev.region === "busan" ? "부산" : "창원"}{" "}
                      {ev.episodeNumber}기
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
                        <h3 className="text-slate-900 text-xl font-black tracking-tight">
                          {active.region === "busan" ? "부산" : "창원"}{" "}
                          {active.episodeNumber}기
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
                  <div className="flex items-center gap-2">
                    {/* v8.15.0: 개요 탭을 없애고 운영 필수 버튼을 헤더로 이동 */}
                    <div className="hidden lg:flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-200">
                      <button
                        onClick={() => toggleVotingForm(active.status === "voting" ? "closed" : "voting")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${active.status === "voting" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}
                        title="투표 열기/닫기"
                      >
                        <Heart size={13} fill={active.status === "voting" ? "currentColor" : "none"} />
                        {active.status === "voting" ? "투표 중" : "투표 열기"}
                      </button>
                      <button
                        onClick={() => handleOpenVotingStatus(active)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-all"
                        title="실시간 투표 현황"
                      >
                        <BarChart3 size={13} /> 현황
                      </button>
                      <button
                        onClick={() => setMatchingDrawerOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-pink-200 text-xs font-bold text-pink-600 hover:bg-pink-50 transition-all"
                        title="매칭 결과 확인"
                      >
                        <Trophy size={13} /> 결과
                      </button>
                      <button
                        onClick={() => handleOpenReviews(active)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-orange-200 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all"
                        title="후기 모음"
                      >
                        <MessageSquare size={13} /> 후기
                      </button>
                    </div>

                    <button
                      onClick={() => openEditModal(active)}
                      className="flex items-center gap-1.5 rounded-xl transition-all px-4 py-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                    >
                      <Edit2 size={13} /> 수정
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteSession(
                          active.id,
                          `${active.region === "busan" ? "부산" : "창원"} ${active.episodeNumber}기`,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl transition-all px-4 py-2 bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                </div>

                {/* 탭 버튼 */}
                <div className="flex border-b border-slate-100 px-4 overflow-x-auto gap-1">
                  {(
                    [
                      {
                        key: "participants",
                        label: `참가자 ${participants.length}명`,
                        icon: UserCheck,
                      },
                      {
                        key: "waitlist",
                        label: `대기자 ${waitlisted.length}명`,
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
                <div className="p-4 sm:p-7">

                  {/* 참가자 탭 */}
                  {activeTab === "participants" && (
                    <div className="space-y-4">
                      {/* 헤더 */}
                      <div className="flex items-center justify-between pl-1">
                        <h3 className="flex items-center gap-2 text-slate-800 text-[0.95rem] font-extrabold">
                          <ListChecks size={16} className="text-[#FF6F61]" />
                          참가 명단
                          <span className="text-[0.75rem] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF6F61] ml-1">
                            총 {participants.length}명 (
                            {
                              participants.filter((a) => a.gender === "male")
                                .length
                            }
                            남 /{" "}
                            {
                              participants.filter((a) => a.gender === "female")
                                .length
                            }
                            여)
                          </span>
                        </h3>
                        <div className="flex items-center gap-2">
                          {applicantsLoading && (
                            <Loader2
                              className="animate-spin text-slate-400"
                              size={16}
                            />
                          )}
                        </div>
                      </div>

                      {/* 출석 및 음료 요약 */}
                      {participants.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-3 px-1 py-1">
                          <div className="flex items-center gap-3 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                            <span className="text-[0.7rem] font-bold text-green-700">출석 현황</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-blue-600 bg-white/50 px-1.5 py-0.5 rounded">
                                남 {participants.filter(a => a.gender === 'male' && a.attended).length}/{participants.filter(a => a.gender === 'male').length}
                              </span>
                              <span className="text-xs font-black text-pink-600 bg-white/50 px-1.5 py-0.5 rounded">
                                여 {participants.filter(a => a.gender === 'female' && a.attended).length}/{participants.filter(a => a.gender === 'female').length}
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const drinkCounts = participants.reduce((acc, p) => {
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
                                {codes.map(c => (
                                  <span key={c} className="text-xs font-black text-blue-600 bg-white px-2 py-0.5 rounded shadow-sm">
                                    {c} {drinkCounts[c]}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

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
                                  className={`flex items-center gap-2 px-6 py-4 border-b border-slate-100 ${isMaleSection ? "bg-blue-50" : "bg-pink-50"}`}
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
                                    {genderList.length}명
                                  </span>
                                </div>
                                {(() => {
                                  const maxSlots = isMaleSection
                                    ? (active?.maxMale ?? 0)
                                    : (active?.maxFemale ?? 0);
                                  const slots = Array.from(
                                    { length: maxSlots },
                                    (_, i) => {
                                      const slotNum = i + 1;
                                      const app = genderList.find(
                                        (a) => a.slotNumber === slotNum,
                                      );
                                      return { slotNum, app };
                                    },
                                  );
                                  // slotNumber 없는 confirmed 참가자 (마이그레이션 전 데이터)
                                  const unassigned = genderList.filter(
                                    (a) => !a.slotNumber,
                                  );
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
                                              className="flex items-center gap-3 px-5 py-3 bg-slate-50/60"
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
                                            className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors ${isOverQuota ? "bg-red-50/50 animate-pulse" : ""}`}
                                          >
                                            {/* Left: Slot & Status */}
                                            <div className="flex items-center justify-between sm:justify-start gap-3">
                                              <div className="flex items-center gap-2">
                                                <div className="flex flex-col items-center w-8 shrink-0">
                                                  <span className={`text-xs font-black ${isMaleSection ? "text-blue-500" : "text-pink-500"}`}>
                                                    {slotNum}호
                                                  </span>
                                                  {getDrinkCode(app.drink) && (
                                                    <span className="text-[0.6rem] font-black text-blue-600 leading-none mt-0.5">
                                                      {getDrinkCode(app.drink)}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1.5 sm:hidden">
                                                  <span className="text-sm font-bold text-slate-800">{app.name || "-"}</span>
                                                  <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                                    {badge.label}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1 sm:hidden">
                                                <button
                                                  onClick={() => handleToggleAttendance(app)}
                                                  className={`p-2 rounded-xl border transition-all ${app.attended ? "bg-emerald-500 text-white border-emerald-500 shadow-md scale-105" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                                                  title="출석 체크"
                                                >
                                                  <UserCheck size={14} fill={app.attended ? "white" : "none"} />
                                                </button>
                                                <button
                                                  onClick={() => handleOpenMemo(app)}
                                                  className={`p-2 rounded-xl border transition-all ${app.adminMemo ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                                                  title="메모"
                                                >
                                                  <StickyNote size={14} fill={app.adminMemo ? "currentColor" : "none"} />
                                                </button>
                                                {renderSmsButton(app)}
                                                <button
                                                  onClick={() => handleCancelSelection(app)}
                                                  className="p-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-200"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Middle: Info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="hidden sm:flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-bold text-slate-800">
                                                  {app.name || "-"}
                                                </span>
                                                {(app.userId?.startsWith("user_m_") || app.userId?.startsWith("user_f_") || app.id?.startsWith("dummy_")) && (
                                                  <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                    더미
                                                  </span>
                                                )}
                                                <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                                  {badge.label}
                                                </span>
                                                {app.attended && (
                                                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm">
                                                    출석 완료
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex flex-col gap-1.5 ml-11 sm:ml-0">
                                                {/* Row 1: 나이, 직업, 거주지 */}
                                                <div className="flex items-center gap-x-2 text-[0.72rem] text-slate-600 font-bold">
                                                  <span className="whitespace-nowrap">{birthYear}</span>
                                                  <span className="text-slate-300">·</span>
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
                                                          className="text-[0.72rem] font-bold bg-white border border-blue-400 rounded px-1 outline-none w-[100px]"
                                                        />
                                                      ) : (
                                                        <span 
                                                          onClick={() => {
                                                            setEditingAppJobId(app.id);
                                                            setTempAppJobValue(displayJob);
                                                          }}
                                                          className="truncate max-w-[120px] sm:max-w-[100px] cursor-pointer hover:text-blue-500 hover:underline"
                                                          title="더미 직업명 수정"
                                                        >
                                                          {displayJob}
                                                        </span>
                                                      )
                                                    ) : (
                                                      <span className="truncate max-w-[120px] sm:max-w-[100px]">
                                                        {displayJob}
                                                      </span>
                                                    )}
                                                  </span>
                                                  <span className="text-slate-300">·</span>
                                                  <span className="whitespace-nowrap">
                                                    {app.residence || "-"}
                                                  </span>
                                                </div>
                                                {/* Row 2: 휴대폰번호, 동반참여 */}
                                                <div className="flex items-center gap-x-2 text-[0.72rem] text-slate-400 font-medium">
                                                  <span className="flex items-center gap-1 text-blue-600/70 bg-blue-50/50 px-1.5 py-0.5 rounded shrink-0">
                                                    <Phone size={10} className="text-blue-400/70" />
                                                    {app.phone || "-"}
                                                  </span>
                                                  {app.gender === 'female' && app.femaleOption === 'group' && (
                                                    <>
                                                      <span className="text-slate-300">·</span>
                                                      <span className="text-pink-500 font-bold whitespace-nowrap">
                                                        동반할인 {app.groupPartnerName ? `(${app.groupPartnerName})` : ''}
                                                      </span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              {app.adminMemo && (
                                                <div className="mt-1 flex items-start gap-1 bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100/50 max-w-fit">
                                                  <StickyNote size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                                  <p className="text-[0.65rem] text-amber-700 font-bold truncate max-w-[200px]">
                                                    {app.adminMemo}
                                                  </p>
                                                </div>
                                              )}
                                            </div>

                                            {/* Desktop Right: Actions */}
                                            <div className="hidden sm:flex items-center gap-2">
                                              <button
                                                onClick={() => handleToggleAttendance(app)}
                                                className={`shrink-0 px-3 py-1.5 rounded-xl text-[0.7rem] font-black border transition-all shadow-sm ${app.attended ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                                              >
                                                {app.attended ? "출석 취소" : "출석 체크"}
                                              </button>
                                              <button
                                                onClick={() => handleOpenMemo(app)}
                                                className={`shrink-0 p-2 rounded-xl border transition-all ${app.adminMemo ? "bg-amber-50 border-amber-300 text-amber-600 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300"}`}
                                                title="메모"
                                              >
                                                <StickyNote size={13} fill={app.adminMemo ? "currentColor" : "none"} />
                                              </button>
                                              {renderSmsButton(app, true)}
                                              <button
                                                onClick={() => handleCancelSelection(app)}
                                                className="shrink-0 px-3 py-1.5 rounded-xl text-[0.7rem] font-black bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
                                              >
                                                {isOverQuota ? "🔴 선발 취소" : "선발 취소"}
                                              </button>
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
                                            className={`flex flex-col gap-2 px-4 py-4 sm:px-5 sm:py-3.5 hover:bg-slate-50 transition-colors ${isOverQuota ? "bg-red-50 animate-pulse" : "bg-amber-50/40"}`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="flex flex-col items-center w-8 shrink-0">
                                                <span className="text-xs font-black text-amber-500">
                                                  미배정
                                                </span>
                                                {getDrinkCode(app.drink) && (
                                                  <span className="text-[0.6rem] font-black text-blue-600 leading-none mt-0.5">
                                                    {getDrinkCode(app.drink)}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between sm:justify-start gap-2 mb-0.5">
                                                  <span className="text-sm font-bold text-slate-800">
                                                    {app.name || "-"}
                                                  </span>
                                                  <div className="sm:hidden">
                                                    <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                                      {badge.label}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-1 ml-9 sm:ml-0">
                                              <span className="flex items-center gap-0.5">
                                                <Phone size={10} />
                                                {app.phone || "-"}
                                              </span>
                                              <span>·</span>
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
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => handleToggleAttendance(app)}
                                                  className={`px-2 py-1 rounded-lg text-[0.65rem] font-black border transition-all ${app.attended ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-400 border-slate-200"}`}
                                                >
                                                  {app.attended ? "출석완료" : "출석체크"}
                                                </button>
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
                            총 {waitlisted.length}명 (
                            {
                              waitlisted.filter((a) => a.gender === "male")
                                .length
                            }
                            남 /{" "}
                            {
                              waitlisted.filter((a) => a.gender === "female")
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
                            .sort(
                              (a, b) =>
                                a.appliedAt.getTime() - b.appliedAt.getTime(),
                            );
                          if (genderWaitlist.length === 0) return null;
                          const isMaleSection = gender === "male";
                          return (
                            <div
                              key={gender}
                              className={`${card} overflow-hidden`}
                            >
                              <div
                                className={`flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-orange-50/50`}
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
                                      className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors"
                                    >
                                      {/* Left: Slot & Status (Mobile) */}
                                      <div className="flex items-center justify-between sm:justify-start gap-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black w-8 shrink-0 text-amber-500">
                                            {idx + 1}
                                          </span>
                                          <div className="flex items-center gap-1.5 sm:hidden">
                                            <span className="text-sm font-bold text-slate-800">{app.name || "-"}</span>
                                            {app.status === "applied" && <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-md" style={{ color: '#D97706', background: '#FFFBEB' }}>검토 중</span>}
                                            {app.status === "held" && <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-md" style={{ color: '#EA580C', background: '#FFF7ED' }}>보류</span>}
                                            {app.status === "selected" && <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-md" style={{ color: '#7C3AED', background: '#F5F3FF' }}>입금 대기</span>}
                                            {app.status === "waitlisted" && <span className="text-[0.6rem] font-black px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-600">정원초과대기</span>}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 sm:hidden">
                                          <button onClick={() => handleOpenMemo(app)} className={`p-2 rounded-xl border transition-all ${app.adminMemo ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200"}`} title="메모">
                                            <StickyNote size={14} fill={app.adminMemo ? "currentColor" : "none"} />
                                          </button>
                                          {renderSmsButton(app)}
                                          <button onClick={() => handleWaitlistDelete(app)} className="p-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-200">
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Middle: Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="hidden sm:flex items-center gap-2 mb-0.5">
                                          <span className="text-sm font-bold text-slate-800">{app.name || "-"}</span>
                                          {(app.userId?.startsWith("user_m_") || app.userId?.startsWith("user_f_") || app.id?.startsWith("dummy_")) && (
                                            <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">더미</span>
                                          )}
                                          {app.status === "applied" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md" style={{ color: '#D97706', background: '#FFFBEB' }}>검토 중</span>}
                                          {app.status === "held" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md" style={{ color: '#EA580C', background: '#FFF7ED' }}>보류</span>}
                                          {app.status === "selected" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md" style={{ color: '#7C3AED', background: '#F5F3FF' }}>입금 대기</span>}
                                          {app.status === "waitlisted" && <span className="text-[0.65rem] font-black px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-600">정원초과대기</span>}
                                        </div>
                                        <div className="flex flex-col gap-1.5 ml-11 sm:ml-0">
                                          {/* Row 1: 나이, 직업, 거주지 */}
                                          <div className="flex items-center gap-x-2 text-[0.72rem] text-slate-600 font-bold">
                                            <span className="whitespace-nowrap">{birthYear}</span>
                                            <span className="text-slate-300">·</span>
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
                                                    className="text-[0.72rem] font-bold bg-white border border-blue-400 rounded px-1 outline-none w-[100px]"
                                                  />
                                                ) : (
                                                  <span 
                                                    onClick={() => {
                                                      setEditingAppJobId(app.id);
                                                      setTempAppJobValue(app.job || '');
                                                    }}
                                                    className="truncate max-w-[120px] sm:max-w-[100px] cursor-pointer hover:text-blue-500 hover:underline"
                                                    title="더미 직업명 수정"
                                                  >
                                                    {app.job || "-"}
                                                  </span>
                                                )
                                              ) : (
                                                <span className="truncate max-w-[120px] sm:max-w-[100px]">{getEffectiveJob(app)}</span>
                                              )}
                                            </span>
                                            <span className="text-slate-300">·</span>
                                            <span className="whitespace-nowrap">{app.residence || "-"}</span>
                                          </div>
                                          {/* Row 2: 휴대폰번호, 동반참여 */}
                                          <div className="flex items-center gap-x-2 text-[0.72rem] text-slate-400 font-medium">
                                            <span className="flex items-center gap-1 text-blue-600/70 bg-blue-50/50 px-1.5 py-0.5 rounded shrink-0">
                                              <Phone size={10} className="text-blue-400/70" />
                                              {app.phone || "-"}
                                            </span>
                                            {app.gender === 'female' && app.femaleOption === 'group' && (
                                              <>
                                                <span className="text-slate-300">·</span>
                                                <span className="text-pink-500 font-bold whitespace-nowrap">
                                                  동반할인 {app.groupPartnerName ? `(${app.groupPartnerName})` : ''}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        {app.adminMemo && (
                                          <div className="mt-1 ml-11 sm:ml-0 flex items-start gap-1 bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100/50 max-w-fit">
                                            <StickyNote size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                            <p className="text-[0.65rem] text-amber-700 font-bold truncate max-w-[200px]">
                                              {app.adminMemo}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Desktop Right: Actions */}
                                      <div className="hidden sm:flex items-center gap-2">
                                        <button
                                          onClick={() => handleOpenMemo(app)}
                                          className={`shrink-0 p-2 rounded-xl border transition-all ${app.adminMemo ? "bg-amber-50 border-amber-300 text-amber-600 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300"}`}
                                          title="메모"
                                        >
                                          <StickyNote size={13} fill={app.adminMemo ? "currentColor" : "none"} />
                                        </button>
                                        {renderSmsButton(app, true)}

                                        {/* Waitlist Specific Buttons */}
                                        <div className="flex items-center gap-1.5 ml-1 pl-3 border-l border-slate-100">
                                          {app.status === "selected" ? (
                                            <>
                                              <button
                                                onClick={() => handleWaitlistConfirm(app)}
                                                className="px-3 py-1.5 rounded-xl text-[0.7rem] font-black bg-[#FFD700]/10 text-[#B8860B] border border-[#FFD700]/30 hover:bg-[#FFD700] hover:text-white transition-all shadow-sm"
                                              >
                                                입금확정
                                              </button>
                                              <button
                                                onClick={() => {
                                                  if (window.confirm('선발을 취소하고 다시 검토 중 상태로 되돌리시겠습니까?')) {
                                                    callStatusApi(app.id, "applied").then(() => toast.success("검토 중으로 변경되었습니다.")).catch((e: any) => toast.error(e.message));
                                                  }
                                                }}
                                                className="px-3 py-1.5 rounded-xl text-[0.7rem] font-black bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                              >
                                                선발 취소
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              {app.status === "held" && (
                                                <button
                                                  onClick={() => callStatusApi(app.id, "applied").then(() => toast.success("검토 중으로 변경되었습니다.")).catch((e: any) => toast.error(e.message))}
                                                  className="px-2 py-1.5 rounded-xl text-[0.7rem] font-black bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-all flex items-center gap-1"
                                                >
                                                  보류 중 <X size={12} />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => handleWaitlistSelect(app)}
                                                disabled={isGenderFull[app.gender as "male" | "female"]}
                                                className="px-3 py-1.5 rounded-xl text-[0.7rem] font-black bg-[#FF7E7E]/10 text-[#FF7E7E] border border-[#FF7E7E]/20 hover:bg-[#FF7E7E] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                              >
                                                선발
                                              </button>
                                              <button
                                                onClick={() => handleWaitlistHold(app)}
                                                className="px-3 py-1.5 rounded-xl text-[0.7rem] font-black bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-all shadow-sm"
                                              >
                                                보류
                                              </button>
                                              <button
                                                onClick={() => handleWaitlistConfirm(app)}
                                                disabled={isGenderFull[app.gender as "male" | "female"]}
                                                className="px-3 py-1.5 rounded-xl text-[0.7rem] font-black bg-[#FFD700]/10 text-[#B8860B] border border-[#FFD700]/30 hover:bg-[#FFD700] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                              >
                                                선발확정
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => handleWaitlistDelete(app)}
                                            className="shrink-0 p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all ml-1 shadow-sm"
                                            title="삭제"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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

      <UserProfileModal
        user={selectedUser}
        isOpen={isProfileModalOpen}
        onClose={() => { setIsProfileModalOpen(false); setSelectedUser(null); }}
      />

      {/* Voting Status Modal */}
      {votingStatusModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-600" /> 투표 제출 현황 실시간 집계
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => active && handleOpenVotingStatus(active)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                >
                  <RefreshCw size={14} className={votingStatusLoading ? "animate-spin" : ""} /> 새로고침
                </button>
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
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-[0.65rem] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">{p.slotNumber}호</span>
                                      <span className="text-sm font-bold text-slate-800">{p.name}</span>
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
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-[0.65rem] font-black bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded-md">{p.slotNumber}호</span>
                                      <span className="text-sm font-bold text-slate-800">{p.name}</span>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-orange-600" /> 참가자 후기 모음
              </h3>
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
              {reviewsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="animate-spin text-orange-500" size={32} />
                  <p className="text-sm font-semibold text-slate-500">후기 데이터 불러오는 중...</p>
                </div>
              ) : reviewList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviewList.map((rev, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[0.65rem] font-black px-2 py-0.5 rounded-md ${rev.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                          {rev.gender === 'male' ? '남' : '여'} {rev.slotNumber}호
                        </span>
                        <span className="text-sm font-bold text-slate-800">{rev.name}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
                      기수 번호 (숫자)
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="예: 121"
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
                      <option value="상남동 프라이빗한 파티룸 (창원)">
                        상남동 프라이빗한 파티룸 (창원)
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
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

        const makeOption = (uid: string, priority: 1 | 2 | 3) => (
          <select
            key={priority}
            value={proxyVoteChoices[`priority${priority}` as keyof typeof proxyVoteChoices]}
            onChange={e => setProxyVoteChoices(prev => ({ ...prev, [`priority${priority}`]: e.target.value }))}
            disabled={!!existingProxyVote}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{priority}순위 선택 안 함</option>
            {oppParticipants.map(p => (
              <option key={p.userId} value={p.userId}>
                {p.slotNumber}호 {p.name}
              </option>
            ))}
          </select>
        );

        return (
          <div
            onClick={() => setProxyVoteModalOpen(false)}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
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
                      {(existingProxyVote.choices || []).map((c: any) => (
                        <div key={c.priority} className="flex items-center gap-2 text-sm">
                          <span className="text-xs font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">{c.priority}순위</span>
                          <span className="font-bold text-slate-700">{c.targetUserName || c.targetUserId}</span>
                        </div>
                      ))}
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
                      <p className="text-xs font-bold text-indigo-600">📋 네이버폼 투표 결과를 보며 1~3순위를 선택해 주세요.</p>
                    </div>
                    <div className="space-y-3">
                      {([1, 2, 3] as const).map(p => makeOption('', p))}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setProxyVoteModalOpen(false)}
                        className="flex-1 h-12 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSubmitProxyVote}
                        disabled={proxyVoteLoading || !proxyVoteChoices.priority1}
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
