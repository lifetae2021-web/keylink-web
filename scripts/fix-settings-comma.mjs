import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/settings/page.tsx';
let content = readFileSync(filePath, 'utf-8');

// 1. Add PriceInputRow component
const priceInputRowStr = `function PriceInputRow({ label, value, onChange }: { label: string; value: string | number; onChange: (v: string) => void }) {
  const displayValue = value ? Number(String(value).replace(/[^0-9]/g, "")).toLocaleString() : "";
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#777', marginBottom: 6 }}>{label}</label>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          onChange(raw);
        }}
        style={{
          width: '100%', padding: '9px 14px', fontSize: '0.85rem',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, color: '#334155', outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,111,97,0.4)')}
        onBlur={e  => (e.currentTarget.style.borderColor = '#e2e8f0')}
      />
    </div>
  );
}`;

// Insert it right after InputRow
content = content.replace(
  /function InputRow.*?<\/div>\s*\);\s*\}/s,
  (match) => `${match}\n\n${priceInputRowStr}`
);

// 2. Change InputRow to PriceInputRow for prices
content = content.replace(
  /<InputRow label="남성 기본 참가비 \(원\)"\s*value=\{settings\.malePrice\} onChange=\{v => handleChange\('malePrice', v\)\} type="number" \/>/g,
  `<PriceInputRow label="남성 기본 참가비 (원)" value={settings.malePrice} onChange={v => handleChange('malePrice', v)} />`
);
content = content.replace(
  /<InputRow label="남성 안심 옵션 참가비 \(원\)"\s*value=\{settings\.maleSafePrice\} onChange=\{v => handleChange\('maleSafePrice', v\)\} type="number" \/>/g,
  `<PriceInputRow label="남성 안심 옵션 참가비 (원)" value={settings.maleSafePrice} onChange={v => handleChange('maleSafePrice', v)} />`
);
content = content.replace(
  /<InputRow label="여성 기본 참가비 \(원\)"\s*value=\{settings\.femalePrice\} onChange=\{v => handleChange\('femalePrice', v\)\} type="number" \/>/g,
  `<PriceInputRow label="여성 기본 참가비 (원)" value={settings.femalePrice} onChange={v => handleChange('femalePrice', v)} />`
);
content = content.replace(
  /<InputRow label="여성 동반 옵션 참가비 \(원\)"\s*value=\{settings\.femaleGroupPrice\} onChange=\{v => handleChange\('femaleGroupPrice', v\)\} type="number" \/>/g,
  `<PriceInputRow label="여성 동반 옵션 참가비 (원)" value={settings.femaleGroupPrice} onChange={v => handleChange('femaleGroupPrice', v)} />`
);

// 3. Remove matchResultTime input
content = content.replace(
  /\s*<InputRow label="매칭 결과 공개 시간 \(시\)"\s*value=\{settings\.matchResultTime\} onChange=\{v => handleChange\('matchResultTime', v\)\} type="number" \/>/g,
  ""
);

writeFileSync(filePath, content, 'utf-8');
console.log('Commas added and matchResultTime removed!');
