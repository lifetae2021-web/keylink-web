const fs = require('fs');

// ==========================================
// 1. types/index.ts - UserProfile에 필드 추가
// ==========================================
const typesPath = '/Users/lifetae2021/Desktop/keylink/src/types/index.ts';
let typesContent = fs.readFileSync(typesPath, 'utf8').replace(/\r\n/g, '\n');

const typesTarget = `  isAdmin: boolean;
  isVerified?: boolean; // 재직/신원 인증 완료 뱃지용
  createdAt: Date;
}`;
const typesReplacement = `  isAdmin: boolean;
  isVerified?: boolean; // 재직/신원 인증 완료 뱃지용
  noShowCount?: number;  // v11.0.0: 누적 노쇼 횟수
  tardyCount?: number;   // v11.0.0: 누적 지각 횟수
  createdAt: Date;
}`;
if (typesContent.includes(typesTarget)) {
  typesContent = typesContent.replace(typesTarget, typesReplacement);
  fs.writeFileSync(typesPath, typesContent, 'utf8');
  console.log('✅ types/index.ts updated!');
} else {
  console.log('⚠️ types/index.ts target not found.');
}

// ==========================================
// 2. lib/types.ts - Application에 attendanceStatus 확인 (이미 있을 것)
// ==========================================
console.log('ℹ️ lib/types.ts attendanceStatus already exists, skipping.');

// ==========================================
// 3. events/page.tsx - 핵심 변경 (스크립트)
// ==========================================
const eventsPath = '/Users/lifetae2021/Desktop/keylink/src/app/admin/events/page.tsx';
let lines = fs.readFileSync(eventsPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

function findLine(query, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].includes(query)) return i;
  }
  return -1;
}

// 3-1. handleSetAttendanceStatus에 users 컬렉션 카운트 업데이트 추가
// "await updateDoc(docRef(db, 'applications', app.id)," 줄 찾기
const appUpdateIdx = findLine("await updateDoc(docRef(db, 'applications', app.id), {");
if (appUpdateIdx !== -1) {
  // attended, attendanceStatus, updatedAt 블록 끝을 찾아서 그 뒤에 users 업데이트 로직 추가
  let blockEnd = -1;
  for (let k = appUpdateIdx; k < appUpdateIdx + 10; k++) {
    if (lines[k].includes('updatedAt: new Date()')) {
      // 다음 줄들에서 }); 찾기
      for (let m = k; m < k + 5; m++) {
        if (lines[m].includes('});')) {
          blockEnd = m;
          break;
        }
      }
      break;
    }
  }
  
  if (blockEnd !== -1) {
    const userUpdateCode = `
      // v11.0.0: users 컬렉션 노쇼/지각 카운트 업데이트
      if (app.userId && !app.userId.startsWith('user_m_') && !app.userId.startsWith('user_f_')) {
        try {
          const { increment } = await import('firebase/firestore');
          const prevStatus = app.attendanceStatus;
          
          if (status === 'no-show' && prevStatus !== 'no-show') {
            await updateDoc(docRef(db, 'users', app.userId), { noShowCount: increment(1) });
          } else if (status !== 'no-show' && prevStatus === 'no-show') {
            await updateDoc(docRef(db, 'users', app.userId), { noShowCount: increment(-1) });
          }
          
          if (status === 'late' && prevStatus !== 'late') {
            await updateDoc(docRef(db, 'users', app.userId), { tardyCount: increment(1) });
          } else if (status !== 'late' && prevStatus === 'late') {
            await updateDoc(docRef(db, 'users', app.userId), { tardyCount: increment(-1) });
          }
        } catch (countErr) {
          console.warn('Failed to update user count:', countErr);
        }
      }`;
    lines.splice(blockEnd + 1, 0, userUpdateCode);
    console.log('✅ handleSetAttendanceStatus user count update injected!');
  }
}

// 3-2. Assigned PC 이름 옆 노쇼/지각 배지 추가
// "app.attended && (" 이후 출석 완료 span이 있는 영역 - 이걸 attendanceStatus 기반 3개로 이미 교체됨
// 지금은 "app.attended && (" 블록 바로 뒤에 노쇼/지각 횟수 배지를 삽입
// 기존 코드 2052: {app.attended && ( ... 출석 완료 ... )} 다음에 삽입

