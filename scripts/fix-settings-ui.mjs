import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/settings/page.tsx';
let content = readFileSync(filePath, 'utf-8');

// 1. Update panel style
content = content.replace(
  "const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 };",
  "const panel = { background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };"
);

// 2. Update InputRow styling
content = content.replace(
  /background: 'rgba\(255,255,255,0\.04\)', border: '1px solid rgba\(255,255,255,0\.08\)',\s*borderRadius: 8, color: '#ddd'/g,
  "background: '#f8fafc', border: '1px solid #e2e8f0',\n          borderRadius: 8, color: '#334155'"
);
content = content.replace(
  /onBlur=\{e  => \(e\.currentTarget\.style\.borderColor = 'rgba\(255,255,255,0\.08\)'\)\}/g,
  "onBlur={e  => (e.currentTarget.style.borderColor = '#e2e8f0')}"
);

// 3. Update Toggle styling
content = content.replace(
  /borderBottom: '1px solid rgba\(255,255,255,0\.04\)'/g,
  "borderBottom: '1px solid #f1f5f9'"
);
content = content.replace(
  /background: value \? '#FF6F61' : 'rgba\(255,255,255,0\.08\)'/g,
  "background: value ? '#FF6F61' : '#e2e8f0'"
);
// Toggle label text color
content = content.replace(
  /<p style=\{\{ fontSize: '0.85rem', fontWeight: 600 \}\}>\{label\}<\/p>/g,
  "<p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{label}</p>"
);

// 4. Update Sidebar nav styling
content = content.replace(
  /color:\s*activeSection === s\.key \? '#FF6F61' : '#666'/g,
  "color:      activeSection === s.key ? '#FF6F61' : '#64748b'"
);

// 5. Update system info list border
content = content.replace(
  /borderBottom: '1px solid rgba\(255,255,255,0\.04\)'/g,
  "borderBottom: '1px solid #f1f5f9'"
);
// System info value color
content = content.replace(
  /color: '#ddd'/g,
  "color: '#334155'"
);

// 6. Remove Reservation Deadline input
const deadlineRegex = /\s*<InputRow label="예약 마감 기준 \(일 전\)"\s*value=\{settings\.reservationDeadline\} onChange=\{v => handleChange\('reservationDeadline', v\)\} type="number" \/>/g;
content = content.replace(deadlineRegex, "");

// 7. General text colors
content = content.replace(
  /<h2 style=\{\{ fontSize: '1.1rem', fontWeight: 700 \}\}>시스템 설정<\/h2>/g,
  "<h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>시스템 설정</h2>"
);
content = content.replace(
  /<h3 style=\{\{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20 \}\}>/g,
  "<h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, color: '#334155' }}>"
);
content = content.replace(
  /<h3 style=\{\{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 \}\}>/g,
  "<h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16, color: '#334155' }}>"
);

writeFileSync(filePath, content, 'utf-8');
console.log('UI updated successfully!');
