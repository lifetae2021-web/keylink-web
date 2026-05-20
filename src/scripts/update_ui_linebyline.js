const fs = require('fs');
const path = require('path');

const targetFilePath = '/Users/lifetae2021/Desktop/keylink/src/app/admin/events/page.tsx';
let lines = fs.readFileSync(targetFilePath, 'utf8').replace(/\r\n/g, '\n').split('\n');

console.log('🚀 Final Compiler Resolution Engine: Starting ultra-stable restore...');

function findLineIndex(query, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].includes(query)) return i;
  }
  return -1;
}

// 1. 상태 변수 주입 (중복 방지 강화)
const stateIdx = findLineIndex('const [reviewModalOpen, setReviewModalOpen] = useState(false);');
if (stateIdx !== -1) {
  // 이미 정의되어 있는지 사전 검사
  const hasExistingState = findLineIndex('const [isWritingReview', stateIdx + 1) !== -1;
  if (!hasExistingState) {
    lines.splice(stateIdx + 1, 0, 
`  const [reviewList, setReviewList] = useState<{ name: string; gender: string; content: string; slotNumber: number; userId?: string; isManualReview?: boolean }[]>([]);
  const [isWritingReview, setIsWritingReview] = useState(false);
  const [reviewTargetUserId, setReviewTargetUserId] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [isReviewSaving, setIsReviewSaving] = useState(false);
  const [editingReviewUserId, setEditingReviewUserId] = useState<string | null>(null);`
    );
    
    // 기존 basic reviewList 정의 라인은 중복이므로 삭제
    const oldReviewListIdx = findLineIndex('const [reviewList, setReviewList]', stateIdx + 2);
    if (oldReviewListIdx !== -1) {
      lines.splice(oldReviewListIdx, 1);
    }
    console.log('✅ Status variables successfully configured!');
  } else {
    console.log('ℹ️ Status variables already defined, skipping definition.');
  }
}

// 2. handleToggleAttendance 함수 정확하게 포착 및 교체
const funcStartIdx = findLineIndex('const handleToggleAttendance = async (app: Application) => {');
if (funcStartIdx !== -1) {
  let funcEndIdx = -1;
  for (let j = funcStartIdx + 1; j < funcStartIdx + 30; j++) {
    if (lines[j].trim() === '};') {
      funcEndIdx = j;
      break;
    }
  }
  
  if (funcEndIdx !== -1) {
    const newFunctionCode = `  const handleSetAttendanceStatus = async (app: Application, status: 'present' | 'late' | 'no-show' | 'none') => {
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
      toast.success(toastMsg);
    } catch (e) {
      console.error('Error setting attendance status:', e);
      toast.error('출석 상태 변경 중 오류가 발생했습니다.');
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

      const voteDocId = \`\${selectedId}_\${reviewTargetUserId}\`;
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
      const voteDocId = \`\${selectedId}_\${userId}\`;
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
  };`;

    lines.splice(funcStartIdx, (funcEndIdx - funcStartIdx + 1), newFunctionCode);
    console.log('✅ handleSetAttendanceStatus and review CRUD handlers injected perfectly!');
  }
}

// 3. handleOpenReviews query mapping
const reviewsMapIdx = findLineIndex('slotNumber: d.data().slotNumber || 0');
if (reviewsMapIdx !== -1) {
  lines[reviewsMapIdx] = 
`          slotNumber: d.data().slotNumber || 0,
          userId: d.data().userId || d.id.split('_')[1] || '',
          isManualReview: d.data().isManualReview || false`;
  console.log('✅ handleOpenReviews query field map upgraded!');
}

// 4. applications snapshot mapping (중복 삽입 방지)
const appMapIdx = findLineIndex('attended: d.data().attended ?? false,');
if (appMapIdx !== -1) {
  // 바로 아랫줄이 attendanceStatus 인지 확인하여 중복 방지
  if (!lines[appMapIdx + 1].includes('attendanceStatus')) {
    lines.splice(appMapIdx + 1, 0, '            attendanceStatus: d.data().attendanceStatus ?? null,');
    console.log('✅ applications status stream listener extended (safety first)!');
  }
}