// PC 이름줄 바로 다음: 이름 span 뒤에 noShowCount/tardyCount 배지 추가
// 현재 구조: 이름 span -> 더미 뱃지 -> badge.label span -> app.attended 배지
// target: "text-sm font-bold text-slate-800 cursor-pointer hover:text-[#FF7E7E] transition-colors" 이후의 이름 span 닫힘 다음
const pcNameSpanEnd = findLine('{app.attended && (', findLine('hidden sm:flex items-center gap-2 mb-0.5'));
if (pcNameSpanEnd !== -1) {
  // app.attended 블록 끝 찾기
  let attendedEnd = -1;
  for (let k = pcNameSpanEnd; k < pcNameSpanEnd + 10; k++) {
    if (lines[k].includes(')}') && k > pcNameSpanEnd) {
      attendedEnd = k;
      break;
    }
  }
  
  if (attendedEnd !== -1) {
    // 노쇼/지각 횟수 배지 삽입
    const historyBadgeCode = `                                                {(() => {
                                                  const u = userMap[app.userId];
                                                  const ns = u?.noShowCount || 0;
                                                  const td = u?.tardyCount || 0;
                                                  if (ns === 0 && td === 0) return null;
                                                  return (
                                                    <span className="flex items-center gap-1 ml-0.5">
                                                      {ns > 0 && (
                                                        <span className="flex items-center gap-0.5 text-[0.6rem] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-600 border border-rose-200 shrink-0" title={\`노쇼 \${ns}회\`}>
                                                          🚨{ns}
                                                        </span>
                                                      )}
                                                      {td > 0 && (
                                                        <span className="flex items-center gap-0.5 text-[0.6rem] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 shrink-0" title={\`지각 \${td}회\`}>
                                                          ⏳{td}
                                                        </span>
                                                      )}
                                                    </span>
                                                  );
                                                })()}`;
    lines.splice(attendedEnd + 1, 0, historyBadgeCode);
    console.log('✅ PC noShow/tardy history badges injected!');
  }
}

// 3-3. 카드 배경색에 노쇼 이력자 주의 하이라이트 추가
// 현재 Assigned 카드 className: dynamic 삼항 연산자 기반
// "border-l-4 border-l-transparent" 부분에서 noShowCount > 0이면 특별 처리
// assigned card className 줄을 찾아서 isOverQuota 조건 앞에 noShowHistory 조건 추가

const assignedCardLine = findLine('flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 transition-all duration-200 border-b border-slate-100/60');
if (assignedCardLine !== -1) {
  // 현재 라인을 userMap noShowCount 기반 주의 배경 추가
  const currentLine = lines[assignedCardLine];
  // "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent" 기본값 앞에 주의 배경 적용
  const updatedLine = currentLine.replace(
    '"bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"',
    '(userMap[app.userId]?.noShowCount > 0 ? "bg-rose-50/30 hover:bg-rose-50/50 border-l-4 border-l-rose-300" : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent")'
  );
  lines[assignedCardLine] = updatedLine;
  console.log('✅ Assigned card warning highlight for noShow history applied!');
}

// 3-4. Unassigned 카드도 동일하게 노쇼 이력자 주의 하이라이트
const unassignedCardLine = findLine('flex flex-col gap-2.5 px-4 sm:px-6 py-4 transition-all duration-200 border-b border-slate-100/60');
if (unassignedCardLine !== -1) {
  const currentLine = lines[unassignedCardLine];
  const updatedLine = currentLine.replace(
    '"bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"',
    '(userMap[app.userId]?.noShowCount > 0 ? "bg-rose-50/30 hover:bg-rose-50/50 border-l-4 border-l-rose-300" : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent")'
  );
  lines[unassignedCardLine] = updatedLine;
  console.log('✅ Unassigned card warning highlight for noShow history applied!');
}

// 3-5. PC 이름 옆 주의 태그 추가 (더미 배지 직후)
// "더미" 뱃지 span 다음에 noShowCount > 0 이면 "주의" 태그 추가
const dummyBadgeIdx = findLine('더미', findLine('hidden sm:flex items-center gap-2 mb-0.5'));
if (dummyBadgeIdx !== -1) {
  // "더미" 뱃지 닫는 span 찾기
  let dummyEnd = -1;
  for (let k = dummyBadgeIdx; k < dummyBadgeIdx + 5; k++) {
    if (lines[k].includes('</span>') && lines[k - 1].includes('더미')) {
      dummyEnd = k;
      break;
    }
    if (lines[k].includes('더미')) {
      // 같은 줄에 있으면
      for (let m = k; m < k + 3; m++) {
        if (lines[m].includes(')}')) {
          dummyEnd = m;
          break;
        }
      }
      break;
    }
  }
  
  // "더미" 블록 다음에 noShow 주의 태그 삽입
  const warningTagCode = `                                                {(() => {
                                                  const u = userMap[app.userId];
                                                  if (!u || (u.noShowCount || 0) === 0) return null;
                                                  return (
                                                    <span className="inline-flex items-center gap-0.5 text-[0.58rem] font-black px-1.5 py-0.5 rounded-md bg-rose-500 text-white shadow-sm shrink-0 animate-pulse" title={\`노쇼 이력 \${u.noShowCount}회\`}>
                                                      ⚠️ 주의
                                                    </span>
                                                  );
                                                })()}`;
  
  // "더미" 뱃지가 있는 블록 다음 줄 찾기
  const afterDummyBlock = findLine('})}', dummyBadgeIdx);
  if (afterDummyBlock !== -1 && afterDummyBlock < dummyBadgeIdx + 15) {
    lines.splice(afterDummyBlock + 1, 0, warningTagCode);
    console.log('✅ PC warning tag for noShow history injected!');
  }
}

// 저장
fs.writeFileSync(eventsPath, lines.join('\n'), 'utf8');
console.log('✅ events/page.tsx saved!');

