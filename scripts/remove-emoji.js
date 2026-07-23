const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/app/vote/[sessionId]/page.tsx',
  'src/app/admin/timer/page.tsx',
  'src/app/admin/events/page.tsx',
  'src/app/mypage/page.tsx',
  'src/app/register/social-profile/page.tsx',
  'src/app/matching-results/[id]/page.tsx',
  'src/app/events/[id]/page.tsx',
  'src/app/page.tsx',
  'src/app/private-matching/page.tsx',
  'src/scripts/add_noshow_tardy.js'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace various patterns of the emoji with spaces
    content = content.replace(/🎉 /g, '');
    content = content.replace(/ 🎉/g, '');
    content = content.replace(/🎉/g, '');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
