'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { 
  BarChart3, Users, Calendar, Heart, 
  LogOut, ShieldCheck, Menu, X, Bell
} from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(true); // [TEMP] v3.2.4: Default to true for easy initial setup
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // [TEMP] v3.2.4: Temporarily disabled authentication for setup convenience
  /*
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          if (pathname !== '/admin/login') router.push('/admin/login');
        }
      } else {
        setIsAdmin(false);
        if (pathname !== '/admin/login') router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [pathname, router]);
  */

  // Don't show layout on login page
  if (pathname === '/admin/login') return <>{children}</>;

  // Loading state or Access Denied
  if (isAdmin === null) return <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-white">Loading...</div>;
  if (isAdmin === false && pathname !== '/admin/login') return null;

  const menuItems = [
    { name: 'Dashboard', icon: BarChart3, path: '/admin' },
    { name: '신청자 관리', icon: Users, path: '/admin/users' },
    { name: '행사/매칭 관리', icon: Calendar, path: '/admin/events' },
    { name: '환경 설정', icon: ShieldCheck, path: '/admin/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#0F1115] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1A1D23] border-r border-gray-800 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6F61] to-[#E6E6FA] flex items-center justify-center">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">Keylink Admin</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400">
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#FF6F61]/20 to-transparent text-[#FF6F61] border border-[#FF6F61]/20' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  <item.icon size={20} className={isActive ? 'text-[#FF6F61]' : 'group-hover:text-gray-200'} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-800">
            <button 
              onClick={() => auth.signOut()}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium">로그아웃</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-[#1A1D23]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400">
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-6 ml-auto">
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#FF6F61] rounded-full border-2 border-[#1A1D23]"></span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500 font-medium">Administrator</p>
                <p className="text-sm text-white font-semibold">{auth.currentUser?.email?.split('@')[0] || 'Admin'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[#FF6F61] font-bold">
                {auth.currentUser?.email?.[0].toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
