const fs = require('fs');

const path = 'src/app/admin/cms/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// NoticesTab header
content = content.replace(
  `<div className="flex justify-end gap-2">\n        <button\n          onClick={handleSeedNotices}\n          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"\n        >`,
  `<div className="flex flex-col sm:flex-row justify-end gap-2">\n        <button\n          onClick={handleSeedNotices}\n          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all w-full sm:w-auto"\n        >`
);

content = content.replace(
  `className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all w-full sm:w-auto"`,
  `className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all w-full sm:w-auto"`
);

// FaqsTab header
content = content.replace(
  `<div className="flex justify-end gap-2">\n        <button\n          onClick={handleSeedFaqs}\n          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"\n        >`,
  `<div className="flex flex-col sm:flex-row justify-end gap-2">\n        <button\n          onClick={handleSeedFaqs}\n          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all w-full sm:w-auto"\n        >`
);

// ReviewsTab header
content = content.replace(
  `<div className="flex justify-end">\n        <button onClick={openNew} className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white w-full sm:w-auto"`,
  `<div className="flex justify-end">\n        <button onClick={openNew} className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white w-full sm:w-auto"`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed tab button layouts');
