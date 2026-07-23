const fs = require('fs');

const path = 'src/app/admin/layout.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the Profile block
const profileBlockStart = '{/* Admin profile */}';
const targetStartIdx = content.indexOf(profileBlockStart);
if (targetStartIdx !== -1) {
  // Find the end of the profile block. 
  // It ends right before "</div>\n        </header>"
  const targetEndString = '        </header>';
  const targetEndIdx = content.indexOf(targetEndString, targetStartIdx);
  
  if (targetEndIdx !== -1) {
    const oldBlock = content.substring(targetStartIdx, targetEndIdx);
    
    const newBlock = `{/* Admin profile */}
            <div className="flex items-center gap-2.5 select-none" style={{ paddingLeft: 12, borderLeft: '1px solid rgba(0,0,0,0.06)' }}>
              <div
                className="flex items-center justify-center rounded-full relative"
                style={{
                  width: 34, height: 34,
                  background: isSuperAdmin ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#FF7E7E',
                  color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                  boxShadow: isSuperAdmin ? '0 2px 10px rgba(245,158,11,0.4)' : '0 2px 8px rgba(255,126,126,0.3)',
                  border: isSuperAdmin ? '2px solid #FCD34D' : 'none',
                }}
              >
                {isSuperAdmin ? <Crown size={16} /> : (auth.currentUser?.email?.[0]?.toUpperCase() ?? 'A')}
              </div>
              <div className="hidden sm:block pr-2">
                <p style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
                  {auth.currentUser?.email?.split('@')[0] ?? 'Admin'}
                </p>
                <p style={{ fontSize: '0.65rem', color: isSuperAdmin ? '#D97706' : '#555', fontWeight: isSuperAdmin ? 700 : 400 }}>
                  {isSuperAdmin ? '👑 최고관리자' : 'Administrator'}
                </p>
              </div>
            </div>
          </div>
`;
    content = content.replace(oldBlock, newBlock);
  }
}

// Optionally, remove the state and ref to clean up.
// It's not strictly necessary, but good practice.
const stateToRemove = `
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);`;
content = content.replace(stateToRemove, '');

const effectToRemoveRegex = /\/\/ Close profile dropdown on outside click\n\s*useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/;
content = content.replace(effectToRemoveRegex, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully reverted profile dropdown and removed arrow.');
