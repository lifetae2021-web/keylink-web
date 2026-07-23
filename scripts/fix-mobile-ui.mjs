import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

// Change submit button text
content = content.replace(
  '데이터베이스에 기수 등록 반영',
  '{editingId ? "수정 내용 저장" : "새 기수 등록"}'
);

// Change long option texts in status select
content = content.replace(
  '<option value="open">모집 중 (게시됨)</option>',
  '<option value="open">모집 중</option>'
);
content = content.replace(
  '<option value="draft">임시 저장 (숨김)</option>',
  '<option value="draft">임시 저장</option>'
);

writeFileSync(filePath, content, 'utf-8');
console.log('Mobile UI readability text updated!');
