import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

const oldBlock = `<div className="grid grid-cols-2 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 mb-8 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-center">
                    초기 상태
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        status: e.target.value as SessionStatus,
                      }))
                    }
                    className="w-full h-11 text-center rounded-xl border-2 border-slate-200 bg-white text-slate-800 font-bold focus:border-[#FF6F61] focus:ring-0 outline-none transition-all"
                  >
                    <option value="open">모집 중</option>
                    <option value="closed">모집 마감</option>
                  </select>
                </div>
                <div className="flex flex-col items-center">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-center">
                    
                  </label>
                  <input`;

const newBlock = `<div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border border-slate-100 mb-8 max-w-xs mx-auto">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-center">
                    정원 설정
                  </label>
                  <input`;

if(content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  writeFileSync(filePath, content, 'utf-8');
  console.log('Successfully removed the initial status dropdown!');
} else {
  console.log('Could not find the old block.');
}
