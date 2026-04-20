const fs = require('fs');
const path = '/Users/lifetae2021/Desktop/keylink/src/app/events/[id]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const brokenBlockPrefix = "                <div style={{ marginTop: '24px' }}>\n                  {step === 0 ? (\n                    <button className=\"kl-btn-primary\" style={{ width: '100%', padding: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={handleStep1Entry} disabled={soldOutM && soldOutF}>\n                      {soldOutM && soldOutF ? '마감되었습니다' : <>신청서 작성하기 <ChevronRight size={18} /></>}\n                  {step === 1 && (";

const fixedBlockPrefix = `                <div style={{ marginTop: '24px' }}>
                  {step === 0 ? (
                    <button className="kl-btn-primary" style={{ width: '100%', padding: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={handleStep1Entry} disabled={soldOutM && soldOutF}>
                      {soldOutM && soldOutF ? '마감되었습니다' : <>신청서 작성하기 <ChevronRight size={18} /></>}
                    </button>
                  ) : (
                    <>
                      {step === 1 && (`;

if (content.includes(brokenBlockPrefix)) {
    console.log("Found broken block, fixing...");
    content = content.replace(brokenBlockPrefix, fixedBlockPrefix);
    
    // Now fix the end of that block
    const brokenEnd = "                  {step > 0 && (\n                      <button type=\"button\" onClick={() => setStep(step - 1)} style={{ width: '100%', background: 'none', border: 'none', marginTop: '12px', color: '#888', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>이전으로 돌아가기</button>\n                  )}\n                </div>\n              </div>\n            </div>\n          )}\n        </div>";
    
    const fixedEnd = `                      {step > 0 && (
                        <button type="button" onClick={() => setStep(step - 1)} style={{ width: '100%', background: 'none', border: 'none', marginTop: '12px', color: '#888', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>이전으로 돌아가기</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>`;
    
    if (content.includes(brokenEnd)) {
        content = content.replace(brokenEnd, fixedEnd);
        fs.writeFileSync(path, content);
        console.log("Fix applied successfully!");
    } else {
        console.log("Could not find the end of the broken block.");
    }
} else {
    console.log("Could not find the broken block prefix.");
}
