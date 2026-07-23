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
    oldStr: `{e.theme}`,
    newStr: `{e.theme}{e.theme.includes('특집') ? '' : ' 특집'}`
  },
  {
    oldStr: `{event.theme}`,
    newStr: `{event.theme}{event.theme.includes('특집') ? '' : ' 특집'}`
  }
]);

// 2. app/apply/fast/ClientPage.tsx
updateFile('src/app/apply/fast/ClientPage.tsx', [
  {
    oldStr: `{session.theme}`,
    newStr: `{session.theme}{session.theme.includes('특집') ? '' : ' 특집'}`
  }
]);
