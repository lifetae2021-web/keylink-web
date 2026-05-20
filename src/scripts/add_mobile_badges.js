const fs = require('fs');

const eventsPath = '/Users/lifetae2021/Desktop/keylink/src/app/admin/events/page.tsx';
let lines = fs.readFileSync(eventsPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

function findLine(query, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].includes(query)) return i;
  }
  return -1;
}

// 모바일 이름 옆 노쇼/지각 배지 삽입
// 현재: 출석완료/지각/노쇼 뱃지 다음 </span> (Line 2011 기준)
// "app.attendanceStatus === 'no-show' && (" 블록 끝 다음에 삽입

const noShowBadgeIdx = findLine("app.attendanceStatus === 'no-show' && (", findLine('sm:hidden flex-nowrap'));
if (noShowBadgeIdx !== -1) {
  // 이 블록의 끝 찾기 (})})
  let blockEnd = -1;
  for (let k = noShowBadgeIdx; k < noShowBadgeIdx + 10; k++) {
    if (lines[k].includes(')}') && k > noShowBadgeIdx + 2) {
      blockEnd = k;
      break;
    }
  }
  
  if (blockEnd !== -1) {
    const mobileBadgeCode = `                                                  {(() => {
                                                    const u = userMap[app.userId];
                                                    const ns = u?.noShowCount || 0;
                                                    const td = u?.tardyCount || 0;
                                                    if (ns === 0 && td === 0) return null;
                                                    return (
                                                      <>
                                                        {ns > 0 && (
                                                          <span className="text-[0.58rem] font-black px-1 py-0.5 rounded bg-rose-100 text-rose-600 border border-rose-200 shrink-0 whitespace-nowrap">
                                                            🚨{ns}
                                                          </span>
                                                        )}
                                                        {td > 0 && (
                                                          <span className="text-[0.58rem] font-black px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap">
                                                            ⏳{td}
                                                          </span>
                                                        )}
                                                      </>
                                                    );
                                                  })()}`;
    lines.splice(blockEnd + 1, 0, mobileBadgeCode);
    console.log('✅ Mobile noShow/tardy badges injected after no-show attendance badge!');
  }
}

fs.writeFileSync(eventsPath, lines.join('\n'), 'utf8');
console.log('✅ Mobile badges saved!');
