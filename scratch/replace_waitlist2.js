const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/admin/events/page.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Find the line that has "// waitlist" or similar. Actually we know it's inside:
// {activeTab === "waitlist" && (
let startIdx = lines.findIndex(l => l.includes('className="flex items-center gap-2 px-6 py-4"') && lines[Math.max(0, lines.indexOf(l)+1)].includes('borderBottom: "1px solid #f1f5f9",'));

if (startIdx === -1) {
  // wait, the line might be split
  startIdx = lines.findIndex(l => l.includes('className="flex items-center gap-2 px-6 py-4"'));
}

let endIdx = -1;
// we want to find the end of the waitlist mapping block:
for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes(');') && lines[i+1].includes('})}')) {
    if (lines[i+2].includes('</div>')) {
      endIdx = i + 2;
      break;
    }
  }
}

console.log("Found:", startIdx, "to", endIdx);

if (startIdx > -1 && endIdx > -1) {
  const replacement = `                                <div
                                  className={\`flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-orange-50/50\`}
                                >
                                  <span
                                    className={\`text-[0.85rem] font-extrabold text-orange-700\`}
                                  >
                                    {isMaleSection ? "👨 남성" : "👩 여성"} 대기자
                                  </span>
                                  <span
                                    className={\`text-[0.72rem] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700\`}
                                  >
                                    {genderWaitlist.length}명
                                  </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {genderWaitlist.map((app, idx) => {
                                    const user = userMap[app.userId];
                                    const birthYear = (() => {
                                      if (user?.birthDate)
                                        return \`\${user.birthDate.includes("-") ? user.birthDate.split('-')[0].slice(-2) : user.birthDate.slice(0, 2)}년생\`;
                                      if (!app.age) return "-";
                                      const n = Number(app.age);
                                      if (n > 0 && n < 50) return \`\${String(2026 - n).slice(-2)}년생\`;
                                      return \`\${String(app.age).padStart(2, "0")}년생\`;
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
                                            <button onClick={() => handleOpenMemo(app)} className={\`p-2 rounded-xl border transition-all \${app.adminMemo ? "bg-amber-50 text-amber-600 border-amber-200 shadow-sm" : "bg-slate-50 text-slate-400 border-slate-200"}\`} title="메모">
                                              <StickyNote size={14} fill={app.adminMemo ? "currentColor" : "none"} />
                                            </button>
                                            <button onClick={() => {
                                              const _name = app.name || '참가자';
                                              const _gender = app.gender === 'male' ? '남' : '녀';
                                              const _slot = app.slotNumber != null ? String(app.slotNumber) : '?';
                                              setSmsTargets([{ phone: app.phone, name: _name, gender: app.gender, slotNumber: app.slotNumber, userId: app.userId }]);
                                              setSmsRecipientLabel(\`\${app.name}님\`);
                                              setSmsDefaultMsg(\`안녕하세요😊 키링크입니다 :)\\n일시 : \${active?.eventDate ? format(active.eventDate, 'MM/dd E HH:mm', { locale: ko }) : ''} (약 2시간 소요)\\n장소 : 부산진구 중앙대로 763-1 데일리팡 4층\\n\\n❤️\${_name}님은 키링\${_gender} \${_slot}호입니다❤️\\n입장 전 신분증(모바일 가능)을 미리 꺼내놔주세요\\n\\n슬리퍼, 운동복 등 소개팅 분위기와 맞지 않는 복장은 ❌❌\\n{오픈채팅링크}\\n카카오프렌즈 익명으로 입장해주시면 됩니다 ! 내일 오픈채팅으로 진행과정에 대해 설명드리니 지금 바로 입장부탁드립니다 :)\`);
                                              setSmsModalOpen(true);
                                            }} className="p-2 rounded-xl bg-orange-50 text-[#FF6F61] border border-orange-100" title="문자 보내기">
                                              <MessageSquare size={14} />
                                            </button>
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
                                              <span className="truncate max-w-[120px] sm:max-w-[100px]">{app.displayJob || app.job || "-"}</span>
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
                                                    동반할인 {app.groupPartnerName ? \`(\${app.groupPartnerName})\` : ''}
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
                                            className={\`shrink-0 p-2 rounded-xl border transition-all \${app.adminMemo ? "bg-amber-50 border-amber-300 text-amber-600 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-slate-300"}\`}
                                            title="메모"
                                          >
                                            <StickyNote size={13} fill={app.adminMemo ? "currentColor" : "none"} />
                                          </button>
                                          <button
                                            onClick={() => {
                                              const _name = app.name || '참가자';
                                              const _gender = app.gender === 'male' ? '남' : '녀';
                                              const _slot = app.slotNumber != null ? String(app.slotNumber) : '?';
                                              setSmsTargets([{ phone: app.phone, name: _name, gender: app.gender, slotNumber: app.slotNumber, userId: app.userId }]);
                                              setSmsRecipientLabel(\`\${app.name}님\`);
                                              setSmsDefaultMsg(\`안녕하세요😊 키링크입니다 :)\\n일시 : \${active?.eventDate ? format(active.eventDate, 'MM/dd E HH:mm', { locale: ko }) : ''} (약 2시간 소요)\\n장소 : 부산진구 중앙대로 763-1 데일리팡 4층\\n\\n❤️\${_name}님은 키링\${_gender} \${_slot}호입니다❤️\\n입장 전 신분증(모바일 가능)을 미리 꺼내놔주세요\\n\\n슬리퍼, 운동복 등 소개팅 분위기와 맞지 않는 복장은 ❌❌\\n{오픈채팅링크}\\n카카오프렌즈 익명으로 입장해주시면 됩니다 ! 내일 오픈채팅으로 진행과정에 대해 설명드리니 지금 바로 입장부탁드립니다 :)\`);
                                              setSmsModalOpen(true);
                                            }}
                                            className="shrink-0 p-2 rounded-xl bg-white border border-[#FF7E7E]/30 text-[#FF6F61] hover:bg-orange-50 hover:border-[#FF7E7E] transition-all"
                                            title="문자 보내기"
                                          >
                                            <MessageSquare size={13} />
                                          </button>
                                          
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
                                      </div>`;
  const newLines = [
    ...lines.slice(0, startIdx),
    ...replacement.split('\n'),
    ...lines.slice(endIdx + 1)
  ];
  fs.writeFileSync(filePath, newLines.join('\n'));
  console.log("Replaced successfully!");
} else {
  console.log("Could not find boundaries.");
}
