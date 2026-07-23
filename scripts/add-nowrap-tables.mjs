import { readFileSync, writeFileSync } from 'fs';

function updateFile(filePath, replacements) {
  let content = readFileSync(filePath, 'utf-8');
  let updated = false;
  
  for (const { oldStr, newStr } of replacements) {
    if (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr);
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
  // Recent Users Table
  {
    oldStr: `<td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600 }}>{m.name || '미입력'}</td>`,
    newStr: `<td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{m.name || '미입력'}</td>`
  },
  {
    oldStr: `<td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666' }}>`,
    newStr: `<td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666', whiteSpace: 'nowrap' }}>`
  },
  {
    oldStr: `<td style={{ padding: '12px 24px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: s.color, background: s.bg }}>`,
    newStr: `<td style={{ padding: '12px 24px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 20, color: s.color, background: s.bg }}>`
  },
  {
    oldStr: `<td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555' }}>
                          {d ? format(d, 'yyyy-MM-dd') : '-'}`,
    newStr: `<td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap' }}>
                          {d ? format(d, 'yyyy-MM-dd') : '-'}`
  },
  
  // Recent Applicants Table
  {
    oldStr: `<td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600 }}>{a.name}</td>`,
    newStr: `<td style={{ padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.name}</td>`
  },
  {
    oldStr: `<td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666' }}>{a.sessionName}</td>`,
    newStr: `<td style={{ padding: '12px 24px', fontSize: '0.83rem', color: '#666', whiteSpace: 'nowrap' }}>{a.sessionName}</td>`
  },
  {
    oldStr: `<td style={{ padding: '12px 24px' }}>
                          <span style={{`,
    newStr: `<td style={{ padding: '12px 24px', whiteSpace: 'nowrap' }}>
                          <span style={{`
  },
  {
    oldStr: `<td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555' }}>
                          {d ? format(d, 'MM-dd HH:mm') : '-'}`,
    newStr: `<td style={{ padding: '12px 24px', fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap' }}>
                          {d ? format(d, 'MM-dd HH:mm') : '-'}`
  }
]);
