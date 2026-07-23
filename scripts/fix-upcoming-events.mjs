import { readFileSync, writeFileSync } from 'fs';

function updateFile(filePath, replacements) {
  let content = readFileSync(filePath, 'utf-8');
  let updated = false;
  
  for (const { oldStr, newStr } of replacements) {
    let prevContent = content;
    content = content.split(oldStr).join(newStr);
    if (content !== prevContent) {
      updated = true;
    }
  }
  
  if (updated) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes made to ${filePath} (strings not found)`);
  }
}

updateFile('src/app/admin/page.tsx', [
  // 1. Recalculate participant counts
  {
    oldStr: `const upcoming = sessionsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))`,
    newStr: `const upcoming = sessionsSnap.docs
          .map(d => {
            const s = { id: d.id, ...d.data() };
            // 정확한 참여자 수 재계산 (음수 방지 및 DB 씽크 오차 보정)
            const confirmedApps = allApps.filter(
              (a: any) => a.sessionId === d.id &&
                (a.status === 'confirmed' || (a.paymentConfirmed === true && !['applied', 'canceled', 'rejected'].includes(a.status)))
            );
            let realMale = 0, realFemale = 0;
            confirmedApps.forEach((a: any) => {
              if (a.gender === 'male') realMale++;
              else if (a.gender === 'female') realFemale++;
            });
            return { ...s, currentMale: realMale, currentFemale: realFemale };
          })`
  },
  
  // 2. Improve readability of Upcoming Sessions cards
  {
    oldStr: `<div key={ev.id} className="flex items-center gap-4 rounded-xl transition-colors hover:bg-white/[0.04]" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: 'rgba(255,111,97,0.08)' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FF6F61' }}>{ev.episodeNumber}기</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>{regionLabel} 키링크 {ev.episodeNumber}기</p>
                      <p className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                        <Clock size={10} />
                        {d ? format(d, 'M월 d일 (E) HH:mm', { locale: ko }) : '날짜 미정'}
                        {ev.venue && \` · \${ev.venue}\`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa' }}>
                        남 {ev.currentMale || 0}/{ev.maxMale || 0}
                      </p>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#aaa' }}>
                        여 {ev.currentFemale || 0}/{ev.maxFemale || 0}
                      </p>
                    </div>
                  </div>`,
    newStr: `<div key={ev.id} className="flex items-center gap-3.5 rounded-xl transition-colors hover:bg-slate-50 border border-slate-100 shadow-sm" style={{ padding: '14px 16px', background: '#ffffff' }}>
                    <div className="flex items-center justify-center rounded-xl shrink-0 bg-red-50" style={{ width: 44, height: 44 }}>
                      <span className="text-red-500 font-extrabold text-[0.75rem]">{ev.episodeNumber}기</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-bold text-[0.9rem] truncate">{regionLabel} 키링크 {ev.episodeNumber}기</p>
                      <p className="flex items-center gap-1.5 text-slate-500 text-[0.75rem] mt-1 truncate">
                        <Clock size={11} className="shrink-0" />
                        <span className="shrink-0">{d ? format(d, 'M월 d일 (E) HH:mm', { locale: ko }) : '날짜 미정'}</span>
                        {ev.venue && <span className="truncate">· {ev.venue}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0 whitespace-nowrap">
                      <p className="text-slate-600 font-semibold text-[0.8rem] mb-0.5">
                        남 {ev.currentMale || 0}/{ev.maxMale || 0}
                      </p>
                      <p className="text-slate-600 font-semibold text-[0.8rem]">
                        여 {ev.currentFemale || 0}/{ev.maxFemale || 0}
                      </p>
                    </div>
                  </div>`
  }
]);
