import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

// Put `price: ""` back into initialFormData type so it satisfies TS
content = content.replace(
  'malePrice: "49,000",\n    maleSafePrice: "60,000",\n    femalePrice: "29,000",\n    femaleGroupPrice: "24,000",',
  'malePrice: "49,000",\n    maleSafePrice: "60,000",\n    femalePrice: "29,000",\n    femaleGroupPrice: "24,000",\n    price: "29,000", // backward compatibility'
);

writeFileSync(filePath, content, 'utf-8');
console.log('Fixed TS error!');