// 5. Assigned Card className 리액티브 컬러 연동 (Line 1958 근처)
const assignedCardIdx = findLineIndex('flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors');
if (assignedCardIdx !== -1) {
  lines[assignedCardIdx] = 
`                                            className={\`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 transition-all duration-200 border-b border-slate-100/60 \${isOverQuota ? "bg-red-50/50 animate-pulse" : app.attendanceStatus === \'present\' ? "bg-emerald-50/15 hover:bg-emerald-50/30 border-l-4 border-l-emerald-500 shadow-sm shadow-emerald-100/50" : app.attendanceStatus === \'late\' ? "bg-amber-50/15 hover:bg-amber-50/30 border-l-4 border-l-amber-500 shadow-sm shadow-amber-100/50" : app.attendanceStatus === \'no-show\' ? "bg-rose-50/15 hover:bg-rose-50/30 border-l-4 border-l-rose-500 shadow-sm shadow-rose-100/50" : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"}\`}`;
  console.log('✅ Assigned cards reactively colorized!');
}

// 6. Unassigned Card className 리액티브 컬러 연동 (Line 2212 근처)
const unassignedCardIdx = findLineIndex('className="flex flex-col gap-2.5 px-4 sm:px-6 py-4 hover:bg-slate-50/80 transition-colors"');
if (unassignedCardIdx !== -1) {
  lines[unassignedCardIdx] = 
`                                      className={\`flex flex-col gap-2.5 px-4 sm:px-6 py-4 transition-all duration-200 border-b border-slate-100/60 \${app.attendanceStatus === \'present\' ? "bg-emerald-50/15 hover:bg-emerald-50/30 border-l-4 border-l-emerald-500 shadow-sm shadow-emerald-100/50" : app.attendanceStatus === \'late\' ? "bg-amber-50/15 hover:bg-amber-50/30 border-l-4 border-l-amber-500 shadow-sm shadow-amber-100/50" : app.attendanceStatus === \'no-show\' ? "bg-rose-50/15 hover:bg-rose-50/30 border-l-4 border-l-rose-500 shadow-sm shadow-rose-100/50" : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"}\`}`;
  console.log('✅ Unassigned cards reactively colorized!');
}

// 7. Desktop Check-in Button -> 3-button Chip Group (Line 2105 근처)
const desktopCheckInIdx = findLineIndex('onClick={() => handleToggleAttendance(app)}');
if (desktopCheckInIdx !== -1 && lines[desktopCheckInIdx - 1].includes('<button')) {
  let buttonStart = desktopCheckInIdx - 1;
  let buttonEnd = -1;
  for (let k = desktopCheckInIdx; k < desktopCheckInIdx + 10; k++) {
    if (lines[k].includes('</button>')) {
      buttonEnd = k;
      break;
    }
  }

  if (buttonEnd !== -1) {
    const chipGroupCode = `                                              {/* 3단 출석 관리 칩 그룹 */}
                                              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/60 shrink-0">
                                                <button
                                                  onClick={() => handleSetAttendanceStatus(app, app.attendanceStatus === 'present' ? 'none' : 'present')}
                                                  className={\`px-2.5 py-1 rounded-lg text-[0.65rem] font-bold transition-all \${app.attendanceStatus === \'present\' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}\`}
                                                >
                                                  출석
                                                </button>
                                                <button
                                                  onClick={() => handleSetAttendanceStatus(app, app.attendanceStatus === \'late\' ? \'none\' : \'late\')}
                                                  className={\`px-2.5 py-1 rounded-lg text-[0.65rem] font-bold transition-all \${app.attendanceStatus === \'late\' ? "bg-amber-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}\`}
                                                >
                                                  지각
                                                </button>
                                                <button
                                                  onClick={() => handleSetAttendanceStatus(app, app.attendanceStatus === \'no-show\' ? \'none\' : \'no-show\')}
                                                  className={\`px-2.5 py-1 rounded-lg text-[0.65rem] font-bold transition-all \${app.attendanceStatus === \'no-show\' ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white"}\`}
                                                >
                                                  노쇼
                                                </button>
                                              </div>`;
    lines.splice(buttonStart, (buttonEnd - buttonStart + 1), chipGroupCode);
    console.log('✅ PC 3-state chips button group installed!');
  }
}

