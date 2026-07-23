import { readFileSync, writeFileSync } from 'fs';

function updateFile(filePath, replacements) {
  let content = readFileSync(filePath, 'utf-8');
  let updated = false;
  
  for (const { oldStr, newStr } of replacements) {
    if (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr);
      updated = true;
    }
  }
  
  if (updated) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes made to ${filePath} (strings not found)`);
  }
}

// 1. types/index.ts
updateFile('src/types/index.ts', [
  {
    oldStr: `  isCustomCuration?: boolean;
  createdAt: Date;
}`,
    newStr: `  isCustomCuration?: boolean;
  theme?: string;
  createdAt: Date;
}`
  }
]);

// 2. components/EventsSection.tsx
updateFile('src/components/EventsSection.tsx', [
  {
    oldStr: `    isCustomCuration: (session as any).isCustomCuration ?? false,
    createdAt: session.createdAt,`,
    newStr: `    isCustomCuration: (session as any).isCustomCuration ?? false,
    theme: session.theme || '',
    createdAt: session.createdAt,`
  },
  {
    oldStr: `                  <div key={i} className="kl-event-tag">
                    {!e.isCustomCuration && (`,
    newStr: `                  <div key={i} className="kl-event-tag">
                    {e.theme && (
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#FF6F61', textAlign: 'center', lineHeight: '1.2' }}>
                        ⭐ {e.theme}
                      </span>
                    )}
                    {!e.isCustomCuration && (`
  },
  {
    oldStr: `      {/* 남성 연령 + 날짜/장소 */}
      <div>
        {event.isCustomCuration ? (`,
    newStr: `      {/* 남성 연령 + 날짜/장소 */}
      <div>
        {event.theme && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: '#F5F3FF', border: '1px solid rgba(139,92,246,0.2)', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#8B5CF6' }}>✨ {event.theme}</span>
            </div>
          </div>
        )}
        {event.isCustomCuration ? (`
  }
]);

// 3. app/apply/fast/ClientPage.tsx
updateFile('src/app/apply/fast/ClientPage.tsx', [
  {
    oldStr: `  isCustomCuration?: boolean;
}`,
    newStr: `  isCustomCuration?: boolean;
  theme?: string;
}`
  },
  {
    oldStr: `              targetMaleAge: data.targetMaleAge || '',
              isCustomCuration: data.isCustomCuration || false,`,
    newStr: `              targetMaleAge: data.targetMaleAge || '',
              isCustomCuration: data.isCustomCuration || false,
              theme: data.theme || '',`
  },
  {
    oldStr: `                      {session.isCustomCuration ? (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          여성 우선 선발
                        </p>`,
    newStr: `                      {session.theme && (
                        <p style={{ background: '#F5F3FF', color: '#8B5CF6', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.2)' }}>
                          ✨ {session.theme}
                        </p>
                      )}
                      {session.isCustomCuration ? (
                        <p style={{ background: '#FFF5F4', color: '#FF6F61', fontSize: '0.65rem', fontWeight: '800', margin: '0', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,111,97,0.2)' }}>
                          여성 우선 선발
                        </p>`
  },
  {
    oldStr: `                targetMaleAge: s.targetMaleAge,
                isCustomCuration: s.isCustomCuration,
                createdAt: new Date(),`,
    newStr: `                targetMaleAge: s.targetMaleAge,
                isCustomCuration: s.isCustomCuration,
                theme: s.theme,
                createdAt: new Date(),`
  }
]);
