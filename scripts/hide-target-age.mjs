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
    oldStr: `) : event.targetMaleAge && (`,
    newStr: `) : (event.targetMaleAge && !event.theme) && (`
  }
]);

// 2. app/apply/fast/ClientPage.tsx
updateFile('src/app/apply/fast/ClientPage.tsx', [
  {
    oldStr: `                      ) : (
                        session.targetMaleAge && (`,
    newStr: `                      ) : (
                        (session.targetMaleAge && !session.theme) && (`
  }
]);
