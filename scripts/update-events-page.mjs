import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

// 1. Update initialFormData
content = content.replace(
  'price: "29,000",\n    femaleGroupPrice: "24,000",',
  'malePrice: "49,000",\n    maleSafePrice: "60,000",\n    femalePrice: "29,000",\n    femaleGroupPrice: "24,000",'
);

// 2. Fetch global settings
// We'll inject a useEffect to fetch settings.
// First, find where useState is initialized.
const stateRegex = /const \[formData, setFormData\] = useState\(initialFormData\);/;
if (stateRegex.test(content)) {
  const injection = `
  const [formData, setFormData] = useState(initialFormData);
  
  // v14.x: 글로벌 설정 연동
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  useEffect(() => {
    async function loadSettings() {
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db, "settings", "general"));
        if (snap.exists()) {
          setGlobalSettings(snap.data());
        }
      } catch (e) { console.error(e); }
    }
    loadSettings();
  }, [db]);
`;
  content = content.replace(stateRegex, injection);
}

// 3. Update "기수 추가" modal opening logic
// When opening modal for ADD (line 4802): `setFormData(initialFormData);`
const addRegex = /setFormData\(initialFormData\);/g;
const addInjection = `
  setFormData({
    ...initialFormData,
    malePrice: globalSettings?.malePrice ? globalSettings.malePrice.toLocaleString() : "49,000",
    maleSafePrice: globalSettings?.maleSafePrice ? globalSettings.maleSafePrice.toLocaleString() : "60,000",
    femalePrice: globalSettings?.femalePrice ? globalSettings.femalePrice.toLocaleString() : "29,000",
    femaleGroupPrice: globalSettings?.femaleGroupPrice ? globalSettings.femaleGroupPrice.toLocaleString() : "24,000",
  });
`;
content = content.replace(addRegex, addInjection.trim());

// 4. Update save payload
const saveRegex = /price: numericPrice,\n\s*femaleGroupPrice: numericGroupPrice,/;
const saveInjection = `
        malePrice: Number(formData.malePrice.replace(/,/g, "")),
        maleSafePrice: Number(formData.maleSafePrice.replace(/,/g, "")),
        femalePrice: Number(formData.femalePrice.replace(/,/g, "")),
        femaleGroupPrice: Number(formData.femaleGroupPrice.replace(/,/g, "")),
        price: Number(formData.femalePrice.replace(/,/g, "")), // backward compatibility
`;
content = content.replace(saveRegex, saveInjection);

// 5. Update UI inputs
// We need to add malePrice, maleSafePrice, and rename price to femalePrice.
const oldUI = `<div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      여성 참가비 (원)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 29,000"
                      value={formData.price}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData(prev => ({
                          ...prev,
                          price: val ? Number(val).toLocaleString() : "",
                        }));
                      }}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                      여성 동반참가비 (원)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 24,000"
                      value={formData.femaleGroupPrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData(prev => ({
                          ...prev,
                          femaleGroupPrice: val ? Number(val).toLocaleString() : "",
                        }));
                      }}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-[#FF6F61]/20 focus:border-[#FF6F61] outline-none transition-all"
                    />
                  </div>`;

const newUI = `<div>
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

// Wait, the UI block is part of grid-cols-2. If we add 2 more fields, it'll span 2 rows. That's fine.
content = content.replace(oldUI, newUI);

// Edit setFormData in handleEdit (line 1989):
// Needs to populate malePrice, maleSafePrice, femalePrice
const editRegex = /price: session\.price\s*\?\s*session\.price\.toLocaleString\(\)\s*:\s*"",\s*femaleGroupPrice:\s*session\.femaleGroupPrice\s*\?\s*session\.femaleGroupPrice\.toLocaleString\(\)\s*:\s*"",/;
const editInjection = `
      malePrice: session.malePrice ? session.malePrice.toLocaleString() : "49,000",
      maleSafePrice: session.maleSafePrice ? session.maleSafePrice.toLocaleString() : "60,000",
      femalePrice: session.femalePrice ? session.femalePrice.toLocaleString() : session.price ? session.price.toLocaleString() : "29,000",
      femaleGroupPrice: session.femaleGroupPrice ? session.femaleGroupPrice.toLocaleString() : "24,000",
      price: session.price ? session.price.toLocaleString() : "29,000", // backward compatibility
`;
content = content.replace(editRegex, editInjection);

writeFileSync(filePath, content, 'utf-8');
console.log('Update successful!');
