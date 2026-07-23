const fs = require('fs');

const path = 'src/app/admin/layout.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states
const stateTarget = "const [notiOpen, setNotiOpen]       = useState(false);";
const stateReplacement = `const [notiOpen, setNotiOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);`;
content = content.replace(stateTarget, stateReplacement);

// 2. Add click outside handler
const clickOutsideTarget = `  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);`;
const clickOutsideReplacement = clickOutsideTarget + `

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);`;
content = content.replace(clickOutsideTarget, clickOutsideReplacement);

// 3. Replace Profile UI
const profileUIOld = `{/* Admin profile */}
            <div className="flex items-center gap-2.5 cursor-pointer" style={{ paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
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
              <div className="hidden sm:block">
                <p style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
                  {auth.currentUser?.email?.split('@')[0] ?? 'Admin'}
                </p>
                <p style={{ fontSize: '0.65rem', color: isSuperAdmin ? '#D97706' : '#555', fontWeight: isSuperAdmin ? 700 : 400 }}>
                  {isSuperAdmin ? '👑 최고관리자' : 'Administrator'}
                </p>
              </div>
              <ChevronDown size={13} style={{ color: '#555' }} />
            </div>`;

const profileUINew = `{/* Admin profile */}
            <div className="relative" ref={profileRef}>
              <div 
                className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 transition-colors rounded-lg py-1 px-1.5" 
                style={{ paddingLeft: 12, borderLeft: '1px solid rgba(0,0,0,0.06)' }}
                onClick={() => setProfileOpen(!profileOpen)}
              >
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
                <div className="hidden sm:block">
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
                    {auth.currentUser?.email?.split('@')[0] ?? 'Admin'}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: isSuperAdmin ? '#D97706' : '#555', fontWeight: isSuperAdmin ? 700 : 400 }}>
                    {isSuperAdmin ? '👑 최고관리자' : 'Administrator'}
                  </p>
                </div>
                <ChevronDown size={13} style={{ color: '#555', transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] py-2 z-50 border border-slate-100">
                  <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                    <p className="text-[0.7rem] text-slate-400 font-bold mb-0.5">로그인된 계정</p>
                    <p className="text-sm text-slate-800 font-semibold truncate">{auth.currentUser?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      auth.signOut();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[0.85rem] text-red-500 hover:bg-red-50 font-bold transition-colors text-left"
                  >
                    <LogOut size={16} />
                    로그아웃
                  </button>
                </div>
              )}
            </div>`;

content = content.replace(profileUIOld, profileUINew);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully added profile dropdown.');
