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

// 1. components/EventsSection.tsx
updateFile('src/components/EventsSection.tsx', [
  {
    oldStr: `{event.isCustomCuration ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>❤️ 여성 우선 선발</span>`,
    newStr: `{event.isCustomCuration && !event.theme ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#FFF5F4', border: '1px solid rgba(255,111,97,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#FF6F61' }}>❤️ 여성 우선 선발</span>`
  }
]);

// 2. app/apply/fast/ClientPage.tsx
updateFile('src/app/apply/fast/ClientPage.tsx', [
  {
    oldStr: `{session.isCustomCuration ? (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          여성 우선 선발
                        </p>`,
    newStr: `{session.isCustomCuration && !session.theme ? (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          여성 우선 선발
                        </p>`
  }
]);
