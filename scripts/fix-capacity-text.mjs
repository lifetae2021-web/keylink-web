import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

// Remove "성별 정원 (1:1 기준)"
content = content.replace(
  '<span className="text-[11px] font-bold text-slate-400 mb-2">\n                    성별 정원 (1:1 기준)\n                  </span>',
  ''
);

// Fallback if formatting is different
content = content.replace(
  /성별 정원 \(1:1 기준\)/g,
  ''
);

// Change "남녀 성비가 1:1로 자동 설정됩니다." to "성비 1:1"
content = content.replace(
  '남녀 성비가 1:1로 자동 설정됩니다.',
  '성비 1:1'
);

writeFileSync(filePath, content, 'utf-8');
console.log('Mobile UI readability text updated for capacity!');
