import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

const oldUI = `<div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">남성 기본 참가비 (원)</label>
                    <input type="text" required placeholder="예: 49,000" value={formData.malePrice || ''} onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData(prev => ({ ...prev, malePrice: val ? Number(val).toLocaleString() : "" }));
                      }} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">남성 안심 옵션 (원)</label>
                    <input type="text" required placeholder="예: 60,000" value={formData.maleSafePrice || ''} onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData(prev => ({ ...prev, maleSafePrice: val ? Number(val).toLocaleString() : "" }));
                      }} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">여성 기본 참가비 (원)</label>
                    <input type="text" required placeholder="예: 29,000" value={formData.femalePrice || formData.price || ''} onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData(prev => ({ ...prev, femalePrice: val ? Number(val).toLocaleString() : "", price: val ? Number(val).toLocaleString() : "" }));
                      }} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">여성 동반 참가비 (원)</label>
                    <input type="text" required placeholder="예: 24,000" value={formData.femaleGroupPrice || ''} onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData(prev => ({ ...prev, femaleGroupPrice: val ? Number(val).toLocaleString() : "" }));
                      }} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                  </div>`;

const newUI = `<div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide whitespace-nowrap">남성 기본가</label>
                      <input type="text" required placeholder="49,000" value={formData.malePrice || ''} onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setFormData(prev => ({ ...prev, malePrice: val ? Number(val).toLocaleString() : "" }));
                        }} className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide whitespace-nowrap">남성 안심 옵션</label>
                      <input type="text" required placeholder="60,000" value={formData.maleSafePrice || ''} onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setFormData(prev => ({ ...prev, maleSafePrice: val ? Number(val).toLocaleString() : "" }));
                        }} className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide whitespace-nowrap">여성 기본가</label>
                      <input type="text" required placeholder="29,000" value={formData.femalePrice || formData.price || ''} onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setFormData(prev => ({ ...prev, femalePrice: val ? Number(val).toLocaleString() : "", price: val ? Number(val).toLocaleString() : "" }));
                        }} className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide whitespace-nowrap">여성 동반가</label>
                      <input type="text" required placeholder="24,000" value={formData.femaleGroupPrice || ''} onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setFormData(prev => ({ ...prev, femaleGroupPrice: val ? Number(val).toLocaleString() : "" }));
                        }} className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all" />
                    </div>
                  </div>`;

if(content.includes(oldUI)) {
  content = content.replace(oldUI, newUI);
  writeFileSync(filePath, content, 'utf-8');
  console.log('Successfully grouped price inputs into rows!');
} else {
  console.log('Could not find the old UI string.');
}
