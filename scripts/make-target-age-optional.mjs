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

// 1. app/admin/events/page.tsx
updateFile('src/app/admin/events/page.tsx', [
  {
    oldStr: `                          required={!formData.isCustomCuration}
                          maxLength={2}
                          placeholder="94"`,
    newStr: `                          required={!formData.isCustomCuration && !formData.theme}
                          maxLength={2}
                          placeholder="94"`
  },
  {
    oldStr: `                          required={!formData.isCustomCuration}
                          maxLength={2}
                          ref={ageEndRef}
                          placeholder="01"`,
    newStr: `                          required={!formData.isCustomCuration && !formData.theme}
                          maxLength={2}
                          ref={ageEndRef}
                          placeholder="01"`
  }
]);
