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
  // Change overflowX from auto to hidden
  {
    oldStr: `<div style={{ overflowX: 'auto' }}>`,
    newStr: `<div style={{ overflowX: 'hidden' }}>`
  },
  
  // Reduce th padding
  {
    oldStr: `style={{ padding: '10px 14px',`,
    newStr: `style={{ padding: '10px 8px',`
  },
  // Skeleton td padding
  {
    oldStr: `style={{ padding: '12px 14px' }}><Skeleton`,
    newStr: `style={{ padding: '12px 8px' }}><Skeleton`
  },
  // Empty state td padding
  {
    oldStr: `style={{ padding: '40px 14px',`,
    newStr: `style={{ padding: '40px 8px',`
  },
  // td padding - name
  {
    oldStr: `style={{ padding: '12px 14px', fontSize: '0.85rem'`,
    newStr: `style={{ padding: '12px 8px', fontSize: '0.85rem'`
  },
  // td padding - gender/age
  {
    oldStr: `style={{ padding: '12px 14px', fontSize: '0.83rem'`,
    newStr: `style={{ padding: '12px 8px', fontSize: '0.83rem'`
  },
  // td padding - status
  {
    oldStr: `style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px'`,
    newStr: `style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 6px'`
  },
  {
    oldStr: `style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 600, 
                            padding: '4px 10px'`,
    newStr: `style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 600, 
                            padding: '4px 6px'`
  },
  // td padding - date
  {
    oldStr: `style={{ padding: '12px 14px', fontSize: '0.78rem'`,
    newStr: `style={{ padding: '12px 8px', fontSize: '0.78rem'`
  }
]);
