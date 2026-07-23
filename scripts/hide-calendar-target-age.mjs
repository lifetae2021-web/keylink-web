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
    oldStr: `{!e.isCustomCuration && (
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: '1.2' }}>
                        남성 {e.targetMaleAge ? e.targetMaleAge.replace(/년생/g, '') : ''}
                      </span>
                    )}`,
    newStr: `{!e.isCustomCuration && !e.theme && (
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: '1.2' }}>
                        남성 {e.targetMaleAge ? e.targetMaleAge.replace(/년생/g, '') : ''}
                      </span>
                    )}`
  }
]);
