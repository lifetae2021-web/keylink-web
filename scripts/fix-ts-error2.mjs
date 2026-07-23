import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

const regex = /price:\s*Number\(session\.price\s*\|\|\s*0\)\.toLocaleString\(\),\s*femaleGroupPrice:\s*Number\(session\.femaleGroupPrice\s*\|\|\s*24000\)\.toLocaleString\(\),/;

const injection = `malePrice: Number(session.malePrice || 49000).toLocaleString(),
      maleSafePrice: Number(session.maleSafePrice || 60000).toLocaleString(),
      femalePrice: Number(session.femalePrice || session.price || 29000).toLocaleString(),
      femaleGroupPrice: Number(session.femaleGroupPrice || 24000).toLocaleString(),
      price: Number(session.price || 29000).toLocaleString(), // backward compatibility`;

content = content.replace(regex, injection);
writeFileSync(filePath, content, 'utf-8');
console.log('Fixed line 2016 TS error!');