// 8. Mobile Check-in Button -> Cycle Icon Button (Line 1984 근처)
const mobileCheckInIdx = findLineIndex('onClick={() => handleToggleAttendance(app)}');
if (mobileCheckInIdx !== -1 && lines[mobileCheckInIdx - 1].includes('<button')) {
  let buttonStart = mobileCheckInIdx - 1;
  let buttonEnd = -1;
  for (let k = mobileCheckInIdx; k < mobileCheckInIdx + 10; k++) {
    if (lines[k].includes('</button>')) {
      buttonEnd = k;
      break;
    }
  }

  if (buttonEnd !== -1) {
    const cycleBtnCode = `                                                {(() => {
                                                  let btnClass = "bg-slate-50 text-slate-400 border-slate-200";
                                                  let Icon = UserCheck;
                                                  let titleText = "미지정 (클릭하여 출석체크)";

                                                  if (app.attendanceStatus === 'present') {
                                                    btnClass = "bg-emerald-500 text-white border-emerald-500 shadow-md scale-105";
                                                    Icon = UserCheck;
                                                    titleText = "출석완료 (클릭 시 지각 변경)";
                                                  } else if (app.attendanceStatus === 'late') {
                                                    btnClass = "bg-amber-500 text-white border-amber-500 shadow-md scale-105";
                                                    Icon = Clock;
                                                    titleText = "지각 (클릭 시 노쇼 변경)";
                                                  } else if (app.attendanceStatus === 'no-show') {
                                                    btnClass = "bg-rose-500 text-white border-rose-500 shadow-md scale-105";
                                                    Icon = UserX;
                                                    titleText = "노쇼 (클릭 시 상태 초기화)";
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
                                                      className={\`p-1.5 rounded-lg border transition-all \${btnClass}\`}
                                                      title={titleText}
                                                    >
                                                      <Icon size={13} fill={(app.attendanceStatus && app.attendanceStatus !== 'no-show') ? "white" : "none"} />
                                                    </button>
                                                  );
                                                })()}`;
    lines.splice(buttonStart, (buttonEnd - buttonStart + 1), cycleBtnCode);
    console.log('✅ Mobile 3-state cycle button installed!');
  }
}

// 9. Mobile Card Check-in Button -> Cycle Text Button (Line 2235 근처)
const mobileCardCheckInIdx = findLineIndex('onClick={() => handleToggleAttendance(app)}');
if (mobileCardCheckInIdx !== -1 && lines[mobileCardCheckInIdx - 1].includes('<button')) {
  let buttonStart = mobileCardCheckInIdx - 1;
  let buttonEnd = -1;
  for (let k = mobileCardCheckInIdx; k < mobileCardCheckInIdx + 10; k++) {
    if (lines[k].includes('</button>')) {
      buttonEnd = k;
      break;
    }
  }

  if (buttonEnd !== -1) {
    const cycleTextBtnCode = `                                                {(() => {
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
                                                      className={\`px-2 py-1 rounded-lg text-[0.65rem] font-black border transition-all \${btnClass}\`}
                                                    >
                                                      {btnText}
                                                    </button>
                                                  );
                                                })()}`;
    lines.splice(buttonStart, (buttonEnd - buttonStart + 1), cycleTextBtnCode);
    console.log('✅ Unassigned Card mobile check-in cycle button installed!');
  }
}

// 10. PC Name Badge (출석 완료 -> present/late/no-show)
const pcBadgeIdx = findLineIndex('app.attended && (');
if (pcBadgeIdx !== -1 && lines[pcBadgeIdx + 1].includes('출석 완료')) {
  let badgeStart = pcBadgeIdx;
  let badgeEnd = -1;
  for (let k = pcBadgeIdx; k < pcBadgeIdx + 10; k++) {
    if (lines[k].includes(')}')) {
      badgeEnd = k;
      break;
    }
  }
  
  if (badgeEnd !== -1) {
    const pcBadgeCode = `                                                {app.attendanceStatus === 'present' && (
                                                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm">
                                                    출석 완료
                                                  </span>
                                                )}
                                                {app.attendanceStatus === 'late' && (
                                                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                                                    지각
                                                  </span>
                                                )}
                                                {app.attendanceStatus === 'no-show' && (
                                                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
                                                    노쇼
                                                  </span>
                                                )}`;
    lines.splice(badgeStart, (badgeEnd - badgeStart + 1), pcBadgeCode);
    console.log('✅ PC status badges installed!');
  }
}

