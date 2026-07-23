const fs = require('fs');

const path = 'src/app/admin/cms/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"`,
  `          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all w-full sm:w-auto"`
);

content = content.replace(
  `          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"`,
  `          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all w-full sm:w-auto"`
);

content = content.replace(
  `        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: '#FF6F61' }}>`,
  `        <button onClick={openNew} className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white w-full sm:w-auto" style={{ background: '#FF6F61' }}>`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed button wrappers');
