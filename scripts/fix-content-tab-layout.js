const fs = require('fs');

const path = 'src/app/admin/cms/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// ContentTab header replacement
content = content.replace(
  `<div className="flex items-center justify-between">\n          <h3 className="font-bold text-slate-800">{CONTENT_LABELS[contentKey]}</h3>\n          <div className="flex items-center gap-2">`,
  `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">\n          <h3 className="font-bold text-slate-800">{CONTENT_LABELS[contentKey]}</h3>\n          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">`
);

content = content.replace(
  `onClick={handleLoadTemplate}\n              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"`,
  `onClick={handleLoadTemplate}\n              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"`
);

content = content.replace(
  `onClick={handleSave}\n              disabled={saving || isLoading}\n              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all"`,
  `onClick={handleSave}\n              disabled={saving || isLoading}\n              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-all"`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ContentTab layout');