// ==========================================
// 4. UserProfileModal.tsx - tardyCount 표시 + 수동 조정 UI 추가
// ==========================================
let modalContent = fs.readFileSync('/Users/lifetae2021/Desktop/keylink/src/app/admin/users/UserProfileModal.tsx', 'utf8').replace(/\r\n/g, '\n');

// 4-1. 활동 지표 섹션 교체: 노쇼만 있는 부분을 지각도 추가하고 수동 조정 버튼 포함
const oldActivitySection = `                {/* 6. 활동 지표 */}
                <div className="flex gap-4 pt-4">
                  <div className="flex-1 p-4 rounded-3xl bg-blue-50 border border-blue-100 text-center">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">참여</p>
                    <p className="text-xl font-black text-blue-700">{user.participationCount || 0}</p>
                  </div>
                  <div className="flex-1 p-4 rounded-3xl bg-rose-50 border border-rose-100 text-center">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">성공</p>
                    <p className="text-xl font-black text-rose-700">{user.matchCount || 0}</p>
                  </div>
                  <div className="flex-1 p-4 rounded-3xl bg-slate-50 border border-slate-100 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">노쇼</p>
                    <p className="text-xl font-black text-slate-700">{user.noShowCount || 0}</p>
                  </div>
                </div>`;

const newActivitySection = `                {/* 6. 활동 지표 */}
                <div className="flex gap-3 pt-4">
                  <div className="flex-1 p-4 rounded-3xl bg-blue-50 border border-blue-100 text-center">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">참여</p>
                    <p className="text-xl font-black text-blue-700">{user.participationCount || 0}</p>
                  </div>
                  <div className="flex-1 p-4 rounded-3xl bg-rose-50 border border-rose-100 text-center">
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">성공</p>
                    <p className="text-xl font-black text-rose-700">{user.matchCount || 0}</p>
                  </div>
                  <div className="flex-1 p-3 rounded-3xl bg-rose-100 border border-rose-200 text-center relative group">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">🚨 노쇼</p>
                    <p className="text-xl font-black text-rose-700">{user.noShowCount || 0}</p>
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async () => {
                          const uid = user.uid || user.id;
                          if (!uid) return;
                          const { increment } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'users', uid), { noShowCount: increment(-1) });
                          setUser((prev: any) => ({ ...prev, noShowCount: Math.max(0, (prev.noShowCount || 0) - 1) }));
                          toast.success('노쇼 횟수 -1 처리');
                        }}
                        className="w-6 h-6 rounded-full bg-white border border-rose-200 text-rose-500 text-xs font-black flex items-center justify-center shadow hover:bg-rose-50"
                      >-</button>
                      <button
                        onClick={async () => {
                          const uid = user.uid || user.id;
                          if (!uid) return;
                          const { increment } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'users', uid), { noShowCount: increment(1) });
                          setUser((prev: any) => ({ ...prev, noShowCount: (prev.noShowCount || 0) + 1 }));
                          toast.success('노쇼 횟수 +1 처리');
                        }}
                        className="w-6 h-6 rounded-full bg-white border border-rose-200 text-rose-500 text-xs font-black flex items-center justify-center shadow hover:bg-rose-50"
                      >+</button>
                    </div>
                  </div>
                  <div className="flex-1 p-3 rounded-3xl bg-amber-50 border border-amber-200 text-center relative group">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">⏳ 지각</p>
                    <p className="text-xl font-black text-amber-700">{user.tardyCount || 0}</p>
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async () => {
                          const uid = user.uid || user.id;
                          if (!uid) return;
                          const { increment } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'users', uid), { tardyCount: increment(-1) });
                          setUser((prev: any) => ({ ...prev, tardyCount: Math.max(0, (prev.tardyCount || 0) - 1) }));
                          toast.success('지각 횟수 -1 처리');
                        }}
                        className="w-6 h-6 rounded-full bg-white border border-amber-200 text-amber-600 text-xs font-black flex items-center justify-center shadow hover:bg-amber-50"
                      >-</button>
                      <button
                        onClick={async () => {
                          const uid = user.uid || user.id;
                          if (!uid) return;
                          const { increment } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'users', uid), { tardyCount: increment(1) });
                          setUser((prev: any) => ({ ...prev, tardyCount: (prev.tardyCount || 0) + 1 }));
                          toast.success('지각 횟수 +1 처리');
                        }}
                        className="w-6 h-6 rounded-full bg-white border border-amber-200 text-amber-600 text-xs font-black flex items-center justify-center shadow hover:bg-amber-50"
                      >+</button>
                    </div>
                  </div>
                </div>`;

if (modalContent.includes(oldActivitySection)) {
  modalContent = modalContent.replace(oldActivitySection, newActivitySection);
  fs.writeFileSync('/Users/lifetae2021/Desktop/keylink/src/app/admin/users/UserProfileModal.tsx', modalContent, 'utf8');
  console.log('✅ UserProfileModal activity section upgraded with tardyCount & manual adjust!');
} else {
  console.log('⚠️ UserProfileModal activity section target not found.');
}

console.log('🎉 All updates complete!');