// 11. Mobile Name Badge next to name (Assigned)
const mobBadgeIdx = findLineIndex('className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${badge.cls}`}');
if (mobBadgeIdx !== -1) {
  const mobBadgeCode = `                                                  {app.attendanceStatus === 'present' && (
                                                    <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm whitespace-nowrap shrink-0">
                                                      출석 완료
                                                    </span>
                                                  )}
                                                  {app.attendanceStatus === 'late' && (
                                                    <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm whitespace-nowrap shrink-0">
                                                      지각
                                                    </span>
                                                  )}
                                                  {app.attendanceStatus === 'no-show' && (
                                                    <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm whitespace-nowrap shrink-0">
                                                      노쇼
                                                    </span>
                                                  )}`;
  lines.splice(mobBadgeIdx + 2, 0, mobBadgeCode);
  console.log('✅ Mobile Assigned list status badges installed!');
}

// 12. Mobile Name Badge next to name (Unassigned)
const mobUnassignedBadgeIdx = findLineIndex('className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}');
if (mobUnassignedBadgeIdx !== -1) {
  const divStartIdx = mobUnassignedBadgeIdx - 1;
  const divEndIdx = mobUnassignedBadgeIdx + 3;
  
  if (lines[divStartIdx].includes('<div className="sm:hidden">') && lines[divEndIdx].includes('</div>')) {
    const mobUnassignedCode = `                                                  <div className="sm:hidden flex items-center gap-1">
                                                    <span className={\`text-[0.65rem] font-bold px-2 py-0.5 rounded-full \${badge.cls}\`}>
                                                      {badge.label}
                                                    </span>
                                                    {app.attendanceStatus === 'present' && (
                                                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm whitespace-nowrap">
                                                        출석 완료
                                                      </span>
                                                    )}
                                                    {app.attendanceStatus === 'late' && (
                                                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm whitespace-nowrap">
                                                        지각
                                                      </span>
                                                    )}
                                                    {app.attendanceStatus === 'no-show' && (
                                                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm whitespace-nowrap">
                                                        노쇼
                                                      </span>
                                                    )}
                                                  </div>`;
    lines.splice(divStartIdx, (divEndIdx - divStartIdx + 1), mobUnassignedCode);
    console.log('✅ Mobile Unassigned list status badges installed!');
  }
}

// 13. Review Modal UI fully updated (CRUD additions)
const reviewModalOpenIdx = findLineIndex('{/* Review List Modal */}');
if (reviewModalOpenIdx !== -1) {
  let modalEndIdx = -1;
  for (let k = reviewModalOpenIdx; k < lines.length; k++) {
    if (lines[k].includes('New Session Config Modal') || lines[k].includes('isModalOpen && (')) {
      modalEndIdx = k - 2;
      break;
    }
  }

  if (modalEndIdx !== -1) {
    const newModalCode = `      {/* Review List Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
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
                          <span className={\`text-[0.65rem] font-black px-2 py-0.5 rounded-md \${rev.gender === \'male\' ? \'bg-blue-50 text-blue-600\' : \'bg-pink-50 text-pink-600\'}\`}>
                            {rev.gender === \'male\' ? \'남\' : \'여\'} {rev.slotNumber}호
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
      )}`;
    
    lines.splice(reviewModalOpenIdx, (modalEndIdx - reviewModalOpenIdx + 1), newModalCode);
    console.log('✅ Review List Modal CRUD interface fully recovered with strict types!');
  }
}

// 최종 덮어쓰기
fs.writeFileSync(targetFilePath, lines.join('\n'), 'utf8');
console.log('✨ Ultimate build compilation code prepared successfully!');
