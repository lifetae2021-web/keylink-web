/**
 * cleanup_attendance_ui_v2.js
 * 라인 단위 정밀 제거: git checkout 후 깔끔한 상태에서 적용
 * 제거 대상:
 *   A. 모바일 이름줄 안의 출석완료/지각/노쇼 span 배지 3개
 *   B. 모바일 액션 영역의 출석/지각/노쇼 칩 그룹 div 전체
 *   C. PC 이름줄 안의 {app.attended && (<span>출석 완료</span>)}
 *   D. PC Desktop Right Actions 안의 순환 아이콘 버튼 IIFE
 */
const fs = require('fs');

const FILE = '/Users/lifetae2021/Desktop/keylink/src/app/admin/events/page.tsx';
let lines = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n').split('\n');

console.log(`📄 Total lines: ${lines.length}`);

function findLine(query, from = 0, to = lines.length) {
  for (let i = from; i < to; i++) {
    if (lines[i].includes(query)) return i;
  }
  return -1;
}

// depth-aware div-block finder: finds where div starting at startLine ends
function findDivEnd(startLine) {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    const l = lines[i];
    // count opening divs (handle self-closing too)
    const opens = (l.match(/<div/g) || []).length;
    const selfClose = (l.match(/\/>/g) || []).length;
    const closes = (l.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth <= 0 && i > startLine) return i;
  }
  return -1;
}

// depth-aware JSX-expression finder: finds where {(()=>{...})()} ends
function findIIFEEnd(startLine) {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    const l = lines[i];
    depth += (l.match(/\{/g) || []).length;
    depth -= (l.match(/\}/g) || []).length;
    if (depth <= 0 && i > startLine) return i;
  }
  return -1;
}

// Splice helper that adjusts index automatically
let offset = 0; // cumulative line offset after splices
const removals = []; // collect [originalStart, originalEnd] pairs first, then apply in reverse

// ── A. 모바일: 출석완료/지각/노쇼 텍스트 배지 (sm:hidden 영역) ──────────
// 위치: Badge span 안에 중첩된 3개의 {app.attendanceStatus === 'xxx' && (...)} 블록
// 정확한 앵커: span className="...whitespace-nowrap shrink-0 ${badge.cls}" 바로 안쪽
{
  const anchorLine = findLine("flex items-center gap-1.5 sm:hidden flex-nowrap");
  if (anchorLine !== -1) {
    console.log(`  [A] Mobile badge area starts at line ${anchorLine + 1}`);
    
    // 이 영역에서 3개의 attendanceStatus 블록 찾기
    const statuses = ['present', 'late', 'no-show'];
    for (const s of statuses) {
      const idx = findLine(`app.attendanceStatus === '${s}' && (`, anchorLine, anchorLine + 60);
      if (idx !== -1) {
        // 닫히는 )} 찾기
        let j = idx + 1;
        while (j < lines.length && !lines[j].includes(')}')) j++;
        removals.push([idx, j]);
        console.log(`  ✅ [A] Found mobile '${s}' badge at lines ${idx + 1}-${j + 1}`);
      }
    }
  } else {
    console.log('  ⚠️ [A] Mobile badge anchor not found');
  }
}

// ── B. 모바일: 칩 버튼 그룹 div (flex items-center gap-0.5 sm:hidden) ──
{
  const chipComment = findLine('{/* 3단 출석 관리 칩 그룹 */}');
  if (chipComment !== -1) {
    // div는 주석 한 줄 위
    const divStart = chipComment - 1;
    if (lines[divStart].includes('flex items-center gap-0.5 sm:hidden')) {
      const divEnd = findDivEnd(divStart);
      if (divEnd !== -1) {
        removals.push([divStart, divEnd]);
        console.log(`  ✅ [B] Mobile chip group div: lines ${divStart + 1}-${divEnd + 1}`);
      }
    }
  } else {
    console.log('  ⚠️ [B] Chip group comment not found');
  }
}

// ── C. PC: {app.attended && (<span>출석 완료</span>)} ─────────────────
{
  // "hidden sm:flex" 이름줄 영역 안에서만
  const pcNameRow = findLine('hidden sm:flex items-center gap-2 mb-0.5');
  if (pcNameRow !== -1) {
    const attendedIdx = findLine('{app.attended &&', pcNameRow, pcNameRow + 40);
    if (attendedIdx !== -1) {
      // 닫히는 )} 찾기
      let j = attendedIdx + 1;
      while (j < lines.length && !lines[j].trim().startsWith(')}')) j++;
      removals.push([attendedIdx, j]);
      console.log(`  ✅ [C] PC attended badge: lines ${attendedIdx + 1}-${j + 1}`);
    } else {
      console.log('  ⚠️ [C] PC attended badge not found');
    }
  }
}

// ── D. PC: 순환 출석 아이콘 버튼 IIFE ────────────────────────────────
{
  const desktopRightDiv = findLine('Desktop Right: Actions');
  if (desktopRightDiv !== -1) {
    // hidden sm:flex 액션 div 안의 첫 IIFE 찾기
    const iifeStart = findLine('{(() =>', desktopRightDiv, desktopRightDiv + 10);
    if (iifeStart !== -1 && lines[iifeStart + 1] && lines[iifeStart + 1].includes('let btnClass')) {
      const iifeEnd = findIIFEEnd(iifeStart);
      if (iifeEnd !== -1) {
        removals.push([iifeStart, iifeEnd]);
        console.log(`  ✅ [D] PC cycle icon button IIFE: lines ${iifeStart + 1}-${iifeEnd + 1}`);
      }
    } else {
      console.log('  ⚠️ [D] PC cycle IIFE not found');
    }
  } else {
    console.log('  ⚠️ [D] Desktop Right Actions anchor not found');
  }
}

// ── Apply removals in reverse order (high → low index) ───────────────
removals.sort((a, b) => b[0] - a[0]);
for (const [start, end] of removals) {
  const count = end - start + 1;
  lines.splice(start, count);
  console.log(`  🗑️  Spliced lines ${start + 1}-${end + 1} (${count} lines removed)`);
}

fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log(`\n✨ Done. New total lines: ${lines.length}`);
